export function skipOfficialPublishOnRun(input: {
  forceOdds: boolean;
  republishCard: boolean;
  fromLive: boolean;
  publishNow?: boolean;
}): boolean {
  if (input.publishNow) return false;
  return input.forceOdds && !input.fromLive && !input.republishCard;
}