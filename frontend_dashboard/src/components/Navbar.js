import React, { useEffect, useMemo, useRef } from "react";
import { useDashboard } from "../store/dashboardStore";
import { getGoogleMapsKey } from "../utils/env";

function getMapBadgeLabel({ mapMode, mode, hasKey }) {
  if (mapMode === "demo") return "Map: Demo (Mock)";
  if (hasKey && mode === "live") return "Map: Google";
  return "Map: Mock (No Key)";
}

// PUBLIC_INTERFACE
export function Navbar() {
  /** Top navigation bar with app title, connection status, and mode toggles. */
  const {
    mode,
    wsUrl,
    connectionState,
    lastError,
    sortBy,
    statusFilter,
    mapMode,
    actions,
  } = useDashboard();

  const banner = useMemo(() => {
    if (mode === "mock") {
      return { cls: "Banner BannerConnecting", label: "Mock updates", detail: "Local simulation" };
    }
    if (connectionState === "connected") {
      return { cls: "Banner BannerConnected", label: "Connected", detail: "Live updates" };
    }
    if (connectionState === "connecting") {
      return { cls: "Banner BannerConnecting", label: "Connecting", detail: "WebSocket…" };
    }
    if (connectionState === "error") {
      return { cls: "Banner BannerError", label: "Offline", detail: lastError || "Connection issue" };
    }
    return { cls: "Banner", label: "Idle", detail: "Not connected" };
  }, [connectionState, lastError, mode]);

  const hasKey = useMemo(() => Boolean(getGoogleMapsKey()), [mode, mapMode]);
  const mapBadge = useMemo(() => getMapBadgeLabel({ mapMode, mode, hasKey }), [hasKey, mapMode, mode]);

  // Toast when the effective map mode changes.
  const prevBadgeRef = useRef(mapBadge);
  useEffect(() => {
    const prev = prevBadgeRef.current;
    if (prev !== mapBadge) {
      prevBadgeRef.current = mapBadge;
      actions.pushToast("Map mode changed", mapBadge);
    }
  }, [actions, mapBadge]);

  return (
    <header className="Navbar" role="banner">
      <div className="NavbarInner">
        <div className="Brand" aria-label="Application brand">
          <div className="BrandMark" aria-hidden="true" />
          <div className="BrandTitle">
            <strong>Navigation Dashboard</strong>
            <span>Ocean Professional</span>
          </div>
        </div>

        <div className="NavControls" aria-label="Dashboard controls">
          <span className={banner.cls} role="status" aria-live="polite" title={wsUrl || "No WS URL"}>
            <span className="BannerDot" aria-hidden="true" />
            <span>
              <strong style={{ color: "var(--color-text)" }}>{banner.label}</strong>{" "}
              <span style={{ color: "var(--color-text-muted)" }}>{banner.detail}</span>
            </span>
          </span>

          <span className="Pill" aria-label="Map provider indicator" title="Map renderer selection">
            <strong style={{ color: "var(--color-text)" }}>{mapBadge}</strong>
          </span>

          <button
            type="button"
            className="Button"
            onClick={() => actions.setMapMode(mapMode === "demo" ? "auto" : "demo")}
            aria-label="Toggle demo map mode"
            title="Demo forces the mock map renderer even if Google Maps key is configured"
          >
            Demo: {mapMode === "demo" ? "On" : "Off"}
          </button>

          <select
            className="Select"
            value={statusFilter}
            onChange={(e) => actions.setStatusFilter(e.target.value)}
            aria-label="Filter users by status"
          >
            <option value="all">All statuses</option>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>

          <select
            className="Select"
            value={sortBy}
            onChange={(e) => actions.setSortBy(e.target.value)}
            aria-label="Sort users"
          >
            <option value="completionDesc">Sort: Completion</option>
            <option value="nameAsc">Sort: Name</option>
          </select>

          <button
            type="button"
            className="Button"
            onClick={() => actions.setMode(mode === "mock" ? "live" : "mock")}
            aria-label="Toggle between mock and live modes"
            title={wsUrl ? "Switch modes" : "No WS URL set; mock recommended"}
          >
            Mode: {mode === "mock" ? "Mock" : "Live"}
          </button>

          <button
            type="button"
            className="Button ButtonPrimary"
            onClick={() => (mode === "live" ? actions.connectWs() : actions.startMock())}
            aria-label="Reconnect or restart updates"
          >
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
