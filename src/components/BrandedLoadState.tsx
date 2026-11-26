import { userFacingLoadMessage, type DataLoadKind } from "@lib/data-load-error";

interface Props {
  kind?: DataLoadKind;
  title?: string;
}

export function BrandedLoadState({ kind = "unknown", title = "NBA Edge" }: Props) {
  return (
    <div
      className="rounded-card border border-white/[0.08] bg-card px-4 py-6 text-center"
      role="status"
    >
      <p className="text-sm font-semibold text-white/90">{title}</p>
      <p className="text-sm text-white/60 mt-2">{userFacingLoadMessage(kind)}</p>
    </div>
  );
}