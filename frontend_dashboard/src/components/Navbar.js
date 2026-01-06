import React, { useEffect, useMemo, useRef } from "react";
import { useDashboard } from "../store/dashboardStore";
import { getGoogleMapsKey } from "../utils/env";

// PUBLIC_INTERFACE
export function Navbar() {
  /** Top navigation bar with app title, connection status, and mode toggles. */
  const { mode, wsUrl, connectionState, lastError, sortBy, statusFilter, actions } = useDashboard();

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

  const mapRenderer = useMemo(() => {
    const hasKey = Boolean(getGoogleMapsKey());
    // We only use Google renderer when key exists and mode is live; otherwise mock.
    return hasKey && mode === "live" ? "Google" : "Mock";
  }, [mode]);

  // Toast when the map renderer switches (e.g., toggling mode, or adding/removing key).
  const prevRendererRef = useRef(mapRenderer);
  useEffect(() => {
    const prev = prevRendererRef.current;
    if (prev !== mapRenderer) {
      prevRendererRef.current = mapRenderer;
      if (mapRenderer === "Google") {
        actions.startMock(); // ensure mock timers aren't running (safe no-op if already live)
        actions.connectWs(); // keep behavior consistent with live mode intent
        // Note: the store already emits its own toasts for connection; this is just for map layer.
        // We avoid adding a new global toast API; use existing mode toasts.
      }
      // Reuse existing toast mechanism by nudging mode (no change) would be messy.
      // Instead, we rely on existing mode toasts and provide a visual indicator.
    }
  }, [actions, mapRenderer]);

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
            Map: <strong style={{ color: "var(--color-text)" }}>{mapRenderer}</strong>
          </span>

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
