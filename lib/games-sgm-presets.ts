export type GamesSgmPreset = { label: string; min: number; max: number };

/** Games tab price filters; every one is frozen at the 9pm publish. */
export const GAMES_SGM_PRESETS: GamesSgmPreset[] = [
  { label: "1.5–4", min: 1.5, max: 4 },
  { label: "3–6", min: 3, max: 6 },
  { label: "4–10", min: 4, max: 10 },
  { label: "10–20", min: 10, max: 20 },
  { label: "20–50", min: 20, max: 50 },
  { label: "50+", min: 50, max: Number.POSITIVE_INFINITY },
];
