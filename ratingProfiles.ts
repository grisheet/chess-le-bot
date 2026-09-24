export const presets = [
  { elo: 500, name: "Beginner" },
  { elo: 800, name: "Casual" },
  { elo: 1200, name: "Intermediate" },
  { elo: 1600, name: "Club player" },
  { elo: 2000, name: "Advanced" },
  { elo: 2400, name: "Expert" },
  { elo: 2800, name: "Master" },
];
const profiles = [
  { elo: 400, loss: 240, spread: 190, awareness: 0.12, topChance: 0.13 },
  { elo: 700, loss: 170, spread: 140, awareness: 0.25, topChance: 0.18 },
  { elo: 1000, loss: 105, spread: 95, awareness: 0.42, topChance: 0.25 },
  { elo: 1300, loss: 65, spread: 55, awareness: 0.58, topChance: 0.34 },
  { elo: 1600, loss: 35, spread: 30, awareness: 0.74, topChance: 0.43 },
  { elo: 2000, loss: 16, spread: 17, awareness: 0.9, topChance: 0.57 },
  { elo: 2400, loss: 5, spread: 8, awareness: 0.97, topChance: 0.7 },
  { elo: 3000, loss: 1, spread: 4, awareness: 1, topChance: 0.9 },
];
export function ratingProfile(elo: number) {
  const e = Math.max(400, Math.min(3000, elo));
  let i = profiles.findIndex((p) => p.elo >= e);
  if (i <= 0) i = 1;
  const a = profiles[i - 1],
    b = profiles[i],
    t = (e - a.elo) / (b.elo - a.elo);
  const mix = (key: "loss" | "spread" | "awareness" | "topChance") =>
    a[key] + (b[key] - a[key]) * t;
  return {
    elo: e,
    loss: mix("loss"),
    spread: mix("spread"),
    awareness: mix("awareness"),
    topChance: mix("topChance"),
  };
}
export function profileSummary(elo: number): string {
  if (elo < 700)
    return "Spots simple ideas, but may miss one-move threats and loose pieces.";
  if (elo < 1000)
    return "Favors obvious captures and checks; development is still a work in progress.";
  if (elo < 1300)
    return "Finds reasonable moves, but can overlook multi-move tactics.";
  if (elo < 1600)
    return "Balances development and king safety, with occasional tactical oversights.";
  if (elo < 2000)
    return "Mostly sensible moves; deeper tactics can still be missed.";
  if (elo < 2400)
    return "Strong tactical awareness, with variation among the best candidates.";
  return "Very precise play, with small variations among high-quality moves.";
}
export const QUALITY_THRESHOLDS = [
  ["Best", 10],
  ["Excellent", 25],
  ["Good", 60],
  ["Inaccuracy", 120],
  ["Mistake", 250],
  ["Blunder", Infinity],
] as const;
