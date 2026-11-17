import { nextArcadeCue, signalRules } from './supabase/functions/arcade-rankings/arcade-rules.js?v=arcade-rankings-24';

const $ = id => document.getElementById(id);
const symbols = ['◆','●','▲','■'];
const labels = ['diamond','circle','triangle','square'];
const notes = [330,440,554,659];
const {levels:lastLevel,firstLength,watchDelay,litFor,darkFor} = signalRules;

export function createSignalRelay({ tone, best, award, rankings }) {
  const dialog = $('signal-dialog'), start = $('signal-start'), close = $('signal-close');
  const message = $('signal-message'), status = $('signal-status');
  let phase = 'ready', sequence = [], completed = 0, playbackAt = 0, inputAt = 0, lit = -1, next = 0, ranked;
  const randomPad=()=>nextArcadeCue(ranked?.random || Math.random,pads.length);
  const pads = symbols.map((symbol,i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'signal-pad';
    button.disabled = true;
    button.setAttribute('aria-label','Pad ' + (i+1) + ', ' + labels[i]);
    const shape = document.createElement('span');
    shape.textContent = symbol;
    const key = document.createElement('kbd');
    key.textContent = i+1;
    button.append(shape,key);
    button.addEventListener('click',() => press(i));
    $('signal-grid').append(button);
    return button;
  });

  function light(index) {
    if (lit >= 0) pads[lit].classList.remove('lit');
    lit = index;
    if (lit >= 0) pads[lit].classList.add('lit');
  }

  function enablePads(enabled) {
    pads.forEach(pad => { pad.disabled = !enabled; });
  }

  function show() {
    rankings?.reset('signal');
    phase = 'ready';
    completed = 0;
    light(-1);
    enablePads(false);
    message.textContent = 'Watch the pads light up, then repeat the pattern. Each level adds one signal.';
    status.textContent = 'Earn credits for every completed level.';
    $('signal-level').textContent = '0';
    $('signal-best').textContent = String(best());
    start.textContent = 'Start relay';
    start.hidden = false;
    dialog.showModal();
    start.focus();
  }

  function cue(now) {
    phase = 'watch';
    light(-1);
    enablePads(false);
    playbackAt = inputAt = 0;
    next = now + watchDelay;
    message.textContent = 'Watch the pattern for level ' + (completed + 1) + '.';
    status.textContent = 'Watch the pads';
  }

  function tick(now) {
    if (phase === 'repeat' && lit >= 0 && now >= next) light(-1);
    if (phase !== 'watch' || now < next) return;
    if (lit >= 0) {
      light(-1);
      next = now + darkFor;
      return;
    }
    if (playbackAt === sequence.length) {
      phase = 'repeat';
      enablePads(true);
      message.textContent = 'Your turn. Repeat the pattern in order.';
      status.textContent = '0 / ' + sequence.length + ' signals';
      return;
    }
    const index = sequence[playbackAt++];
    light(index);
    tone(notes[index],.20,0,'triangle');
    next = now + litFor;
  }

  function finish() {
    phase = 'done';
    light(-1);
    enablePads(false);
    const reward = award(completed);
    rankings?.finish('signal',ranked,performance.now(),completed);
    $('signal-best').textContent = String(best());
    message.textContent = completed === lastLevel
      ? 'All eight levels cleared!'
      : completed ? 'Pattern missed. You cleared ' + completed + (completed === 1 ? ' level.' : ' levels.') : 'Pattern missed. Try the relay again.';
    status.textContent = reward ? '+' + reward + ' CR earned' : 'Complete a level to earn credits.';
    start.textContent = 'Play again';
    start.hidden = false;
    start.focus();
  }

  function press(index) {
    if (phase !== 'repeat') return;
    const now=performance.now();
    if (ranked) ranked.events.push([ranked.stamp(now),index]);
    if (sequence[inputAt] !== index) {
      tone(176,.20,0,'triangle');
      finish();
      return;
    }
    inputAt++;
    light(index);
    tone(notes[index],.11,0,'triangle');
    next = now + 140;
    status.textContent = inputAt + ' / ' + sequence.length + ' signals';
    if (inputAt !== sequence.length) return;
    completed++;
    $('signal-level').textContent = String(completed);
    if (completed === lastLevel) {
      tone(784,.23,.12,'triangle');
      finish();
    } else {
      sequence.push(randomPad());
      cue(now);
    }
  }

  start.addEventListener('click',() => {
    if (phase==='watch' || phase==='repeat') return;
    const now=performance.now();
    ranked=rankings?.begin('signal',now);
    completed = 0;
    sequence = Array.from({length:firstLength},randomPad);
    $('signal-level').textContent = '0';
    start.hidden = true;
    close.focus();
    cue(now);
  });
  close.addEventListener('click',() => dialog.close());
  dialog.addEventListener('close',() => {
    phase = 'ready';
    ranked=undefined;
    rankings?.reset('signal');
    light(-1);
    enablePads(false);
  });

  return { show, tick, press, get open() { return dialog.open; } };
}
