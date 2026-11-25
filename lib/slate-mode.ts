export type SlateMode = "auto" | "next";

export function parseSlateMode(argv: string[] = process.argv): SlateMode {
  const arg = argv.find((a) => a.startsWith("--slate="));
  if (arg) return arg.split("=")[1] === "next" ? "next" : "auto";
  if (process.env.SLATE_MODE === "next") return "next";
  return "auto";
}

export function parsePreviewFlag(argv: string[] = process.argv): boolean {
  if (argv.includes("--preview")) return true;
  return process.env.SLATE_PREVIEW === "1";
}