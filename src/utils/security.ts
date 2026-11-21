/**
 * Security utilities for strict citizen/admin input sanitization, upload validation,
 * safe URL verification, and resilient JSON parsing.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Strips HTML tags, script/style blocks, inline event handlers, dangerous URI schemes,
 * and control characters from user-supplied text before storing or rendering.
 */
export function sanitizeInput(raw: string): string {
  if (typeof raw !== 'string') return '';

  let cleaned = raw
    // Remove control characters except tab/newline
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove full <script>...</script> and <style>...</style> blocks
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Strip all HTML tags (complete or unclosed angle-bracket fragments)
    .replace(/<\/?[^>]+(>|$)/g, '')
    // Remove inline event handler attributes such as onerror=, onload=, onclick=
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Neutralize dangerous URI schemes
    .replace(/(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, '');

  // Collapse excessive horizontal whitespace while preserving single newlines
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ').trim();
  return cleaned;
}

/**
 * Validates uploaded image MIME type and size (strictly JPEG, PNG, WebP up to 5MB).
 */
export function validateImageUpload(file: {
  type: string;
  size: number;
  name?: string;
}): { valid: boolean; error?: string } {
  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPEG (.jpg), PNG (.png), and WebP (.webp) images are allowed.',
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'The selected image file is empty. Please choose a valid photo.',
    };
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Image exceeds the 5 MB limit (${mb} MB selected). Please choose a smaller photograph.`,
    };
  }

  return { valid: true };
}

/**
 * Validates that an image Base64 data URL (sent to backend) matches allowed MIME types and size.
 */
export function validateBase64ImagePayload(
  rawDataUrl: string,
  declaredMime?: string,
): { valid: boolean; mimeType: string; base64Data: string; error?: string } {
  const trimmed = rawDataUrl.trim();
  let mime = (declaredMime || 'image/jpeg').toLowerCase();
  let base64 = trimmed;

  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (dataUrlMatch) {
    mime = dataUrlMatch[1].toLowerCase();
    base64 = dataUrlMatch[2];
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return {
      valid: false,
      mimeType: mime,
      base64Data: '',
      error: 'Unsupported image MIME type. Only image/jpeg, image/png, and image/webp are accepted.',
    };
  }

  // Approximate decoded byte size from base64 length
  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      valid: false,
      mimeType: mime,
      base64Data: '',
      error: 'Uploaded image payload exceeds the 5 MB maximum limit.',
    };
  }

  return { valid: true, mimeType: mime, base64Data: base64 };
}

/**
 * Verifies an external URL uses safe HTTPS/HTTP protocols (blocking javascript:/data:).
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Safe JSON parser with fallback to prevent unhandled runtime crashes.
 */
export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
