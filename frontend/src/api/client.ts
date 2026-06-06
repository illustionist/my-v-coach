import { SongDetail, SongSummary } from "./types";

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8000";

async function getJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`request failed: ${resp.status}`);
  return (await resp.json()) as T;
}

export function listSongs(): Promise<SongSummary[]> {
  return getJson<SongSummary[]>(`${API_BASE}/songs`);
}

export function getSong(id: string): Promise<SongDetail> {
  return getJson<SongDetail>(`${API_BASE}/songs/${id}`);
}

export async function importSong(file: File): Promise<SongSummary> {
  const body = new FormData();
  body.append("file", file);
  const resp = await fetch(`${API_BASE}/songs`, { method: "POST", body });
  if (!resp.ok) throw new Error(`import failed: ${resp.status}`);
  return (await resp.json()) as SongSummary;
}

export function stemUrl(path: string): string {
  return `${API_BASE}${path}`;
}
