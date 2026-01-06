// PUBLIC_INTERFACE
export function formatSpeed(speedMps) {
  /** Format speed in m/s into km/h with a friendly fallback. */
  if (typeof speedMps !== "number" || Number.isNaN(speedMps)) return "—";
  const kmh = speedMps * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

// PUBLIC_INTERFACE
export function formatPercent(value01) {
  /** Format 0..1 progress into percent string. */
  if (typeof value01 !== "number" || Number.isNaN(value01)) return "—";
  const pct = Math.max(0, Math.min(1, value01)) * 100;
  return `${pct.toFixed(0)}%`;
}

// PUBLIC_INTERFACE
export function parseEtaToDate(etaIso) {
  /** Parse etaIso into a Date, returning null if invalid. */
  if (!etaIso || typeof etaIso !== "string") return null;
  const d = new Date(etaIso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// PUBLIC_INTERFACE
export function formatEta(etaIso) {
  /** Format ETA ISO into relative minutes if possible, otherwise local time. */
  const d = parseEtaToDate(etaIso);
  if (!d) return "—";
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Number.isFinite(diffMin) && Math.abs(diffMin) < 600) {
    if (diffMin <= 0) return "Now";
    return `${diffMin} min`;
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// PUBLIC_INTERFACE
export function getInitials(name) {
  /** Get initials from a display name. */
  const s = (name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).slice(0, 2);
  const initials = parts.map((p) => p[0]).join("");
  return initials.toUpperCase();
}
