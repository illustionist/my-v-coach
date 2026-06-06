import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "./App";
import * as client from "./api/client";

test("starts on the library screen", async () => {
  vi.spyOn(client, "listSongs").mockResolvedValue([]);
  render(<App />);
  await waitFor(() => expect(screen.getByText(/your songs/i)).toBeInTheDocument());
});
