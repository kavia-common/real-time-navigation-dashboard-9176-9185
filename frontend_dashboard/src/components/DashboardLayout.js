import React from "react";
import { MapContainer } from "./MapContainer";
import { ProgressPanel } from "./ProgressPanel";
import { ToastHost } from "./ToastHost";

// PUBLIC_INTERFACE
export function DashboardLayout() {
  /** Main dashboard layout: map left + progress list right. */
  return (
    <>
      <main className="DashboardMain" aria-label="Navigation dashboard main content">
        <section className="Panel LiveMapPanel" aria-label="Live map panel">
          <div className="PanelHeader LiveMapHeader">
            <div className="LiveMapHeaderLeft">
              <h2>Live Map</h2>
              <p>Multi-user markers with speed, ETA and completion</p>
            </div>

            <div className="LiveMapHeaderRight" aria-label="Live map header actions">
              {/* Visual-only placeholders for design parity; existing controls remain in the top navbar. */}
              <span className="LiveMapChip" aria-hidden="true">
                Live tracking
              </span>
            </div>
          </div>

          <div className="PanelBody LiveMapBody">
            <MapContainer />
          </div>
        </section>

        <section className="Panel" aria-label="Route progress panel">
          <ProgressPanel />
        </section>
      </main>

      <ToastHost />
    </>
  );
}
