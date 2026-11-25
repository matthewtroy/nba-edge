export type OfficialCardLogAction = "published" | "republished" | "blocked";

export function logOfficialCard(action: OfficialCardLogAction, detail?: string): void {
  if (action === "blocked") {
    console.log(`official card: blocked: ${detail?.trim() || "unknown"}`);
    return;
  }
  const tail = detail?.trim() ? ` (${detail})` : "";
  console.log(`official card: ${action}${tail}`);
}