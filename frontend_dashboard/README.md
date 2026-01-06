# Real-time Navigation Dashboard (Frontend)

A lightweight React dashboard UI for multi-user navigation and route progress tracking.

## Features

- Top navigation bar with connection status and controls
- Left panel: interactive **map placeholder** (no heavy map deps)
  - Renders user markers based on lat/lng normalized to the viewport
  - Keyboard accessible (focus map, arrow keys to pan; +/- to zoom)
  - Markers show tooltip with speed, ETA, completion, status
- Right panel: scrollable progress list
  - Avatar/initials, route name, completion bar, ETA, speed, status pill
  - Sorting and filtering (via top bar)
- Real-time updates:
  - **Live WebSocket** if `REACT_APP_WS_URL` is set
  - Otherwise runs in **mock mode** with timers and drifting coordinates

## Environment configuration (optional)

The app runs without any env vars; it will seed mock users automatically.

Set any of the following in `.env`:

- `REACT_APP_WS_URL` — WebSocket URL for live updates.
  - Expected message JSON shape:
    ```json
    { "id": "u1", "name": "Avery Kim", "lat": 37.78, "lng": -122.45, "speed": 4.2, "etaIso": "2026-01-06T12:30:00.000Z", "completion": 0.42, "status": "primary" }
    ```
  - `status` supports: `primary | secondary | success | error`

- `REACT_APP_API_BASE` or `REACT_APP_BACKEND_URL` — Optional REST base URL to fetch initial users.
  - Best-effort GET request to: `GET {base}/users`
  - If unavailable, the UI falls back to mock users.

## Switching between mock/live

Use the **Mode** toggle in the top bar:
- Mode: Mock — local simulation
- Mode: Live — connects to WebSocket (if configured)

Use **Refresh** to reconnect/restart updates.

## Notes

- The map is intentionally implemented as a swap-friendly placeholder component (`src/components/MapContainer.js`).
  You can later replace it with Leaflet/MapLibre/etc. with minimal changes.
