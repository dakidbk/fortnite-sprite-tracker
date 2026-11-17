export const neonRules = { duration:20000, tileCount:9, points:100, firstDelay:180, hitDelay:150, missDelay:130 };
export const signalRules = { levels:8, pads:4, firstLength:2, watchDelay:560, litFor:380, darkFor:190 };
export const circuitRules = { duration:25000, goal:12, lives:3, directions:4, queueLength:3 };
export const attemptLimit = 45*60*1000;

export const neonDwell = score => Math.max(490,1280-score*.29);
export const circuitDwell = hits => 2200-hits*82;

export function arcadeRandom(seed) {
  let state=seed;
  return ()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/0x100000000;
  };
}

export function nextArcadeCue(random, size, previous=-1) {
  const choice=Math.floor(random()*(size-(previous>=0 ? 1 : 0)));
  return previous>=0 && choice>=previous ? choice+1 : choice;
}

const integer = (value,min,max) => Number.isInteger(value) && value>=min && value<=max;

function neonScore(random,events,elapsed) {
  const {duration,tileCount,points,firstDelay,hitDelay,missDelay}=neonRules;
  if (elapsed<duration || events.length>133) return null;
  let next=firstDelay, previous=-1, score=0;
  for (const event of events) {
    if (!Array.isArray(event) || event.length<2 || event.length>3) return null;
    const [shown,tile,hit]=event;
    previous=nextArcadeCue(random,tileCount,previous);
    if (!integer(shown,Math.floor(next),duration-1) || tile!==previous) return null;
    const expires=shown+neonDwell(score);
    if (event.length===3) {
      if (!integer(hit,shown,Math.min(Math.ceil(expires),duration-1))) return null;
      score+=points;
      next=hit+hitDelay;
    } else next=expires+missDelay;
  }
  return score;
}

function signalScore(random,events,elapsed) {
  const {levels,pads,firstLength,watchDelay,litFor,darkFor}=signalRules;
  const sequence=Array.from({length:firstLength},()=>nextArcadeCue(random,pads));
  const watchTime=()=>watchDelay+sequence.length*(litFor+darkFor);
  let earliest=watchTime(), step=0, cleared=0, finished=false;
  for (const event of events) {
    if (!Array.isArray(event) || event.length!==2 || finished) return null;
    const [at,pad]=event;
    if (!integer(at,earliest,elapsed) || !integer(pad,0,pads-1)) return null;
    if (sequence[step]!==pad) {
      finished=true;
      continue;
    }
    earliest=at;
    if (++step<sequence.length) continue;
    if (++cleared===levels) {
      finished=true;
      continue;
    }
    sequence.push(nextArcadeCue(random,pads));
    earliest+=watchTime();
    step=0;
  }
  return finished ? cleared : null;
}

function circuitScore(random,events,elapsed) {
  const {duration,goal,directions,queueLength}=circuitRules;
  let lives=circuitRules.lives, hits=0, previous=-1, last=0, cueEnd=circuitDwell(0);
  const next=()=>previous=nextArcadeCue(random,directions,previous);
  const queue=Array.from({length:queueLength},next);
  for (const event of events) {
    if (!Array.isArray(event) || event.length!==2 || !lives || hits===goal) return null;
    const [at,direction]=event;
    if (!integer(at,last,Math.min(duration-1,elapsed)) || !integer(direction,-1,directions-1)) return null;
    if (direction===-1 ? at<cueEnd : at>=cueEnd) return null;
    last=at;
    if (direction!==queue[0]) lives--;
    else {
      hits++;
      queue.shift();
      queue.push(next());
    }
    cueEnd=at+circuitDwell(hits);
  }
  return !lives || hits===goal || elapsed>=duration ? hits : null;
}

const scorers={neon:neonScore,signal:signalScore,circuit:circuitScore};
const eventLimits={neon:133,signal:44,circuit:14};
export const isArcadeGame = game => typeof game==='string' && Object.hasOwn(scorers,game);

export function scoreArcadeRun(game,seed,events,elapsed) {
  if (!isArcadeGame(game) || !integer(seed,0,0xffffffff) || !Array.isArray(events)
    || events.length>eventLimits[game] || !integer(elapsed,0,attemptLimit)) return null;
  return scorers[game](arcadeRandom(seed),events,elapsed);
}
