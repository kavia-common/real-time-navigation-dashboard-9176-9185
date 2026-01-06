function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

const ROUTES = [
  "Harbor Loop",
  "Coastal Sprint",
  "Bay Traverse",
  "Downtown Connector",
  "Northern Ridge",
  "Old Town Run",
  "Airport Shuttle",
  "Lakeside Circuit",
];

const STATUSES = ["primary", "secondary", "success", "error"];

function seededPick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

function randomDrift(scale) {
  return (Math.random() - 0.5) * scale;
}

function statusMaybeFlip(status) {
  // Keep stable most of the time; occasional change.
  if (Math.random() < 0.04) {
    const pool = STATUSES.filter((s) => s !== status);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return status;
}

/**
 * Global region seeds with realistic lat/lng bounds.
 * Each mock user is assigned a home region; during mock ticks they drift within that region
 * to maintain geographic diversity at world zoom.
 */
const REGIONS = [
  {
    key: "northAmerica",
    label: "North America",
    // NYC-ish corridor
    center: { lat: 40.7128, lng: -74.006 },
    bounds: { minLat: 34, maxLat: 49, minLng: -125, maxLng: -66 },
  },
  {
    key: "southAmerica",
    label: "South America",
    // São Paulo-ish
    center: { lat: -23.5505, lng: -46.6333 },
    bounds: { minLat: -56, maxLat: 12, minLng: -82, maxLng: -34 },
  },
  {
    key: "europe",
    label: "Europe",
    // Paris-ish
    center: { lat: 48.8566, lng: 2.3522 },
    bounds: { minLat: 36, maxLat: 60, minLng: -10, maxLng: 30 },
  },
  {
    key: "africa",
    label: "Africa",
    // Nairobi-ish
    center: { lat: -1.2864, lng: 36.8172 },
    bounds: { minLat: -35, maxLat: 37, minLng: -17, maxLng: 52 },
  },
  {
    key: "middleEast",
    label: "Middle East",
    // Dubai-ish
    center: { lat: 25.2048, lng: 55.2708 },
    bounds: { minLat: 12, maxLat: 40, minLng: 34, maxLng: 62 },
  },
  {
    key: "southAsia",
    label: "South Asia",
    // Delhi-ish
    center: { lat: 28.6139, lng: 77.209 },
    bounds: { minLat: 5, maxLat: 36, minLng: 66, maxLng: 93 },
  },
  {
    key: "eastAsia",
    label: "East Asia",
    // Tokyo-ish
    center: { lat: 35.6762, lng: 139.6503 },
    bounds: { minLat: 20, maxLat: 46, minLng: 100, maxLng: 147 },
  },
  {
    key: "oceania",
    label: "Oceania",
    // Sydney-ish
    center: { lat: -33.8688, lng: 151.2093 },
    bounds: { minLat: -48, maxLat: -10, minLng: 112, maxLng: 180 },
  },
];

// A gentle per-tick drift (degrees). Chosen so users visibly move without teleporting.
const DRIFT_DEGREES = 0.08;

// PUBLIC_INTERFACE
export function createMockUsers() {
  /** Seed a deterministic-ish set of users with route progress and globally distributed coordinates. */
  const now = new Date();
  const base = [
    { id: "u1", name: "Avery Kim" },
    { id: "u2", name: "Jordan Lee" },
    { id: "u3", name: "Morgan Patel" },
    { id: "u4", name: "Sam Rivera" },
    { id: "u5", name: "Taylor Chen" },
    { id: "u6", name: "Casey Okafor" },
    { id: "u7", name: "Riley Haddad" },
    { id: "u8", name: "Noor Singh" },
  ];

  return base.map((u, idx) => {
    const completion = clamp(0.12 + idx * 0.09, 0, 0.95);
    const speed = 3.8 + idx * 0.55; // m/s
    const eta = addMinutes(now, 42 - idx * 3);

    const region = REGIONS[idx % REGIONS.length];
    // Slight per-user offset from the region center so they are not identical.
    const lat = clamp(
      region.center.lat + randomDrift(1.35),
      region.bounds.minLat,
      region.bounds.maxLat
    );
    const lng = clamp(
      region.center.lng + randomDrift(1.35),
      region.bounds.minLng,
      region.bounds.maxLng
    );

    return {
      id: u.id,
      name: u.name,
      routeName: seededPick(ROUTES, idx),
      lat,
      lng,
      speed,
      etaIso: eta.toISOString(),
      completion,
      status: seededPick(STATUSES, idx),
      // Keep the assigned region to constrain movement realistically.
      regionKey: region.key,
    };
  });
}

function getRegionForUser(user) {
  const key = user?.regionKey;
  const region = REGIONS.find((r) => r.key === key);
  return region || REGIONS[0];
}

// PUBLIC_INTERFACE
export function evolveMockUser(user) {
  /** Return a new user state with slight movement + progress + updated ETA (constrained within a regional bounding box). */
  const nextCompletion = clamp(user.completion + (0.003 + Math.random() * 0.01), 0, 1);
  const nextSpeed = clamp(user.speed + randomDrift(0.35), 0.6, 12.0);

  const etaDate = new Date(user.etaIso || Date.now());
  const nextEta = addMinutes(etaDate, -0.35 - Math.random() * 0.5);

  const region = getRegionForUser(user);

  // Gentle "route progress" drift, constrained to the user's region bounds.
  // We keep the drift small to avoid crossing continents over time.
  const nextLat = clamp(user.lat + randomDrift(DRIFT_DEGREES), region.bounds.minLat, region.bounds.maxLat);
  const nextLng = clamp(user.lng + randomDrift(DRIFT_DEGREES), region.bounds.minLng, region.bounds.maxLng);

  return {
    ...user,
    lat: nextLat,
    lng: nextLng,
    speed: nextSpeed,
    completion: nextCompletion,
    etaIso: nextEta.toISOString(),
    status: statusMaybeFlip(user.status),
    regionKey: region.key,
  };
}
