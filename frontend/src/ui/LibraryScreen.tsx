import { useEffect, useRef, useState } from "react";
import { importSong, listSongs } from "../api/client";
import { SongSummary } from "../api/types";

export function LibraryScreen({ onSelect }: { onSelect: (songId: string) => void }) {
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setSongs(await listSongs());
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  async function onImport(file: File) {
    setBusy(true);
    setError(null);
    try {
      await importSong(file);
      await refresh();
    } catch (e) {
      setError(`Import failed: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>my-v-coach</h1>
      <h2>Your songs</h2>
      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/wav"
        aria-label="Import song"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImport(f);
        }}
      />
      {busy && <p>Processing… isolating vocal and analyzing pitch.</p>}
      {error && <p role="alert">{error}</p>}
      <ul>
        {songs.map((s) => (
          <li key={s.id}>
            <button onClick={() => onSelect(s.id)}>{s.title}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
