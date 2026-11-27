const NAME_SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;

/** Family name for copy (drops Jr/Sr/II–V style suffixes). */
export function playerLastName(fullName: string): string {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && NAME_SUFFIX.test(parts[parts.length - 1]!)) {
    parts.pop();
  }
  return parts.length ? parts[parts.length - 1]! : String(fullName).trim();
}