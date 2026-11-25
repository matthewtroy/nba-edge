export function skipOfficialPublishOnRun(input: {
  forceOdds: boolean;
  republishCard: boolean;
  fromLive: boolean;
}): boolean {
  return input.forceOdds && !input.fromLive && !input.republishCard;
}