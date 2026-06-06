import { afterEach, vi } from "vitest";
import { listSongs, getSong, importSong, stemUrl, API_BASE } from "./client";

afterEach(() => vi.unstubAllGlobals());

test("listSongs GETs /songs and returns the array", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ id: "a", title: "A", durationSec: 1 }],
  });
  vi.stubGlobal("fetch", fetchMock);

  const songs = await listSongs();
  expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/songs`);
  expect(songs[0].id).toBe("a");
});

test("getSong GETs /songs/{id}", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "x" }) });
  vi.stubGlobal("fetch", fetchMock);

  await getSong("x");
  expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/songs/x`);
});

test("importSong POSTs multipart and returns summary", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "new", title: "song", durationSec: 2 }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const file = new File([new Uint8Array([1, 2, 3])], "song.mp3", { type: "audio/mpeg" });
  const summary = await importSong(file);

  expect(summary.id).toBe("new");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(`${API_BASE}/songs`);
  expect(init.method).toBe("POST");
  expect(init.body).toBeInstanceOf(FormData);
});

test("a non-ok response throws", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
  await expect(listSongs()).rejects.toThrow(/500/);
});

test("stemUrl prefixes the API base", () => {
  expect(stemUrl("/songs/x/stems/vocal")).toBe(`${API_BASE}/songs/x/stems/vocal`);
});
