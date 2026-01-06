import React, { createContext, useMemo } from "react";

const ThemeContext = createContext({
  themeName: "Ocean Professional",
  colors: {},
});

// PUBLIC_INTERFACE
export function ThemeProvider({ children }) {
  /** Provides theme metadata to components; actual tokens live in CSS variables. */
  const value = useMemo(() => {
    return {
      themeName: "Ocean Professional",
      colors: {
        primary: "#2563EB",
        secondary: "#F59E0B",
        success: "#F59E0B",
        error: "#EF4444",
        background: "#f9fafb",
        surface: "#ffffff",
        text: "#111827",
      },
    };
  }, []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export { ThemeContext };
