import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders dashboard navbar", () => {
  render(<App />);
  expect(screen.getByText(/Navigation Dashboard/i)).toBeInTheDocument();
});
