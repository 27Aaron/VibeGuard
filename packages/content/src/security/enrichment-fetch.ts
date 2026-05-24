import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

async function readResponseBytes(
  response: Response,
  url: string,
  maxBytes: number,
) {
  const contentLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  );

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(
      `Security feed ${url} is too large (${contentLength} bytes, max ${maxBytes})`,
    );
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new Error(
        `Security feed ${url} is too large (${bytes.byteLength} bytes, max ${maxBytes})`,
      );
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(
        `Security feed ${url} is too large (${total} bytes, max ${maxBytes})`,
      );
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total);
}

export async function fetchSecurityFeedBytes(url: string, maxBytes: number) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to download ${url}: ${response.status}`);
  return readResponseBytes(response, url, maxBytes);
}

export async function fetchSecurityFeedText(url: string, maxBytes: number) {
  const bytes = await fetchSecurityFeedBytes(url, maxBytes);
  return Buffer.from(bytes).toString("utf8");
}

export async function gunzipSecurityFeedText(
  bytes: Uint8Array,
  label: string,
  maxBytes: number,
) {
  const chunks: Buffer[] = [];
  let total = 0;

  await pipeline(
    Readable.from(Buffer.from(bytes)),
    zlib.createGunzip(),
    new Writable({
      write(chunk, _encoding, callback) {
        total += chunk.byteLength;
        if (total > maxBytes) {
          callback(
            new Error(
              `${label} is too large after decompression (${total} bytes, max ${maxBytes})`,
            ),
          );
          return;
        }

        chunks.push(Buffer.from(chunk));
        callback();
      },
    }),
  );

  return Buffer.concat(chunks, total).toString("utf8");
}
