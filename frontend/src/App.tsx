import { useState } from "react";
import { LibraryScreen } from "./ui/LibraryScreen";
import { PracticeScreen } from "./ui/PracticeScreen";

export function App() {
  const [songId, setSongId] = useState<string | null>(null);
  return songId ? (
    <PracticeScreen songId={songId} onBack={() => setSongId(null)} />
  ) : (
    <LibraryScreen onSelect={setSongId} />
  );
}
