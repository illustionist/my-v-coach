import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LibraryScreen } from "./LibraryScreen";
import * as client from "../api/client";

test("lists songs from the API and calls onSelect when one is clicked", async () => {
  vi.spyOn(client, "listSongs").mockResolvedValue([
    { id: "a", title: "Song A", durationSec: 100 },
    { id: "b", title: "Song B", durationSec: 200 },
  ]);
  const onSelect = vi.fn();

  const user = (await import("@testing-library/user-event")).default.setup();
  render(<LibraryScreen onSelect={onSelect} />);

  await waitFor(() => expect(screen.getByText("Song A")).toBeInTheDocument());
  await user.click(screen.getByText("Song B"));
  expect(onSelect).toHaveBeenCalledWith("b");
});
