export const startingCredits = 0;
export const stockRunPay = 50;
export const arcadePayLimit = {neon:60, signal:80, circuit:60};

export function arcadePayout(mode, score) {
  if (!Number.isSafeInteger(score) || score <= 0) return 0;
  switch (mode) {
    case 'neon':
      return Math.min(arcadePayLimit.neon,Math.floor(score/50)+(score >= 800 ? 12 : 0));
    case 'signal':
      return score <= 8 ? score*8+(score === 8 ? 16 : 0) : 0;
    case 'circuit':
      return score <= 12 ? score*4+(score === 12 ? 12 : 0) : 0;
    default:
      return 0;
  }
}

export const stockStops = [
  {x:4.68,z:-4.92,label:'Accessories aisle'},
  {x:-6.48,z:-11.86,label:'Game library'},
  {x:4.28,z:-17.24,label:'Back counter'}
];
const stockRoutes = [[0,1,2],[1,0,2],[0,2,1],[2,1,0],[1,2,0],[2,0,1]];

export function stockRunState(profile) {
  const saved = profile.stockRun;
  const completed = Number.isSafeInteger(saved?.completed) && saved.completed >= 0 ? saved.completed : 0;
  const progress = Number.isInteger(saved?.progress) && saved.progress >= 0 && saved.progress < stockStops.length
    ? saved.progress : null;
  return {completed,progress};
}

export function stockDestination(run) {
  if (run.progress === null) return;
  return stockStops[stockRoutes[run.completed % stockRoutes.length][run.progress]];
}
