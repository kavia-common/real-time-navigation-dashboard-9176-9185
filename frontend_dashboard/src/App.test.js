import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders dashboard navbar", () => {
  render(<App />);
  expect(screen.getByText(/Navigation Dashboard/i)).toBeInTheDocument();
});

test("renders without Google Maps key (mock fallback)", () => {
  // CRA exposes env at build time; in test we just ensure no crash and core UI renders.
  // This validates the app does not require REACT_APP_GOOGLE_MAPS_API_KEY to be present.
  render(<App />);
  expect(screen.getByText(/Live Map/i)).toBeInTheDocument();
});
