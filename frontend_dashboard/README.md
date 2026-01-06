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

- `REACT_APP_GOOGLE_MAPS_API_KEY` — Optional. If set (non-empty) **and** Mode is **Live**, the left panel renders an actual Google Map using `@react-google-maps/api`.
  - If missing/empty (or Mode is Mock), the dashboard uses the built-in mock map renderer (no external calls).
  - Do **not** hardcode keys in code. Put the key in `.env` for local dev.

## Switching between mock/live

Use the **Mode** toggle in the top bar:
- Mode: Mock — local simulation
- Mode: Live — connects to WebSocket (if configured)

Use **Refresh** to reconnect/restart updates.

## Demo map mode (Mock Google Map)

Use the **Demo** toggle in the top bar:
- Demo: On — forces the **Mock Google Map** renderer (no external APIs), even if a Google Maps key is configured.
- Demo: Off — returns to **Auto** behavior (Google when `REACT_APP_GOOGLE_MAPS_API_KEY` is set and Mode is Live; otherwise Mock).

The mock renderer visually mimics a map canvas with:
- subtle grid/tiles + compass hint
- smooth pan/zoom (drag, scroll, +/- keys)
- accessible markers with status rings and hover tooltips (name, speed, ETA)
- **more noticeable** mock movement (slightly larger drift) with **smooth marker tweening**
- subtle **pulse** + **trail** effect (respects `prefers-reduced-motion`)
- lightweight clustering when users are very close

### Demo behavior note

In Mock mode, the demo defaults to a **world map viewport** and seeds **globally distributed mock users** (across multiple regions). The map will auto-fit to include all current users.

## Area labeling (offline, approximate)

The UI shows an **Area** label for each user (in marker tooltips and the progress list). This is computed **offline** with a small, dependency-free lookup (`src/utils/geoRegion.js`):

- If the user is near a built-in sample city, it shows **City, Country** (e.g., `Berlin, Germany`)
- Otherwise it tries to infer a **Country** from coarse bounding boxes
- Otherwise it falls back to a **continent/region** label

No network calls are made for labels.

## Notes

- The map is intentionally implemented as a swap-friendly placeholder component (`src/components/MapContainer.js`).
  You can later replace it with Leaflet/MapLibre/etc. with minimal changes.
