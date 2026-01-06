import React, { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { useDashboard } from "../store/dashboardStore";
import { getGoogleMapsKey } from "../utils/env";
import { UserMarker } from "./UserMarker";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function statusToThemeColor(status) {
  // Match StatusBadge mapping:
  // primary: --color-primary, secondary/success: --color-secondary/--color-success, error: --color-error
  if (status === "error") return "#ef4444";
  if (status === "success") return "#f59e0b";
  if (status === "secondary") return "#f59e0b";
  return "#2563eb";
}

function makeDotIconSvgHex(hex) {
  // Slightly elevated dot marker with a white ring, tuned for the Ocean Professional theme.
  // Using inline SVG avoids any extra assets.
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <defs>
      <filter id="ds" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="rgba(17,24,39,0.22)"/>
      </filter>
    </defs>
    <g filter="url(#ds)">
      <circle cx="17" cy="17" r="10.5" fill="${hex}" />
      <circle cx="17" cy="17" r="10.5" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="3"/>
    </g>
  </svg>`.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function computeBounds(users) {
  if (!users.length) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
  }
  const lats = users.map((u) => u.lat);
  const lngs = users.map((u) => u.lng);
  const padLat = 0.01;
  const padLng = 0.01;
  const minLat = Math.min(...lats) - padLat;
  const maxLat = Math.max(...lats) + padLat;
  const minLng = Math.min(...lngs) - padLng;
  const maxLng = Math.max(...lngs) + padLng;
  return { minLat, maxLat, minLng, maxLng };
}

function getCenterFromBounds(bounds) {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

function estimateZoomFromBounds(bounds) {
  // Lightweight heuristic for a pleasant default. (We avoid calling google.maps.* here
  // so the component still renders fine in mock/no-network environments.)
  const latSpan = Math.max(0.0001, Math.abs(bounds.maxLat - bounds.minLat));
  const lngSpan = Math.max(0.0001, Math.abs(bounds.maxLng - bounds.minLng));
  const span = Math.max(latSpan, lngSpan);
  if (span > 3) return 6;
  if (span > 1.5) return 7;
  if (span > 0.75) return 8;
  if (span > 0.35) return 9;
  if (span > 0.18) return 10;
  if (span > 0.09) return 11;
  if (span > 0.045) return 12;
  return 13;
}

// PUBLIC_INTERFACE
export function MapProvider({ enabled, apiKey, children }) {
  /** Loads Google Maps script when enabled; otherwise renders children without external calls. */
  const { isLoaded, loadError } = useJsApiLoader(
    enabled
      ? {
          id: "google-map-script",
          googleMapsApiKey: apiKey,
        }
      : // When disabled, never attempt to load external scripts.
        { id: "google-map-script", googleMapsApiKey: "" }
  );

  // If we're not enabled, we deliberately render children immediately.
  if (!enabled) return children({ isLoaded: false, loadError: null });

  // If enabled but script can't load, fall back to mock (no external calls after error).
  // Note: useJsApiLoader will have already attempted a network request; this is still safe,
  // and keeps the app usable.
  return children({ isLoaded, loadError });
}

function MockMap({ users }) {
  // Minimal placeholder "zoom/pan" state (purely visual scaling/offset)
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const bounds = useMemo(() => computeBounds(users), [users]);

  const project = (lat, lng) => {
    const { minLat, maxLat, minLng, maxLng } = bounds;
    const x01 = (lng - minLng) / (maxLng - minLng || 1);
    const y01 = 1 - (lat - minLat) / (maxLat - minLat || 1);
    return { x01: clamp(x01, 0, 1), y01: clamp(y01, 0, 1) };
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const next = clamp(zoom + (e.deltaY < 0 ? 0.08 : -0.08), 0.85, 1.6);
    setZoom(next);
  };

  const nudge = (dx, dy) => {
    setOffset((p) => ({ x: clamp(p.x + dx, -80, 80), y: clamp(p.y + dy, -80, 80) }));
  };

  return (
    <div
      className="MapViewport"
      role="region"
      aria-label="Interactive map placeholder"
      onWheel={handleWheel}
      tabIndex={0}
      onKeyDown={(e) => {
        // Keyboard nudge for accessibility
        if (e.key === "ArrowLeft") nudge(-10, 0);
        if (e.key === "ArrowRight") nudge(10, 0);
        if (e.key === "ArrowUp") nudge(0, -10);
        if (e.key === "ArrowDown") nudge(0, 10);
        if (e.key === "+" || e.key === "=") setZoom((z) => clamp(z + 0.08, 0.85, 1.6));
        if (e.key === "-") setZoom((z) => clamp(z - 0.08, 0.85, 1.6));
      }}
      style={{
        outline: "none",
      }}
    >
      <div className="MapGrid" aria-hidden="true" />

      <div className="MapOverlayTop" aria-hidden="true">
        <div className="MapOverlayChip">Scroll to zoom • Arrow keys to pan</div>
        <div className="MapOverlayChip">
          Zoom: <strong style={{ color: "var(--color-text)" }}>{zoom.toFixed(2)}×</strong>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: "transform 120ms ease",
        }}
      >
        {users.map((u) => {
          const { x01, y01 } = project(u.lat, u.lng);
          return <UserMarker key={u.id} user={u} x01={x01} y01={y01} />;
        })}
      </div>
    </div>
  );
}

function GoogleMapView({ users }) {
  const bounds = useMemo(() => computeBounds(users), [users]);
  const center = useMemo(() => getCenterFromBounds(bounds), [bounds]);
  const zoom = useMemo(() => estimateZoomFromBounds(bounds), [bounds]);

  // Keep a stable map instance so we can pan without re-creating.
  const mapRef = useRef(null);

  // If markers move, keep the map gently centered on the overall fleet.
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      mapRef.current.panTo(center);
    } catch {
      // ignore
    }
  }, [center]);

  const mapOptions = useMemo(() => {
    return {
      disableDefaultUI: true,
      clickableIcons: false,
      // Keep the look subdued so it matches the Ocean Professional theme.
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
      ],
    };
  }, []);

  return (
    <div className="MapViewport" role="region" aria-label="Google map">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={zoom}
        options={mapOptions}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
      >
        {users.map((u) => {
          const hex = statusToThemeColor((u.status || "primary").toLowerCase());
          const iconUrl = makeDotIconSvgHex(hex);

          return (
            <MarkerF
              key={u.id}
              position={{ lat: u.lat, lng: u.lng }}
              title={u.name}
              icon={{
                url: iconUrl,
                scaledSize: window.google?.maps
                  ? new window.google.maps.Size(34, 34)
                  : undefined,
                anchor: window.google?.maps
                  ? new window.google.maps.Point(17, 17)
                  : undefined,
              }}
            />
          );
        })}
      </GoogleMap>

      {/* Keep a subtle overlay consistent with the mock map affordances */}
      <div className="MapOverlayTop" aria-hidden="true">
        <div className="MapOverlayChip">Google Map • Markers update in real-time</div>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export function MapContainer() {
  /** Map renderer that swaps between mock placeholder and Google Maps depending on mode and key. */
  const { users, mode } = useDashboard();
  const apiKey = getGoogleMapsKey();

  // Use Google Maps only when:
  // - mode is live, AND
  // - key is configured
  const googleEnabled = Boolean(apiKey) && mode === "live";

  return (
    <MapProvider enabled={googleEnabled} apiKey={apiKey}>
      {({ isLoaded, loadError }) => {
        if (googleEnabled && loadError) {
          // Google failed to load; keep app functional by rendering mock instead.
          return <MockMap users={users} />;
        }
        if (googleEnabled && isLoaded) {
          return <GoogleMapView users={users} />;
        }
        return <MockMap users={users} />;
      }}
    </MapProvider>
  );
}
