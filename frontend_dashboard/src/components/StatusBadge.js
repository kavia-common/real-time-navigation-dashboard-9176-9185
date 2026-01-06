import React from "react";

function clsFor(status) {
  if (status === "error") return "StatusBadge StatusError";
  if (status === "success") return "StatusBadge StatusSuccess";
  if (status === "secondary") return "StatusBadge StatusSecondary";
  return "StatusBadge StatusPrimary";
}

// PUBLIC_INTERFACE
export function StatusBadge({ status }) {
  /** Pill-style status badge matching the theme color mapping. */
  const s = (status || "primary").toLowerCase();
  return (
    <span className={clsFor(s)} aria-label={`Status ${s}`}>
      <span className="StatusDot" aria-hidden="true" />
      {s}
    </span>
  );
}
