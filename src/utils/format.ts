export function sydneyTimeFromIso(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export { marketLabel } from "@lib/market-label";

export function verdict(price: number, takeAt: number): "value" | "fair" | "pass" {
  if (price >= takeAt) return "value";
  if (price >= takeAt * 0.95) return "fair";
  return "pass";
}