import React, { useMemo, useState } from "react";
import { useDashboard } from "../store/dashboardStore";
import { UserMarker } from "./UserMarker";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// PUBLIC_INTERFACE
export function MapContainer() {
  /** Lightweight map placeholder that renders markers based on lat/lng normalized to viewport. */
  const { users } = useDashboard();

  // Minimal placeholder "zoom/pan" state (purely visual scaling/offset)
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const bounds = useMemo(() => {
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
  }, [users]);

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
