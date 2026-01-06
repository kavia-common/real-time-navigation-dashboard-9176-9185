import React from "react";
import { useDashboard } from "../store/dashboardStore";
import { ProgressItem } from "./ProgressItem";

// PUBLIC_INTERFACE
export function ProgressList() {
  /** List of route progress items for each user. */
  const { users } = useDashboard();

  return (
    <div className="ProgressList" role="list" aria-label="User route progress list">
      {users.map((u) => (
        <div key={u.id} role="listitem" aria-label={`Progress for ${u.name}`}>
          <ProgressItem user={u} />
        </div>
      ))}
    </div>
  );
}
