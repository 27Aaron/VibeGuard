import {
  OSV_VULNERABILITIES_BASE_URL,
  type OsvDumpEcosystem,
} from "./cache";
import {
  loadYauzlPromise,
  MAX_VULNERABILITY_TEXT_BYTES,
  parseOsvTimestamp,
  type BootstrapArchiveEntry,
  type ModifiedIdRow,
} from "./sync-types";

async function readResponseText(
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
      `Response body for ${url} is too large (${contentLength} bytes, max ${maxBytes})`,
    );
  }

  if (!response.body) {
    const text = await response.text();

    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error(
        `Response body for ${url} is too large (${Buffer.byteLength(text, "utf8")} bytes, max ${maxBytes})`,
      );
    }

    return text;
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
        `Response body for ${url} is too large (${total} bytes, max ${maxBytes})`,
      );
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total).toString("utf8");
}

export async function defaultFetchText(
  url: string,
  maxBytes = MAX_VULNERABILITY_TEXT_BYTES,
) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download OSV file: ${response.status} ${url}`);
  }

  return readResponseText(response, url, maxBytes);
}

export function buildModifiedIdCsvUrl(ecosystem: OsvDumpEcosystem) {
  return `${OSV_VULNERABILITIES_BASE_URL}/${encodeURIComponent(
    ecosystem,
  )}/modified_id.csv`;
}

export function parseModifiedIdCsv(
  csv: string,
  limit?: number,
): ModifiedIdRow[] {
  const maxRows = Math.max(0, limit ?? Number.POSITIVE_INFINITY);
  const rows: ModifiedIdRow[] = [];
  const effectiveLimit = Number.isFinite(maxRows)
    ? Math.floor(maxRows)
    : Infinity;

  if (effectiveLimit <= 0) {
    return rows;
  }

  let lineStart = 0;
  for (let index = 0; index <= csv.length; index += 1) {
    if (index < csv.length && csv[index] !== "\n") {
      continue;
    }

    const rawLine = csv.slice(lineStart, index).trimEnd();
    lineStart = index + 1;

    if (!rawLine) {
      continue;
    }

    const line = rawLine.replace(/\r$/, "");
    const [timestamp, externalId] = line.split(",");
    const modifiedAt = timestamp ? parseOsvTimestamp(timestamp.trim()) : null;
    const trimmedId = externalId?.trim();

    if (!modifiedAt || !trimmedId) {
      continue;
    }

    rows.push({ modifiedAt, externalId: trimmedId });

    if (rows.length >= effectiveLimit) {
      break;
    }
  }

  return rows;
}

async function readLimitedStreamText(
  stream: NodeJS.ReadableStream,
  maxBytes: number,
) {
  let total = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
    const chunkBytes = Buffer.from(chunk).byteLength;
    total += chunkBytes;

    if (total > maxBytes) {
      throw new Error(
        `OSV archive entry payload too large (${total} bytes, max ${maxBytes})`,
      );
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks, total).toString("utf8");
}

export function buildBootstrapArchiveEntriesListCommand(archivePath: string) {
  return ["unzip", "-Z1", archivePath];
}

export async function* defaultIterateArchiveEntries(
  archivePath: string,
): AsyncGenerator<BootstrapArchiveEntry> {
  const yauzl = await loadYauzlPromise();
  const zip = await yauzl.open(archivePath);

  try {
    for await (const entry of zip) {
      yield {
        entryName: entry.filename,
        readText: async () =>
          readLimitedStreamText(
            await entry.openReadStream(),
            MAX_VULNERABILITY_TEXT_BYTES,
          ),
      };
    }
  } finally {
    await zip.close();
  }
}
