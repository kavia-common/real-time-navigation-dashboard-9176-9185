function safeTrim(v) {
  return (v || "").trim();
}

// PUBLIC_INTERFACE
export function getEnvConfig() {
  /** Read CRA runtime env vars with safe defaults. */
  const wsUrl = process.env.REACT_APP_WS_URL || "";
  const apiBase = process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL || "";
  return {
    wsUrl: safeTrim(wsUrl),
    apiBase: safeTrim(apiBase),
  };
}

// PUBLIC_INTERFACE
export function getGoogleMapsKey() {
  /** Optional Google Maps key (empty string when not configured). */
  return safeTrim(process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
}
