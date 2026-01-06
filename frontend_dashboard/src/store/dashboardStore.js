import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMockUsers, evolveMockUser } from "../mock/mockUsers";
import { getEnvConfig } from "../utils/env";

const DashboardContext = createContext(null);

const DEFAULT_SORT = "completionDesc"; // or nameAsc
const DEFAULT_FILTER = "all"; // or primary/secondary/success/error

function normalizeIncomingUser(msg) {
  // Accept exactly { id, name, lat, lng, speed, etaIso, completion, status }
  // plus optional routeName.
  if (!msg || typeof msg !== "object") return null;
  if (!msg.id) return null;

  const status = (msg.status || "primary").toLowerCase();
  return {
    id: String(msg.id),
    name: String(msg.name || "Unknown"),
    routeName: String(msg.routeName || "Active Route"),
    lat: typeof msg.lat === "number" ? msg.lat : 0,
    lng: typeof msg.lng === "number" ? msg.lng : 0,
    speed: typeof msg.speed === "number" ? msg.speed : 0,
    etaIso: typeof msg.etaIso === "string" ? msg.etaIso : new Date(Date.now() + 20 * 60000).toISOString(),
    completion: typeof msg.completion === "number" ? msg.completion : 0,
    status: ["primary", "secondary", "success", "error"].includes(status) ? status : "primary",
  };
}

async function tryFetchInitialUsers(apiBase) {
  // Optional: if apiBase present, try GET `${apiBase}/users` (best-effort).
  // If unavailable, gracefully return null.
  if (!apiBase) return null;

  const url = apiBase.replace(/\/$/, "") + "/users";
  try {
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data)) return null;
    const normalized = data.map(normalizeIncomingUser).filter(Boolean);
    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
export function DashboardProvider({ children }) {
  /** Provides dashboard state and actions for WS connection and mock simulation. */
  const { wsUrl, apiBase } = getEnvConfig();

  const [users, setUsers] = useState(() => createMockUsers());
  const [mode, setMode] = useState(() => (wsUrl ? "live" : "mock")); // "mock" | "live"
  const [connectionState, setConnectionState] = useState(() =>
    wsUrl && mode === "live" ? "connecting" : "idle"
  ); // "idle" | "connecting" | "connected" | "error"
  const [lastError, setLastError] = useState("");
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [statusFilter, setStatusFilter] = useState(DEFAULT_FILTER);
  const [toasts, setToasts] = useState([]);

  const wsRef = useRef(null);
  const mockTimerRef = useRef(null);

  const pushToast = useCallback((title, body) => {
    const id = String(Date.now()) + Math.random().toString(16).slice(2);
    setToasts((prev) => [{ id, title, body }, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const applyUserUpdate = useCallback((incoming) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === incoming.id);
      if (idx === -1) return [incoming, ...prev];
      const next = prev.slice();
      next[idx] = { ...next[idx], ...incoming };
      return next;
    });
  }, []);

  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  }, []);

  const stopMock = useCallback(() => {
    if (mockTimerRef.current) {
      window.clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }
  }, []);

  const startMock = useCallback(() => {
    stopMock();
    setConnectionState("idle");
    setLastError("");
    pushToast("Mock mode enabled", "Simulating user movement and progress locally.");
    mockTimerRef.current = window.setInterval(() => {
      setUsers((prev) => prev.map((u) => evolveMockUser(u)));
    }, 900);
  }, [pushToast, stopMock]);

  const connectWs = useCallback(() => {
    stopMock();
    disconnectWs();

    if (!wsUrl) {
      setConnectionState("error");
      setLastError("REACT_APP_WS_URL is not set.");
      pushToast("Live connection unavailable", "No WebSocket URL configured; using mock mode.");
      setMode("mock");
      return;
    }

    setConnectionState("connecting");
    setLastError("");

    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setConnectionState("error");
      setLastError("Failed to create WebSocket connection.");
      pushToast("WebSocket error", "Could not open WebSocket; falling back to mock mode.");
      setMode("mock");
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState("connected");
      pushToast("Connected", "Live updates are now streaming.");
    };

    ws.onerror = () => {
      setConnectionState("error");
      setLastError("WebSocket encountered an error.");
      pushToast("Connection error", "WebSocket error; falling back to mock mode.");
      setMode("mock");
    };

    ws.onclose = () => {
      // If in live mode and it closes unexpectedly, show banner; store keeps it simple.
      setConnectionState((prev) => (prev === "connected" ? "error" : prev));
      setLastError("WebSocket closed.");
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const normalized = normalizeIncomingUser(msg);
        if (normalized) applyUserUpdate(normalized);
      } catch {
        // ignore malformed messages
      }
    };
  }, [applyUserUpdate, disconnectWs, pushToast, stopMock, wsUrl]);

  // Initial seed (optional REST fetch)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromApi = await tryFetchInitialUsers(apiBase);
      if (!cancelled && fromApi && fromApi.length) {
        setUsers(fromApi);
        pushToast("Loaded", "Fetched initial users from API.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, pushToast]);

  // Auto start based on mode
  useEffect(() => {
    if (mode === "live") connectWs();
    if (mode === "mock") startMock();
    return () => {
      // cleanup when switching/unmounting
      disconnectWs();
      stopMock();
    };
  }, [connectWs, disconnectWs, mode, startMock, stopMock]);

  const filteredSortedUsers = useMemo(() => {
    const filtered =
      statusFilter === "all" ? users : users.filter((u) => (u.status || "primary") === statusFilter);

    const sorted = filtered.slice();
    if (sortBy === "completionDesc") {
      sorted.sort((a, b) => (b.completion || 0) - (a.completion || 0));
    } else if (sortBy === "nameAsc") {
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return sorted;
  }, [sortBy, statusFilter, users]);

  const value = useMemo(() => {
    return {
      users: filteredSortedUsers,
      rawUsers: users,
      mode,
      wsUrl,
      apiBase,
      connectionState,
      lastError,
      sortBy,
      statusFilter,
      toasts,

      actions: {
        setSortBy,
        setStatusFilter,
        setMode,
        connectWs,
        startMock,
      },
    };
  }, [
    apiBase,
    connectWs,
    connectionState,
    filteredSortedUsers,
    lastError,
    mode,
    sortBy,
    startMock,
    statusFilter,
    toasts,
    users,
    wsUrl,
  ]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

// PUBLIC_INTERFACE
export function useDashboard() {
  /** Hook to access dashboard store state and actions. */
  const ctx = React.useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return ctx;
}
