const $ = id => document.getElementById(id);
const goal = 12;
const duration = 25000;
const symbols = ['←','↑','↓','→'];
const names = ['Left','Up','Down','Right'];
const notes = [392,494,587,698];
const cueDuration = hits => 2200-hits*82;

export function createCircuit({tone,best,award}) {
  const dialog = $('circuit-dialog'), start = $('circuit-start'), close = $('circuit-close');
  const message = $('circuit-message'), track = $('circuit-track');
  const count = $('circuit-score'), time = $('circuit-time'), health = $('circuit-health');
  const preview = $('circuit-queue');
  const tiles = Array.from({length:3},() => document.createElement('span'));
  preview.replaceChildren(...tiles);
  let run, last;

  const pads = names.map((name,i) => {
    const pad = document.createElement('button');
    pad.type = 'button';
    pad.className = 'circuit-pad';
    pad.setAttribute('aria-label',name);
    pad.textContent = symbols[i];
    pad.addEventListener('click',() => press(i));
    $('circuit-controls').append(pad);
    return pad;
  });

  function setEnabled(enabled) {
    pads.forEach(pad => { pad.disabled = !enabled; });
  }

  function showQueue(queue = []) {
    tiles.forEach((tile,i) => {
      tile.textContent = queue.length ? symbols[queue[i]] : '·';
      tile.className = 'circuit-cue'+(i === 0 && queue.length ? ' next' : '');
    });
    preview.setAttribute('aria-label',queue.length ? 'Next directions: '+queue.map(i=>names[i]).join(', ') : 'Direction queue');
  }

  function newDirection() {
    const next = Math.floor(Math.random() * (last === undefined ? 4 : 3));
    last = last !== undefined && next >= last ? next+1 : next;
    return last;
  }

  function updateTime(remaining) {
    time.textContent = (remaining/1000).toFixed(1);
    track.style.transform = 'scaleX('+remaining/duration+')';
  }

  function show() {
    count.textContent = '0 / '+goal;
    health.textContent = '3';
    $('circuit-best').textContent = best()+' / '+goal;
    $('circuit-reward').textContent = 'Earn credits for each correct direction.';
    message.textContent = 'Match 12 directions in 25 seconds. The arrows speed up as you go. Three mistakes end the run.';
    start.textContent = 'Start run';
    start.hidden = false;
    showQueue();
    updateTime(duration);
    setEnabled(false);
    dialog.showModal();
    start.focus();
  }

  function finish(reason) {
    const {hits} = run;
    run = null;
    setEnabled(false);
    showQueue();
    const reward = award(hits);
    $('circuit-best').textContent = best()+' / '+goal;
    message.textContent = reason;
    $('circuit-reward').textContent = reward ? '+'+reward+' CR earned' : 'Match a direction to earn credits.';
    start.textContent = 'Play again';
    start.hidden = false;
    start.focus();
  }

  function miss(now, reason) {
    health.textContent = String(--run.lives);
    tone(174,.18,0,'triangle');
    if (!run.lives) finish(reason);
    else run.cueEnds = now+cueDuration(run.hits);
  }

  function press(index) {
    if (!run) return;
    const now = performance.now();
    if (now >= run.ends) {
      updateTime(0);
      finish('Time’s up.');
      return;
    }
    if (now >= run.cueEnds) {
      miss(now,'Too many missed signals. Try the circuit again.');
      return;
    }
    if (index !== run.queue[0]) {
      miss(now,'Too many missed signals. Try the circuit again.');
      return;
    }
    run.queue.shift();
    run.queue.push(newDirection());
    tone(notes[index],.14,0,'triangle');
    count.textContent = ++run.hits+' / '+goal;
    if (run.hits === goal) finish('Circuit cleared! All 12 signals delivered.');
    else {
      run.cueEnds = now+cueDuration(run.hits);
      showQueue(run.queue);
    }
  }

  start.addEventListener('click',() => {
    if (run) return;
    last = undefined;
    const now = performance.now();
    run = {ends:now+duration,cueEnds:now+cueDuration(0),hits:0,lives:3,queue:Array.from({length:3},newDirection)};
    count.textContent = '0 / '+goal;
    health.textContent = '3';
    $('circuit-reward').textContent = 'Tap a direction or use the arrow keys.';
    message.textContent = 'Match the highlighted arrow.';
    start.hidden = true;
    close.focus();
    showQueue(run.queue);
    updateTime(duration);
    setEnabled(true);
  });
  close.addEventListener('click',() => dialog.close());
  dialog.addEventListener('close',() => { run = null; });

  return {
    show,
    get open() { return dialog.open; },
    keydown(event) {
      const index = ['ArrowLeft','ArrowUp','ArrowDown','ArrowRight'].indexOf(event.code);
      if (index < 0 || !run) return;
      event.preventDefault();
      if (!event.repeat) press(index);
    },
    tick(now) {
      if (!run) return;
      const remaining = Math.max(0,run.ends-now);
      updateTime(remaining);
      if (!remaining) {
        finish('Time’s up.');
        return;
      }
      if (now >= run.cueEnds) miss(now,'Too many missed signals. Try the circuit again.');
      if (run) tiles[0].style.setProperty('--cue-left',(run.cueEnds-now)/cueDuration(run.hits));
    }
  };
}
