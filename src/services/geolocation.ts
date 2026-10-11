/**
 * TrailWhistle Geolocation Service
 * Captures on-device GPS coordinates (works without cellular data when hardware GPS is present).
 */

import { GeoLocation } from '../types/journal';

export async function getCurrentCoordinates(timeoutMs: number = 8000): Promise<GeoLocation | null> {
  if (!('geolocation' in navigator)) {
    return null;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeoutId);
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined,
          altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : null,
        });
      },
      (err) => {
        clearTimeout(timeoutId);
        console.warn('Geolocation capture failed or denied:', err.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 60000, // Accept cached GPS up to 1 minute old for rapid trail use
      }
    );
  });
}
