import { useState } from "react";
import { playerInitials } from "@lib/player-headshot";
import { headshotPublicUrl } from "@lib/headshot-display";

export function PlayerAvatar({
  name,
  playerId,
  headshotUrl,
  className = "w-8 h-8 rounded-full bg-white/10 object-cover shrink-0",
}: {
  name: string;
  playerId?: string;
  headshotUrl?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolved =
    playerId && playerId.length
      ? headshotPublicUrl(playerId, headshotUrl, import.meta.env.BASE_URL)
      : headshotUrl?.trim();
  const showImg = resolved && !failed;
  if (!showImg) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center bg-white/10 text-[10px] font-semibold text-white/70`}
        aria-hidden
      >
        {playerInitials(name)}
      </span>
    );
  }
  return (
    <img
      src={resolved}
      alt=""
      className={className.replace(/\bbg-page\b/, "bg-white/10")}
      onError={() => setFailed(true)}
    />
  );
}