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
        <section className="Panel" aria-label="Live map panel">
          <div className="PanelHeader">
            <div>
              <h2>Live Map</h2>
              <p>Multi-user markers with speed, ETA and completion</p>
            </div>
          </div>
          <div className="PanelBody">
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
