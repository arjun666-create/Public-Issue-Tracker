/**
 * Google Maps URL generation and coordinate parsing utilities for reported civic locations.
 */

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

/**
 * Extracts latitude/longitude coordinates from strings like:
 * - "2nd Avenue, Anna Nagar, Chennai (13.0878° N, 80.2004° E)"
 * - "13.0418, 80.2341"
 */
export function extractCoordinates(location: string): GeoCoordinates | null {
  if (!location) return null;

  const degMatch =
    /(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*[,\s]+\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?/i.exec(
      location,
    );

  if (!degMatch) return null;

  let lat = Number.parseFloat(degMatch[1]);
  const ns = degMatch[2]?.toUpperCase();
  let lng = Number.parseFloat(degMatch[3]);
  const ew = degMatch[4]?.toUpperCase();

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (ns === 'S') lat = -Math.abs(lat);
  if (ew === 'W') lng = -Math.abs(lng);

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

/**
 * Formats coordinates into a readable telemetry label when present.
 */
export function formatCoordinatesLabel(location: string): string | null {
  const coords = extractCoordinates(location);
  if (!coords) return null;
  return `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`;
}

/**
 * Generates a direct HTTPS Google Maps link for any reported issue location.
 * Uses exact coordinates (`https://www.google.com/maps?q=lat,lng`) when detected,
 * or falls back to a Google Maps place search URL for street/landmark text.
 */
export function buildGoogleMapsUrl(location: string): string {
  const coords = extractCoordinates(location);
  if (coords) {
    return `https://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
  }

  const trimmed = (location || 'Chennai, Tamil Nadu').trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}
