/**
 * Lightweight, dependency-free area labeling for lat/lng.
 *
 * Goals:
 * - No network calls / no external API keys.
 * - Fast and small.
 * - Returns a human-friendly label with this priority:
 *   1) City + Country (when near a built-in sample city)
 *   2) Country (when lat/lng falls inside a coarse bounding box)
 *   3) Continent/region bucket
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Coarse continent buckets (approximate).
const CONTINENTS = [
  { key: "northAmerica", label: "North America", lat: [7, 83], lng: [-168, -52] },
  { key: "southAmerica", label: "South America", lat: [-56, 13], lng: [-82, -34] },
  { key: "europe", label: "Europe", lat: [35, 71], lng: [-25, 45] },
  { key: "africa", label: "Africa", lat: [-35, 38], lng: [-20, 55] },
  { key: "middleEast", label: "Middle East", lat: [12, 42], lng: [30, 63] },
  { key: "southAsia", label: "South Asia", lat: [5, 36], lng: [65, 95] },
  { key: "eastAsia", label: "East Asia", lat: [18, 52], lng: [95, 150] },
  { key: "oceania", label: "Oceania", lat: [-48, -5], lng: [110, 180] },
  { key: "antarctica", label: "Antarctica", lat: [-90, -60], lng: [-180, 180] },
];

// Coarse country bounding boxes (major countries + a few high-frequency ones).
// Note: These are intentionally approximate and are only used as a helpful label,
// not as a legal/precise geofence.
const COUNTRIES = [
  { code: "US", name: "United States", lat: [24, 49.8], lng: [-125, -66] },
  { code: "CA", name: "Canada", lat: [41, 83], lng: [-141, -52] },
  { code: "MX", name: "Mexico", lat: [14, 33], lng: [-118, -86] },

  { code: "BR", name: "Brazil", lat: [-34, 6], lng: [-74, -34] },
  { code: "AR", name: "Argentina", lat: [-56, -21], lng: [-73, -53] },
  { code: "CL", name: "Chile", lat: [-56, -17], lng: [-76, -66] },

  { code: "GB", name: "United Kingdom", lat: [49.8, 59.1], lng: [-8.7, 2.1] },
  { code: "IE", name: "Ireland", lat: [51.3, 55.4], lng: [-10.6, -5.3] },
  { code: "FR", name: "France", lat: [41, 51.6], lng: [-5.3, 9.7] },
  { code: "DE", name: "Germany", lat: [47.2, 55.1], lng: [5.8, 15.2] },
  { code: "ES", name: "Spain", lat: [36, 43.9], lng: [-9.6, 3.4] },
  { code: "IT", name: "Italy", lat: [36.5, 47.1], lng: [6.6, 18.7] },
  { code: "NL", name: "Netherlands", lat: [50.7, 53.6], lng: [3.2, 7.3] },
  { code: "SE", name: "Sweden", lat: [55, 69.1], lng: [10.8, 24.2] },
  { code: "NO", name: "Norway", lat: [57.9, 71.2], lng: [4.0, 31.0] },
  { code: "PL", name: "Poland", lat: [49, 54.9], lng: [14.1, 24.2] },
  { code: "TR", name: "Turkey", lat: [36, 42.3], lng: [26, 45] },

  { code: "EG", name: "Egypt", lat: [22, 31.7], lng: [24.7, 36.9] },
  { code: "NG", name: "Nigeria", lat: [4, 14.3], lng: [2.6, 14.7] },
  { code: "KE", name: "Kenya", lat: [-5, 5.2], lng: [33.5, 42.2] },
  { code: "ZA", name: "South Africa", lat: [-35, -22], lng: [16.3, 32.9] },

  { code: "SA", name: "Saudi Arabia", lat: [16, 32.2], lng: [34.5, 55.7] },
  { code: "AE", name: "United Arab Emirates", lat: [22.5, 26.2], lng: [51.5, 56.5] },
  { code: "IL", name: "Israel", lat: [29.4, 33.5], lng: [34.2, 35.9] },

  { code: "IN", name: "India", lat: [6.5, 35.7], lng: [68, 97.5] },
  { code: "PK", name: "Pakistan", lat: [23.5, 37.1], lng: [60.8, 77.8] },
  { code: "BD", name: "Bangladesh", lat: [20.5, 26.7], lng: [88, 92.7] },

  { code: "CN", name: "China", lat: [18, 53.6], lng: [73.5, 135.1] },
  { code: "JP", name: "Japan", lat: [30, 45.7], lng: [129, 146] },
  { code: "KR", name: "South Korea", lat: [33, 39.2], lng: [124.5, 131.9] },
  { code: "ID", name: "Indonesia", lat: [-11.2, 6.1], lng: [95, 141.2] },

  { code: "AU", name: "Australia", lat: [-44, -10], lng: [112, 154] },
  { code: "NZ", name: "New Zealand", lat: [-48, -34], lng: [166, 179.5] },
];

// Tiny built-in sample cities table for nicer labels.
// (Only a handful; keeps bundle small.)
const CITIES = [
  { city: "San Francisco", country: "United States", lat: 37.7749, lng: -122.4194 },
  { city: "New York", country: "United States", lat: 40.7128, lng: -74.006 },
  { city: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832 },
  { city: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332 },

  { city: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333 },
  { city: "Buenos Aires", country: "Argentina", lat: -34.6037, lng: -58.3816 },

  { city: "London", country: "United Kingdom", lat: 51.5074, lng: -0.1278 },
  { city: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { city: "Berlin", country: "Germany", lat: 52.52, lng: 13.405 },
  { city: "Madrid", country: "Spain", lat: 40.4168, lng: -3.7038 },
  { city: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964 },

  { city: "Cairo", country: "Egypt", lat: 30.0444, lng: 31.2357 },
  { city: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792 },
  { city: "Nairobi", country: "Kenya", lat: -1.2864, lng: 36.8172 },
  { city: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241 },

  { city: "Dubai", country: "United Arab Emirates", lat: 25.2048, lng: 55.2708 },
  { city: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lng: 46.6753 },

  { city: "Delhi", country: "India", lat: 28.6139, lng: 77.209 },
  { city: "Mumbai", country: "India", lat: 19.076, lng: 72.8777 },

  { city: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503 },
  { city: "Seoul", country: "South Korea", lat: 37.5665, lng: 126.978 },

  { city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093 },
  { city: "Auckland", country: "New Zealand", lat: -36.8485, lng: 174.7633 },
];

function findContinentLabel(lat, lng) {
  const la = clamp(lat, -90, 90);
  const lo = ((lng + 540) % 360) - 180; // normalize to [-180, 180)
  const hit = CONTINENTS.find((c) => la >= c.lat[0] && la <= c.lat[1] && lo >= c.lng[0] && lo <= c.lng[1]);
  return hit ? hit.label : "World";
}

function findCountryName(lat, lng) {
  const la = clamp(lat, -90, 90);
  const lo = ((lng + 540) % 360) - 180;

  const hit = COUNTRIES.find((c) => la >= c.lat[0] && la <= c.lat[1] && lo >= c.lng[0] && lo <= c.lng[1]);
  return hit ? hit.name : null;
}

function findNearbyCity(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const here = { lat, lng };

  // Threshold chosen to be forgiving at world-zoom: "near enough" to be a useful label.
  const thresholdKm = 120;

  let best = null;
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = haversineKm(here, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best && bestD <= thresholdKm) return best;
  return null;
}

// PUBLIC_INTERFACE
export function getAreaLabel(lat, lng) {
  /** Return an approximate, offline area label for given coordinates. */
  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return "Unknown area";
  }

  const city = findNearbyCity(lat, lng);
  if (city) return `${city.city}, ${city.country}`;

  const country = findCountryName(lat, lng);
  if (country) return country;

  return findContinentLabel(lat, lng);
}

// PUBLIC_INTERFACE
export function getAreaLabelForUser(user) {
  /** Convenience helper: get an area label for a user object with {lat,lng}. */
  return getAreaLabel(user?.lat, user?.lng);
}
