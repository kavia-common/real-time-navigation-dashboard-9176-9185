import React, { useMemo } from "react";
import { formatEta, formatPercent, formatSpeed, getInitials } from "../utils/format";
import { StatusBadge } from "./StatusBadge";

// PUBLIC_INTERFACE
export function ProgressItem({ user }) {
  /** Displays detailed route progress information for a single user. */
  const initials = useMemo(() => getInitials(user.name), [user.name]);
  const progressWidth = useMemo(() => {
    const pct = Math.max(0, Math.min(1, user.completion || 0)) * 100;
    return `${pct.toFixed(1)}%`;
  }, [user.completion]);

  return (
    <article className="ProgressItem" tabIndex={0} aria-label={`Progress card for ${user.name}`}>
      <div className="ProgressRowTop">
        <div className="Avatar" aria-hidden="true">
          {initials}
        </div>

        <div className="RouteMeta">
          <strong>{user.name}</strong>
          <span>
            {user.routeName || "Active Route"} • ETA {formatEta(user.etaIso)}
          </span>
        </div>

        <StatusBadge status={user.status || "primary"} />
      </div>

      <div className="ProgressBarWrap" aria-label="Completion progress bar">
        <div className="ProgressBarHead">
          <span>Completion</span>
          <span>
            <strong style={{ color: "var(--color-text)" }}>{formatPercent(user.completion)}</strong>
          </span>
        </div>
        <div className="ProgressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((user.completion || 0) * 100)}>
          <div className="ProgressFill" style={{ width: progressWidth }} />
        </div>
      </div>

      <div className="DetailsRow" aria-label="Speed and route details">
        <div className="DetailCard">
          <span>Speed</span>
          <strong>{formatSpeed(user.speed)}</strong>
        </div>
        <div className="DetailCard">
          <span>ETA</span>
          <strong>{formatEta(user.etaIso)}</strong>
        </div>
        <div className="DetailCard">
          <span>Status</span>
          <strong style={{ textTransform: "capitalize" }}>{user.status || "primary"}</strong>
        </div>
      </div>
    </article>
  );
}
