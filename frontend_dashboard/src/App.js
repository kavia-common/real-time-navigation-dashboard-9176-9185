import React from "react";
import "./App.css";
import { ThemeProvider } from "./theme/ThemeProvider";
import { DashboardProvider } from "./store/dashboardStore";
import { Navbar } from "./components/Navbar";
import { DashboardLayout } from "./components/DashboardLayout";

// PUBLIC_INTERFACE
function App() {
  /** Main application entry that renders the real-time navigation dashboard. */
  return (
    <ThemeProvider>
      <DashboardProvider>
        <div className="AppRoot">
          <Navbar />
          <DashboardLayout />
        </div>
      </DashboardProvider>
    </ThemeProvider>
  );
}

export default App;
