import { GAMES } from './catalog.js';

export const shiftReward = 75;
const $ = id => document.getElementById(id);
export const today = () => new Date().toISOString().slice(0,10);

export function shiftState(profile) {
  const day = today();
  const saved = profile.shift?.day === day ? profile.shift : {};
  const inspected = Array.isArray(saved.inspected)
    ? [...new Set(saved.inspected.filter(id => Number.isInteger(id) && id >= 0 && id < GAMES.length))].slice(0,3) : [];
  return {
    day, inspected, purchase:saved.purchase === true || profile.owned.length === GAMES.length,
    arcade:saved.arcade === true, claimed:saved.claimed === true
  };
}

export function shiftComplete(shift) {
  return shift.inspected.length >= 3 && shift.purchase && shift.arcade;
}

export function createShift({shop,clearMovement,ready}) {
  const dialog = $('shift-dialog'), claim = $('shift-claim');
  let clock, renderedDay;
  function refresh() {
    const state = shiftState(shop.state);
    renderedDay = state.day;
    const tasks = [
      ['Browse the shelves','Inspect three different game cases in the store.',state.inspected.length,3],
      ['Add to your collection','Buy a game at checkout. A complete library also qualifies.',Number(state.purchase),1],
      ['Arcade break','Finish a round and earn credits at either arcade.',Number(state.arcade),1]
    ];
    const completed = tasks.filter(([, ,count,goal]) => count >= goal).length;
    $('shift-hud').textContent = state.claimed ? 'Done' : completed+'/3';
    $('shift-button').classList.toggle('shift-ready',shiftComplete(state) && !state.claimed);
    $('shift-progress').textContent = completed+' / 3 goals complete';
    $('shift-tasks').replaceChildren(...tasks.map(([title,description,count,goal]) => {
      const li = document.createElement('li');
      li.className = 'shift-task'+(count >= goal ? ' complete' : '');
      const header = document.createElement('div'), name = document.createElement('strong'), score = document.createElement('span');
      name.textContent = title;
      score.textContent = count+' / '+goal;
      header.append(name,score);
      const detail = document.createElement('p');
      detail.textContent = description;
      li.append(header,detail);
      return li;
    }));
    claim.disabled = state.claimed || !shiftComplete(state);
    claim.textContent = state.claimed ? 'Reward claimed' : 'Claim '+shiftReward+' CR';
    $('shift-status').textContent = state.claimed ? 'Shift complete. Come back for a new challenge after the reset.'
      : shiftComplete(state) ? 'All goals complete. Your reward is ready.' : 'Complete all three goals to claim the reward.';
    updateClock();
  }

  function updateClock() {
    const remaining = Math.ceil((86400000-Date.now()%86400000)/1000);
    $('shift-countdown').textContent = [Math.floor(remaining/3600),Math.floor(remaining/60)%60,remaining%60].map(n=>String(n).padStart(2,'0')).join(':');
  }

  function open() {
    if (!ready() || dialog.open) return;
    clearMovement();
    refresh();
    dialog.showModal();
    clock = setInterval(() => {
      if (renderedDay !== today()) refresh();
      else updateClock();
    },1000);
  }
  $('shift-button').addEventListener('click',open);
  $('shift-close').addEventListener('click',() => dialog.close());
  dialog.addEventListener('close',() => clearInterval(clock));
  claim.addEventListener('click',async () => {
    claim.disabled = true;
    try {
      await shop.claimShift();
      refresh();
    } catch {
      $('shift-status').textContent = 'Could not save the reward. Try again.';
      claim.disabled = false;
    }
  });
  refresh();
  return {open,refresh,get isOpen() { return dialog.open; }};
}
