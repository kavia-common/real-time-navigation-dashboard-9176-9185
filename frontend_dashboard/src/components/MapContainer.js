import React, { useEffect, useMemo, useRef } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { useDashboard } from "../store/dashboardStore";
import { getGoogleMapsKey } from "../utils/env";
import { MockGoogleMap } from "./map/MockGoogleMap";

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
                scaledSize: window.google?.maps ? new window.google.maps.Size(34, 34) : undefined,
                anchor: window.google?.maps ? new window.google.maps.Point(17, 17) : undefined,
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
  /** Map renderer that swaps between mock map and Google Maps depending on demo toggle, mode, and key. */
  const { users, mode, mapMode } = useDashboard();
  const apiKey = getGoogleMapsKey();

  const bounds = useMemo(() => computeBounds(users), [users]);
  const center = useMemo(() => getCenterFromBounds(bounds), [bounds]);
  const zoom = useMemo(() => estimateZoomFromBounds(bounds), [bounds]);

  // Rendering rules:
  // - Demo forces mock, even if key exists.
  // - Otherwise, use Google only when key exists AND mode is live.
  const demoForced = mapMode === "demo";
  const googleEnabled = !demoForced && Boolean(apiKey) && mode === "live";

  const markers = useMemo(() => {
    return users.map((u) => ({
      id: u.id,
      lat: u.lat,
      lng: u.lng,
      name: u.name,
      status: u.status,
      speed: u.speed,
      etaIso: u.etaIso,
    }));
  }, [users]);

  return (
    <MapProvider enabled={googleEnabled} apiKey={apiKey}>
      {({ isLoaded, loadError }) => {
        if (googleEnabled && loadError) {
          return (
            <MockGoogleMap
              center={center}
              zoom={zoom}
              markers={markers}
              onMarkerClick={() => {}}
            />
          );
        }
        if (googleEnabled && isLoaded) {
          return <GoogleMapView users={users} />;
        }

        // Mock always available (no external calls).
        return (
          <MockGoogleMap
            center={center}
            zoom={zoom}
            markers={markers}
            onMarkerClick={() => {}}
          />
        );
      }}
    </MapProvider>
  );
}
