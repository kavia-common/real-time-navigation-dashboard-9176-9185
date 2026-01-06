import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { useDashboard } from "../store/dashboardStore";
import { getGoogleMapsKey } from "../utils/env";
import { getAreaLabel } from "../utils/geoRegion";
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
  // Slightly elevated dot marker with a white ring.
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeBoundsFromUsers(users) {
  if (!users.length) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
  }
  const lats = users.map((u) => u.lat);
  const lngs = users.map((u) => u.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return { minLat, maxLat, minLng, maxLng };
}

function getCenterFromBounds(bounds) {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

function estimateWorldZoomFromBounds(bounds) {
  // Span-based heuristic tuned for world scale.
  const latSpan = Math.max(0.0001, Math.abs(bounds.maxLat - bounds.minLat));
  const lngSpan = Math.max(0.0001, Math.abs(bounds.maxLng - bounds.minLng));
  const span = Math.max(latSpan, lngSpan);

  if (span > 220) return 2;
  if (span > 160) return 3;
  if (span > 110) return 4;
  if (span > 70) return 5;
  if (span > 45) return 6;
  if (span > 25) return 7;
  if (span > 14) return 8;
  if (span > 7) return 9;
  if (span > 3) return 10;
  if (span > 1.5) return 11;
  if (span > 0.75) return 12;
  return 13;
}

function computeFitCenterZoom(users) {
  // World default: show all continents when there are no users.
  if (!users.length) return { center: { lat: 15, lng: 0 }, zoom: 2 };

  const b = computeBoundsFromUsers(users);

  // Add padding so markers aren't on the edge. Clamp to plausible world bounds.
  const padLat = 6;
  const padLng = 10;

  const padded = {
    minLat: clamp(b.minLat - padLat, -85, 85),
    maxLat: clamp(b.maxLat + padLat, -85, 85),
    minLng: clamp(b.minLng - padLng, -180, 180),
    maxLng: clamp(b.maxLng + padLng, -180, 180),
  };

  return {
    center: getCenterFromBounds(padded),
    zoom: clamp(estimateWorldZoomFromBounds(padded), 2, 14),
  };
}

function computeLabelKey(users) {
  // Round to reduce churn while users drift; good enough for ~city/country level labeling.
  return (users || [])
    .map((u) => `${u.id}:${(u.lat || 0).toFixed(2)}:${(u.lng || 0).toFixed(2)}`)
    .join("|");
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

  if (!enabled) return children({ isLoaded: false, loadError: null });
  return children({ isLoaded, loadError });
}

function GoogleMapView({ users, labelsById, fitSignal }) {
  // Keep a stable map instance so we can fit bounds / pan without re-creating.
  const mapRef = useRef(null);

  const fitToUsers = useCallback(() => {
    if (!mapRef.current) return;
    if (!window.google?.maps) return;

    if (!users.length) {
      mapRef.current.setCenter({ lat: 15, lng: 0 });
      mapRef.current.setZoom(2);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    for (const u of users) bounds.extend({ lat: u.lat, lng: u.lng });

    mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [users]);

  // Fit bounds on mount and whenever user set changes.
  useEffect(() => {
    fitToUsers();
  }, [fitToUsers]);

  // Fit-to-users control trigger.
  useEffect(() => {
    if (fitSignal > 0) fitToUsers();
  }, [fitSignal, fitToUsers]);

  const mapOptions = useMemo(() => {
    return {
      disableDefaultUI: true,
      clickableIcons: false,
      // Requested: default, clean basemap => no custom styling; use standard roadmap.
      mapTypeId: "roadmap",
    };
  }, []);

  // Provide a safe initial world view while Google computes fitBounds.
  const initial = useMemo(() => computeFitCenterZoom(users), [users]);

  return (
    <>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={initial.center}
        zoom={initial.zoom}
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
          const area = labelsById[u.id] || "Unknown area";

          return (
            <MarkerF
              key={u.id}
              position={{ lat: u.lat, lng: u.lng }}
              title={`${u.name} • ${area}`}
              icon={{
                url: iconUrl,
                scaledSize: window.google?.maps ? new window.google.maps.Size(34, 34) : undefined,
                anchor: window.google?.maps ? new window.google.maps.Point(17, 17) : undefined,
              }}
            />
          );
        })}
      </GoogleMap>

      <div className="MapOverlayTop" aria-hidden="true">
        <div className="MapOverlayChip">Google Map • World view • Markers update in real-time</div>
      </div>
    </>
  );
}

// PUBLIC_INTERFACE
export function MapContainer() {
  /** Map renderer that swaps between mock map and Google Maps depending on demo toggle, mode, and key. */
  const { users, mode, mapMode } = useDashboard();
  const apiKey = getGoogleMapsKey();

  // Local "fit" center/zoom for the mock map so we can auto-frame the fleet.
  const [fitView, setFitView] = useState(() => computeFitCenterZoom(users));
  const [fitSignal, setFitSignal] = useState(0);

  // Map UI state for better feedback when something goes wrong.
  const [mapError, setMapError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setFitView(computeFitCenterZoom(users));
  }, [users]);

  // Mark as mounted after first paint so skeleton can appear briefly (helps detect layout issues).
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  // Offline area labels (throttled).
  const [labelsById, setLabelsById] = useState(() => ({}));
  const labelKey = useMemo(() => computeLabelKey(users), [users]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = {};
      for (const u of users) {
        next[u.id] = getAreaLabel(u.lat, u.lng);
      }
      setLabelsById(next);
    }, 750); // throttle to avoid excessive recalcs as markers drift
    return () => window.clearTimeout(t);
  }, [labelKey, users]);

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
      areaLabel: labelsById[u.id] || "Unknown area",
    }));
  }, [labelsById, users]);

  const onFitToUsers = useCallback(() => {
    // - For Mock: push center/zoom via props
    // - For Google: toggle a signal observed by GoogleMapView (imperative fitBounds)
    setFitView(computeFitCenterZoom(users));
    setFitSignal((n) => n + 1);
  }, [users]);

  const renderMock = useCallback(() => {
    try {
      return (
        <MockGoogleMap
          center={fitView.center}
          zoom={fitView.zoom}
          markers={markers}
          onMarkerClick={() => {}}
        />
      );
    } catch (e) {
      // Extremely defensive: render error banner instead of blank panel.
      setMapError("Mock map failed to render.");
      return null;
    }
  }, [fitView.center, fitView.zoom, markers]);

  return (
    <div className="MapWrap" aria-label="Map wrapper">
      <div className="MapTopControls" aria-label="Map controls">
        <button type="button" className="Button" onClick={onFitToUsers} aria-label="Fit map to users">
          Fit to users
        </button>
      </div>

      {/* Shared viewport wrapper ensures a guaranteed visible area and consistent overlay stacking */}
      <div className="MapViewport" role="region" aria-label="Live map viewport">
        {/* Skeleton: visible while Google script loads OR initial mount */}
        {!mounted || (googleEnabled && !mapError) ? (
          googleEnabled && mounted ? null : (
            <div className="MapSkeleton" aria-hidden="true">
              <div className="MapSkeletonInner">Loading map…</div>
            </div>
          )
        ) : null}

        <MapProvider enabled={googleEnabled} apiKey={apiKey}>
          {({ isLoaded, loadError }) => {
            // If Google is requested but we hit a loader error, show a banner and fall back to mock.
            if (googleEnabled && loadError) {
              if (!mapError) setMapError("Google Maps failed to load. Falling back to the mock map.");
              return renderMock();
            }

            // If Google enabled and loaded, render the actual Google map (and clear previous error if any).
            if (googleEnabled && isLoaded) {
              if (mapError) setMapError("");
              try {
                return <GoogleMapView users={users} labelsById={labelsById} fitSignal={fitSignal} />;
              } catch (e) {
                if (!mapError) setMapError("Google map failed to initialize. Falling back to the mock map.");
                return renderMock();
              }
            }

            // Default: mock map (world view by default).
            if (mapError) setMapError("");
            return renderMock();
          }}
        </MapProvider>

        {mapError ? (
          <div className="MapErrorBanner" role="status" aria-live="polite">
            <div>
              <strong>Map rendering issue</strong>
              <span>{mapError}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" className="Button" onClick={onFitToUsers} aria-label="Retry fit to users">
                Retry
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
