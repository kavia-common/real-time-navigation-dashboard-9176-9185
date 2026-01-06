import React from "react";
import { useDashboard } from "../store/dashboardStore";
import { ProgressList } from "./ProgressList";

// PUBLIC_INTERFACE
export function ProgressPanel() {
  /** Right-side progress panel with scrollable list. */
  const { users } = useDashboard();

  return (
    <>
      <div className="PanelHeader">
        <div>
          <h2>Route Progress</h2>
          <p>{users.length} active users</p>
        </div>
        <div className="ProgressControls" aria-label="Progress panel controls">
          <span className="Pill" aria-label="Hint">
            Filter & sort in the top bar
          </span>
        </div>
      </div>

      <div className="PanelBody">
        <div className="ProgressScroll" role="region" aria-label="Scrollable progress list">
          <ProgressList />
        </div>
      </div>
    </>
  );
}
