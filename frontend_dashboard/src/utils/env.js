// PUBLIC_INTERFACE
export function getEnvConfig() {
  /** Read CRA runtime env vars with safe defaults. */
  const wsUrl = process.env.REACT_APP_WS_URL || "";
  const apiBase = process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL || "";
  return {
    wsUrl: wsUrl.trim(),
    apiBase: apiBase.trim(),
  };
}
