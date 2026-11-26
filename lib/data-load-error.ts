export type DataLoadKind = "network" | "missing" | "unknown";

export class DataLoadError extends Error {
  readonly kind: DataLoadKind;

  constructor(kind: DataLoadKind) {
    super(kind);
    this.name = "DataLoadError";
    this.kind = kind;
  }
}

export function userFacingLoadMessage(kind: DataLoadKind): string {
  switch (kind) {
    case "network":
      return "Feed temporarily unavailable. Pull to refresh in a moment.";
    case "missing":
      return "Slate data is not available yet.";
    default:
      return "Something went wrong loading picks.";
  }
}