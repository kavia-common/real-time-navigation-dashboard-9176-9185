import React, { useMemo, useState } from "react";
import { formatEta, formatPercent, formatSpeed, getInitials } from "../utils/format";

function statusToMarkerBg(status) {
  // Map status to theme colors
  if (status === "error") return "rgba(239, 68, 68, 0.88)";
  if (status === "success") return "rgba(245, 158, 11, 0.92)";
  if (status === "secondary") return "rgba(245, 158, 11, 0.80)";
  return "rgba(37, 99, 235, 0.88)"; // primary default
}

// PUBLIC_INTERFACE
export function UserMarker({ user, x01, y01 }) {
  /** A user marker for the map placeholder. */
  const [open, setOpen] = useState(false);

  const bg = useMemo(() => statusToMarkerBg(user.status), [user.status]);
  const initials = useMemo(() => getInitials(user.name), [user.name]);

  return (
    <button
      type="button"
      className="UserMarker"
      style={{
        left: `${(x01 || 0) * 100}%`,
        top: `${(y01 || 0) * 100}%`,
        background: bg,
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-label={`Map marker for ${user.name}. Speed ${formatSpeed(user.speed)}. ETA ${formatEta(
        user.etaIso
      )}. Completion ${formatPercent(user.completion)}.`}
    >
      <span className="MarkerInitials" aria-hidden="true">
        {initials}
      </span>

      {open ? (
        <div className="Tooltip" role="tooltip" aria-label={`Details for ${user.name}`}>
          <p className="TooltipTitle">{user.name}</p>
          <div className="TooltipGrid">
            <div>
              Speed<strong>{formatSpeed(user.speed)}</strong>
            </div>
            <div>
              ETA<strong>{formatEta(user.etaIso)}</strong>
            </div>
            <div>
              Completion<strong>{formatPercent(user.completion)}</strong>
            </div>
            <div>
              Status<strong style={{ textTransform: "capitalize" }}>{user.status || "primary"}</strong>
            </div>
          </div>
        </div>
      ) : null}

      <span className="MarkerLabel" aria-hidden="true">
        {user.name.split(" ")[0]}
      </span>
    </button>
  );
}
