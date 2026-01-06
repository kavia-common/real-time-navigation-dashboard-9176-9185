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
];

const STATUSES = ["primary", "secondary", "success", "error"];

function seededPick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

// PUBLIC_INTERFACE
export function createMockUsers() {
  /** Seed a deterministic-ish set of users with route progress. */
  const now = new Date();
  const base = [
    { id: "u1", name: "Avery Kim" },
    { id: "u2", name: "Jordan Lee" },
    { id: "u3", name: "Morgan Patel" },
    { id: "u4", name: "Sam Rivera" },
    { id: "u5", name: "Taylor Chen" },
  ];

  return base.map((u, idx) => {
    const completion = clamp(0.15 + idx * 0.12, 0, 0.95);
    const speed = 4.2 + idx * 0.65; // m/s
    const eta = addMinutes(now, 35 - idx * 4);
    return {
      id: u.id,
      name: u.name,
      routeName: seededPick(ROUTES, idx),
      lat: 37.78 + idx * 0.01,
      lng: -122.45 + idx * 0.012,
      speed,
      etaIso: eta.toISOString(),
      completion,
      status: seededPick(STATUSES, idx),
    };
  });
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

// PUBLIC_INTERFACE
export function evolveMockUser(user) {
  /** Return a new user state with slight movement + progress + updated ETA. */
  const nextCompletion = clamp(user.completion + (0.003 + Math.random() * 0.01), 0, 1);
  const nextSpeed = clamp(user.speed + randomDrift(0.35), 0.6, 12.0);

  const etaDate = new Date(user.etaIso || Date.now());
  const nextEta = addMinutes(etaDate, -0.35 - Math.random() * 0.5);

  // Drift positions and keep in a small bounding box around SF-ish coordinates.
  const nextLat = clamp(user.lat + randomDrift(0.0022), 37.72, 37.83);
  const nextLng = clamp(user.lng + randomDrift(0.0022), -122.52, -122.37);

  return {
    ...user,
    lat: nextLat,
    lng: nextLng,
    speed: nextSpeed,
    completion: nextCompletion,
    etaIso: nextEta.toISOString(),
    status: statusMaybeFlip(user.status),
  };
}
