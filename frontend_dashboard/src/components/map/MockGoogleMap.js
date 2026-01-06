import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./mockMap.css";
import { formatEta, formatSpeed, getInitials } from "../../utils/format";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function statusToColorVar(status) {
  const s = (status || "primary").toLowerCase();
  if (s === "error") return "var(--color-error)";
  if (s === "success") return "var(--color-success)";
  if (s === "secondary") return "var(--color-secondary)";
  return "var(--color-primary)";
}

function normalizeUsersBounds(markers) {
  if (!markers || !markers.length) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
  }
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  const padLat = 0.01;
  const padLng = 0.01;
  return {
    minLat: Math.min(...lats) - padLat,
    maxLat: Math.max(...lats) + padLat,
    minLng: Math.min(...lngs) - padLng,
    maxLng: Math.max(...lngs) + padLng,
  };
}

function zoomToScale(zoom) {
  // Support a "world" view as well as street-level.
  // We keep transforms modest so panning/zooming stays smooth.
  const z = typeof zoom === "number" ? zoom : 3;

  // Base scale at zoom=3 is ~1. Increase gradually; cap to avoid huge DOM scaling.
  const t = clamp((z - 3) / 10, 0, 1); // 0..1 for [3..13]
  return 1 + t * 1.25; // 1..2.25
}

function computeMockBounds(center, zoom, viewportPx) {
  // Heuristic: span shrinks as zoom increases; aspect preserved by viewport.
  // We tune it so zoom ~2-3 shows most of the world; zoom ~10-14 is city-level.
  const z = typeof zoom === "number" ? zoom : 3;
  const h = Math.max(200, viewportPx?.h || 600);
  const w = Math.max(200, viewportPx?.w || 800);

  // At zoom=3 we show a large portion of the globe.
  const baseLatSpan = 170; // degrees
  const baseLngSpan = 330; // degrees (wider than lat)

  // Each zoom step reduces the span significantly (similar "feel" to web maps).
  const factor = Math.pow(0.62, z - 3);
  const latSpan = clamp(baseLatSpan * factor, 0.05, 180);
  const lngSpan = clamp(baseLngSpan * factor * (w / h), 0.05, 360);

  return {
    minLat: center.lat - latSpan / 2,
    maxLat: center.lat + latSpan / 2,
    minLng: center.lng - lngSpan / 2,
    maxLng: center.lng + lngSpan / 2,
  };
}

function projectLatLngTo01(lat, lng, bounds) {
  const x01 = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1);
  const y01 = 1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1);
  return { x01: clamp(x01, 0, 1), y01: clamp(y01, 0, 1) };
}

function unproject01ToLatLng(x01, y01, bounds) {
  const lng = bounds.minLng + x01 * (bounds.maxLng - bounds.minLng || 1);
  const lat = bounds.minLat + (1 - y01) * (bounds.maxLat - bounds.minLat || 1);
  return { lat, lng };
}

function hashToHue(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function avatarGradientForId(id) {
  const hue = hashToHue(String(id || "x"));
  return `linear-gradient(135deg, hsla(${hue}, 82%, 70%, 0.95), hsla(${(hue + 38) % 360}, 78%, 62%, 0.95))`;
}

function clusterKeyForCell(x01, y01, cell) {
  const cx = Math.floor(x01 / cell);
  const cy = Math.floor(y01 / cell);
  return `${cx}:${cy}`;
}

function computeClusters(markersWithXY, zoom) {
  // Simple clustering: at world zoom, cluster more aggressively; decluster as you zoom in.
  const z = typeof zoom === "number" ? zoom : 3;

  // Bigger cell => more clustering. Keep "single" markers dominant by z~8+.
  const cell =
    z <= 3 ? 0.22 :
    z <= 4 ? 0.18 :
    z <= 5 ? 0.14 :
    z <= 6 ? 0.10 :
    z <= 7 ? 0.075 :
    z <= 9 ? 0.055 :
    0.038;

  const buckets = new Map();
  for (const m of markersWithXY) {
    const key = clusterKeyForCell(m.x01, m.y01, cell);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  }

  const clusters = [];
  for (const [, items] of buckets.entries()) {
    if (items.length === 1) {
      clusters.push({ type: "single", items, x01: items[0].x01, y01: items[0].y01 });
      continue;
    }
    // Cluster center is average position.
    const x01 = items.reduce((s, it) => s + it.x01, 0) / items.length;
    const y01 = items.reduce((s, it) => s + it.y01, 0) / items.length;
    clusters.push({ type: "cluster", items, x01, y01 });
  }

  return clusters;
}

function applyOverlapOffsets(clusters) {
  // Very small overlap avoidance: if multiple clusters end up too close, nudge them.
  // Keeps demo feeling "alive" without complex collision detection.
  const out = clusters.map((c) => ({ ...c, ox: 0, oy: 0 }));
  const minDist = 0.03;

  for (let i = 0; i < out.length; i += 1) {
    for (let j = i + 1; j < out.length; j += 1) {
      const a = out[i];
      const b = out[j];
      const dx = (b.x01 + b.ox) - (a.x01 + a.ox);
      const dy = (b.y01 + b.oy) - (a.y01 + a.oy);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0 && d < minDist) {
        const push = (minDist - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.ox -= nx * push;
        a.oy -= ny * push;
        b.ox += nx * push;
        b.oy += ny * push;
      }
    }
  }

  return out.map((c) => ({ ...c, x01: clamp(c.x01 + c.ox, 0, 1), y01: clamp(c.y01 + c.oy, 0, 1) }));
}

/**
 * Smoothly tween per-marker positions to increase perceived motion without teleporting.
 * This is intentionally lightweight (no deps) and only uses rAF while targets differ.
 */
function useMarkerTween(targets, { durationMs = 520 } = {}) {
  const rafRef = useRef(null);
  const stateRef = useRef(new Map()); // id -> { x, y, tx, ty, startX, startY, startTs }
  const [renderTick, setRenderTick] = useState(0);

  const targetsKey = useMemo(() => {
    // Keep stable ordering so useEffect can diff cheaply.
    return (targets || []).map((t) => `${t.id}:${t.x01.toFixed(4)}:${t.y01.toFixed(4)}`).join("|");
  }, [targets]);

  useEffect(() => {
    const m = stateRef.current;
    const now = performance.now();

    // Mark new targets / update existing targets.
    for (const t of targets || []) {
      const existing = m.get(t.id);
      if (!existing) {
        m.set(t.id, {
          x: t.x01,
          y: t.y01,
          tx: t.x01,
          ty: t.y01,
          startX: t.x01,
          startY: t.y01,
          startTs: now,
          changedAt: now,
        });
        continue;
      }

      // Update target and restart tween if moved meaningfully.
      const moved = Math.abs(existing.tx - t.x01) + Math.abs(existing.ty - t.y01) > 0.0001;
      if (moved) {
        m.set(t.id, {
          ...existing,
          tx: t.x01,
          ty: t.y01,
          startX: existing.x,
          startY: existing.y,
          startTs: now,
          changedAt: now,
        });
      }
    }

    // Remove stale ids.
    const ids = new Set((targets || []).map((t) => t.id));
    for (const id of m.keys()) {
      if (!ids.has(id)) m.delete(id);
    }

    // rAF loop only while something is animating.
    const step = (ts) => {
      let anyAnimating = false;
      for (const [id, s] of m.entries()) {
        const t = clamp((ts - s.startTs) / durationMs, 0, 1);
        // easeInOutCubic for slightly more "dynamic" movement.
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const nx = s.startX + (s.tx - s.startX) * eased;
        const ny = s.startY + (s.ty - s.startY) * eased;

        // Keep for rendering.
        m.set(id, { ...s, x: nx, y: ny });

        if (t < 1) anyAnimating = true;
      }

      setRenderTick((k) => (k + 1) % 1000000);

      if (anyAnimating) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    if (!rafRef.current) {
      rafRef.current = window.requestAnimationFrame(step);
    }

    return () => {
      // Intentionally do not cancel here on every targetsKey change; we want continuity.
      // Cleanup handled on unmount below.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsKey, durationMs]);

  useEffect(() => {
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  const positions = useMemo(() => {
    const out = new Map();
    for (const [id, s] of stateRef.current.entries()) {
      out.set(id, { x01: s.x, y01: s.y, changedAt: s.changedAt || 0 });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick]);

  return positions;
}

// PUBLIC_INTERFACE
export function MockGoogleMap({
  center,
  zoom,
  markers,
  onBoundsChanged,
  onCenterChanged,
  onZoomChanged,
  onMarkerClick,
}) {
  /** Mock Google Map renderer for demo usage (no external APIs). */
  const viewportRef = useRef(null);

  const [viewportPx, setViewportPx] = useState({ w: 0, h: 0 });

  // Internal visual state. We keep props as source of truth, but can still render smoothly.
  const [internalCenter, setInternalCenter] = useState(center || { lat: 15, lng: 0 });
  const [internalZoom, setInternalZoom] = useState(typeof zoom === "number" ? zoom : 2);

  // Track panning: CSS transform on a tile-layer for smoothness.
  const [panPx, setPanPx] = useState({ x: 0, y: 0 });
  const draggingRef = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  // Sync from props when changed externally.
  useEffect(() => {
    if (center && typeof center.lat === "number" && typeof center.lng === "number") {
      setInternalCenter(center);
    }
  }, [center?.lat, center?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof zoom === "number" && Number.isFinite(zoom)) {
      setInternalZoom(zoom);
    }
  }, [zoom]);

  // Measure viewport for bounds computations.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewportPx({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mapBounds = useMemo(
    () => computeMockBounds(internalCenter, internalZoom, viewportPx),
    [internalCenter, internalZoom, viewportPx]
  );

  // If no markers provided, derive a friendly bounds from their positions (so the map doesn't feel empty).
  const derivedUserBounds = useMemo(() => normalizeUsersBounds(markers || []), [markers]);

  const effectiveBounds = useMemo(() => {
    // When there are markers, keep bounds centered around current center,
    // but make sure projection space is stable and reasonable.
    // This keeps click-to-center meaningful while still showing the fleet.
    if (markers && markers.length) return mapBounds;
    // If empty markers, fall back to derived bounds (placeholder-friendly).
    return derivedUserBounds;
  }, [derivedUserBounds, mapBounds, markers]);

  // Callbacks for bounds/center/zoom changes.
  useEffect(() => {
    if (typeof onBoundsChanged === "function") onBoundsChanged(effectiveBounds);
  }, [effectiveBounds, onBoundsChanged]);

  useEffect(() => {
    if (typeof onCenterChanged === "function") onCenterChanged(internalCenter);
  }, [internalCenter, onCenterChanged]);

  useEffect(() => {
    if (typeof onZoomChanged === "function") onZoomChanged(internalZoom);
  }, [internalZoom, onZoomChanged]);

  const scale = useMemo(() => zoomToScale(internalZoom), [internalZoom]);

  const markersWithXY = useMemo(() => {
    return (markers || [])
      .filter((m) => typeof m.lat === "number" && typeof m.lng === "number")
      .map((m) => {
        const { x01, y01 } = projectLatLngTo01(m.lat, m.lng, effectiveBounds);
        return { ...m, x01, y01 };
      });
  }, [effectiveBounds, markers]);

  const clusters = useMemo(() => {
    const raw = computeClusters(markersWithXY, internalZoom);
    return applyOverlapOffsets(raw);
  }, [internalZoom, markersWithXY]);

  // Tween single marker positions (clusters still render at their computed positions).
  const markerTargets = useMemo(() => {
    return clusters
      .filter((c) => c.type === "single")
      .map((c) => ({ id: c.items[0].id, x01: c.x01, y01: c.y01 }));
  }, [clusters]);

  const tweened = useMarkerTween(markerTargets, { durationMs: 560 });

  const panToLatLng = useCallback(
    (nextCenter) => {
      // Reset visual pan offset and update center.
      setPanPx({ x: 0, y: 0 });
      setInternalCenter(nextCenter);
    },
    [setInternalCenter]
  );

  const zoomBy = useCallback(
    (delta) => {
      const nextZoom = clamp((typeof internalZoom === "number" ? internalZoom : 3) + delta, 2, 16);
      setInternalZoom(nextZoom);
    },
    [internalZoom]
  );

  const commitPanToCenter = useCallback(() => {
    // Convert pixel pan into a center shift in lat/lng space.
    const el = viewportRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;

    const dx01 = panPx.x / w;
    const dy01 = panPx.y / h;

    // panPx positive means layer moved right/down, so center moves left/up.
    const x01Center = clamp(0.5 - dx01, 0, 1);
    const y01Center = clamp(0.5 - dy01, 0, 1);

    const nextCenter = unproject01ToLatLng(x01Center, y01Center, effectiveBounds);

    setPanPx({ x: 0, y: 0 });
    setInternalCenter(nextCenter);
  }, [effectiveBounds, panPx.x, panPx.y]);

  const onPointerDown = useCallback(
    (e) => {
      // Only start drag when interacting with map canvas, not controls.
      if (e.button !== 0) return;
      draggingRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panPx.x,
        startPanY: panPx.y,
      };
    },
    [panPx.x, panPx.y]
  );

  const onPointerMove = useCallback((e) => {
    if (!draggingRef.current.active) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    setPanPx({ x: draggingRef.current.startPanX + dx, y: draggingRef.current.startPanY + dy });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current.active) return;
    draggingRef.current.active = false;
    commitPanToCenter();
  }, [commitPanToCenter]);

  useEffect(() => {
    // Global pointer up to end drag even if the pointer leaves the viewport.
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerUp]);

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      zoomBy(dir);
    },
    [zoomBy]
  );

  const onMapClick = useCallback(
    (e) => {
      const el = viewportRef.current;
      if (!el) return;

      // Avoid click-to-center if we were dragging significantly.
      const wasDragging = Math.abs(panPx.x) > 6 || Math.abs(panPx.y) > 6;
      if (wasDragging) return;

      const rect = el.getBoundingClientRect();
      const x01 = clamp((e.clientX - rect.left) / (rect.width || 1), 0, 1);
      const y01 = clamp((e.clientY - rect.top) / (rect.height || 1), 0, 1);
      const nextCenter = unproject01ToLatLng(x01, y01, effectiveBounds);
      panToLatLng(nextCenter);
    },
    [effectiveBounds, panPx.x, panPx.y, panToLatLng]
  );

  const handleKeyDown = useCallback(
    (e) => {
      const stepPx = e.shiftKey ? 42 : 26;
      if (e.key === "+" || e.key === "=") zoomBy(1);
      if (e.key === "-") zoomBy(-1);

      if (e.key === "ArrowLeft") setPanPx((p) => ({ ...p, x: p.x + stepPx }));
      if (e.key === "ArrowRight") setPanPx((p) => ({ ...p, x: p.x - stepPx }));
      if (e.key === "ArrowUp") setPanPx((p) => ({ ...p, y: p.y + stepPx }));
      if (e.key === "ArrowDown") setPanPx((p) => ({ ...p, y: p.y - stepPx }));

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        // Commit after a short delay so repeated keys feel continuous.
        window.clearTimeout(handleKeyDown._t);
        handleKeyDown._t = window.setTimeout(() => commitPanToCenter(), 140);
      }
    },
    [commitPanToCenter, zoomBy]
  );
  // stash timer id on function (local-only)
  // eslint-disable-next-line no-underscore-dangle
  handleKeyDown._t = handleKeyDown._t || null;

  return (
    <div
      ref={viewportRef}
      className="MockMapViewport"
      role="region"
      aria-label="Mock Google Map"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onClick={onMapClick}
      style={{ outline: "none" }}
    >
      <div className="MockMapAttribution" aria-hidden="true">
        Mock Map • Drag to pan • Scroll/+/− to zoom • Click to center
      </div>

      <div className="MockMapCompass" aria-hidden="true">
        <div className="MockMapCompassArrow" />
        <div className="MockMapCompassLabel">N</div>
      </div>

      <div className="MockMapControls" aria-label="Map zoom controls">
        <button type="button" className="MockMapControlBtn" onClick={() => zoomBy(1)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="MockMapControlBtn" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          −
        </button>
        <div className="MockMapZoomReadout" aria-hidden="true">
          z{internalZoom}
        </div>
      </div>

      {/* Tile layer (visual only) */}
      <div
        className="MockMapTiles"
        aria-hidden="true"
        style={{
          transform: `translate3d(${panPx.x}px, ${panPx.y}px, 0) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <div className="MockMapTileGrid" />
        <div className="MockMapTileAccents" />
      </div>

      {/* Marker layer mirrors the same pan/zoom transform so markers "stick" to the map */}
      <div
        className="MockMapMarkerLayer"
        style={{
          transform: `translate3d(${panPx.x}px, ${panPx.y}px, 0) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {clusters.map((c) => {
          // Tween only singles for better motion visibility; clusters stay at computed center.
          let x01 = c.x01;
          let y01 = c.y01;

          if (c.type === "single") {
            const id = c.items[0].id;
            const pos = tweened.get(id);
            if (pos) {
              x01 = pos.x01;
              y01 = pos.y01;
            }
          }

          const left = `${x01 * 100}%`;
          const top = `${y01 * 100}%`;

          if (c.type === "cluster") {
            const count = c.items.length;
            const title = count === 1 ? c.items[0].name : `${count} users nearby (click to zoom)`;

            return (
              <button
                key={`cluster-${c.items.map((it) => it.id).join("-")}`}
                type="button"
                className="MockMapCluster"
                style={{ left, top }}
                aria-label={title}
                onClick={(e) => {
                  e.stopPropagation();
                  // Zoom in and center on cluster
                  panToLatLng(unproject01ToLatLng(c.x01, c.y01, effectiveBounds));
                  setInternalZoom((z) => clamp(z + 1, 2, 16));
                }}
              >
                <span className="MockMapClusterCount" aria-hidden="true">
                  {count}
                </span>
              </button>
            );
          }

          const m = c.items[0];
          const ringColor = statusToColorVar(m.status);
          const initials = getInitials(m.name);
          const area = m.areaLabel || "Unknown area";
          const tooltipLabel = `${m.name} • ${area} • ${formatSpeed(m.speed)} • ETA ${formatEta(m.etaIso)}`;

          return (
            <button
              key={m.id}
              type="button"
              className="MockMapMarker"
              style={{
                left,
                top,
                ["--ringColor"]: ringColor,
                ["--avatarBg"]: avatarGradientForId(m.id),
              }}
              aria-label={`Map marker: ${m.name}. Area ${area}. Status ${(m.status || "primary").toLowerCase()}.`}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onMarkerClick === "function") onMarkerClick(m);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (typeof onMarkerClick === "function") onMarkerClick(m);
                }
              }}
            >
              {/* Subtle trailing "ghost" dot; visual only */}
              <span className="MockMapMarkerTrail" aria-hidden="true" />

              <span className="MockMapMarkerAvatar" aria-hidden="true">
                {initials}
              </span>
              <span className="MockMapMarkerTooltip" role="tooltip">
                <span className="MockMapMarkerTooltipTitle">{m.name}</span>
                <span className="MockMapMarkerTooltipRow">
                  <span>Area</span>
                  <strong>{area}</strong>
                </span>
                <span className="MockMapMarkerTooltipRow">
                  <span>Speed</span>
                  <strong>{formatSpeed(m.speed)}</strong>
                </span>
                <span className="MockMapMarkerTooltipRow">
                  <span>ETA</span>
                  <strong>{formatEta(m.etaIso)}</strong>
                </span>
              </span>

              {/* For very lightweight hover hint */}
              <span className="MockMapMarkerHoverLabel" aria-hidden="true">
                {tooltipLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
