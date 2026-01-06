import React from "react";
import { useDashboard } from "../store/dashboardStore";

// PUBLIC_INTERFACE
export function ToastHost() {
  /** Non-intrusive toast notifications for connection state and mode changes. */
  const { toasts } = useDashboard();

  if (!toasts.length) return null;

  return (
    <div className="ToastHost" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="Toast" role="status">
          <p className="ToastTitle">{t.title}</p>
          <p className="ToastBody">{t.body}</p>
        </div>
      ))}
    </div>
  );
}
