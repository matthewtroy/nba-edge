import fs from "fs";
import path from "path";

export class JsonFileParseError extends Error {
  constructor(
    public readonly filePath: string,
    cause?: unknown
  ) {
    super(`JSON parse failed: ${filePath}`, { cause });
    this.name = "JsonFileParseError";
  }
}

/** Read JSON from disk; missing file returns `emptyIfMissing`. Corrupt files throw. */
export function readJsonFile<T>(filePath: string, emptyIfMissing: T): T {
  if (!fs.existsSync(filePath)) return emptyIfMissing;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (e) {
    throw new JsonFileParseError(filePath, e);
  }
}

export function atomicWriteJsonSync(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}