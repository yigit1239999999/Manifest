import { MAX_REQUEST_BYTES } from "@/modules/import/limits";

/**
 * Sending the rows to the plan and the write.
 *
 * Compressed, because the host's request ceiling is the one real limit on
 * an import (`modules/import/limits.ts`) and a clinic's list is repetitive
 * text that shrinks tenfold. A browser without `CompressionStream` sends
 * plain JSON; the route reads both.
 */
export class TooLargeError extends Error {}

async function gzip(text: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function postImport<T>(path: string, body: unknown): Promise<T> {
  const json = JSON.stringify(body);
  const packed = await gzip(json);
  const payload = packed ?? new TextEncoder().encode(json);
  // Said here, before the request, so the vet reads a sentence rather than
  // waiting on a request the host will refuse.
  if (payload.byteLength > MAX_REQUEST_BYTES) throw new TooLargeError();
  const res = await fetch(path, {
    method: "POST",
    headers: packed
      ? { "content-type": "application/octet-stream", "x-import-encoding": "gzip" }
      : { "content-type": "application/json" },
    body: payload as BodyInit,
  });
  if (res.status === 413) throw new TooLargeError();
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}
