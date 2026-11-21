/**
 * Client-side HTML5 Canvas image compression utility.
 * Resizes uploaded citizen photos to maxWidth 1024px at 0.8 JPEG quality
 * before encoding to Base64 for fast, lightweight Gemini API payloads.
 */

export interface CompressedImageResult {
  dataUrl: string;
  mimeType: 'image/jpeg';
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

/**
 * Estimates decoded byte size of a Base64 data URL.
 */
function estimateDataUrlBytes(dataUrl: string): number {
  const idx = dataUrl.indexOf(',');
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Reads an image File, scales it down via HTML5 <canvas> (maxWidth 1024px),
 * and exports a compressed JPEG data URL (quality 0.8).
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1024,
  jpegQuality = 0.8,
): Promise<CompressedImageResult> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;

      if (targetWidth > maxWidth) {
        const scale = maxWidth / targetWidth;
        targetWidth = maxWidth;
        targetHeight = Math.max(1, Math.round(targetHeight * scale));
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Browser canvas 2D context unavailable for image compression.'));
        return;
      }

      // White fill prevents black backgrounds when converting transparent PNGs to JPEG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
      resolve({
        dataUrl: compressedDataUrl,
        mimeType: 'image/jpeg',
        originalBytes: file.size,
        compressedBytes: estimateDataUrlBytes(compressedDataUrl),
        width: targetWidth,
        height: targetHeight,
      });
    };
    img.onerror = () => reject(new Error('Unable to decode image file for optimization.'));
    img.src = rawDataUrl;
  });
}
