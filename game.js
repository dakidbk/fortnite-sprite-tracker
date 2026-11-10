import { Renderer, clamp, mix, model, project, smooth, viewProjection } from './webgl.js?v=wardrobe-4';
import { CABINET, CHECKOUT, SIGNAL_CABINET, STORE, canWalkOnPorch, createWorld, drawAvatar, storeHalfWidth } from './world.js?v=shop-drop-7';
import { GAMES, LATEST_RELEASE, RARITIES, atlasWidth, atlasHeight, coversPerAtlas, coverRegion } from './catalog.js';
import { createShop } from './shop.js?v=creator-inbox-8';
import { createSignalRelay } from './signal.js';
import { createOnline } from './online.js?v=wardrobe-4';
import { createMenu } from './menu.js?v=creator-inbox-8';

const $ = id => document.getElementById(id);
const canvas = $('world');
const game = canvas.parentElement;
const stick = $('move-stick');
const help = $('help-dialog'), arcade = $('arcade-dialog');
const caseDialog = $('case-dialog');
const coverAtlases = [...document.querySelectorAll('[data-cover-atlas]')];
const player = { x: 0, z: 4.55, yaw: 0 };
const keys = new Set();
const analog = { x: 0, z: 0 };
const orbit = { active: false, yaw: 0, pitch: .31, distance: 0 };
const movement = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight']);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const touchLayout = matchMedia('(max-width: 550px), (any-pointer: coarse)');
const duration = 20000, goal = 800;
const stations = {
  checkout: { spot: CHECKOUT, title: 'Checkout', prompt: 'Check out', radius: 1.43, y: 1.84 },
  arcade: { spot: CABINET, title: 'Neon Dash', prompt: 'Play Neon Dash', radius: 1.28, y: 2.66 },
  signal: { spot: SIGNAL_CABINET, title: 'Signal Relay', prompt: 'Play Signal Relay', radius: 1.28, y: 2.66 }
};
const collectorGoal = { titles: 5, rarities: 3 };

let renderer, world, introShown = false, running = false, lastFrame = 0, lastDraw = 0;
let door = 0, doorOpened = false, walkPhase = 0, stride = 0, inside = false, visited = false;
let toastTimeout, audio, camera = null, action = null;
let moveGesture = null, lookGesture = null;
let selectedGame = -1;
let sound = read('after-hours-sound') === 'on';
let best = Math.max(0, Number(read('after-hours-best')) || 0);
let round = null, target = -1, nextAt = 0, targetUntil = 0, lastTarget = -1;

const online = createOnline({
  clearMovement,
  position: () => ({x:player.x,z:player.z,yaw:Math.atan2(Math.sin(player.yaw),Math.cos(player.yaw)),stride})
});

const shop = createShop({
  beforeOpen: clearMovement, paintCover,
  onChange() { syncCaseVisibility(); refreshObjective(); menu.refreshShop(); },
  announce: message => { showToast(message); tone(523,.16,0,'triangle'); tone(784,.21,.095,'triangle'); }
});
const menu = createMenu({
  read, save, shop, toggleSound, toggleFullscreen,
  onPlay() {
    clearMovement();
    if (!online.openInvite()) canvas.focus();
  }
});

const signal = createSignalRelay({ tone, best: () => shop.state.signalBest, award: score => shop.recordArcade('signal',score) });

const tiles = Array.from({length: 9}, (_, i) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tile';
  button.textContent = i + 1;
  button.disabled = true;
  button.setAttribute('aria-label', 'Tile ' + (i + 1));
  button.addEventListener('click', () => hit(i));
  $('arcade-grid').append(button);
  return button;
});

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function save(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function refreshSound() {
  const button = $('sound-button');
  const label = sound ? 'Turn sound off' : 'Turn sound on';
  button.setAttribute('aria-pressed', String(sound));
  button.setAttribute('aria-label', label);
  button.title = label;
  $('menu-sound').setAttribute('aria-pressed',String(sound));
  $('menu-sound-value').textContent = sound ? 'On' : 'Off';
  button.querySelector('use').setAttribute('href', sound ? '#i-sound' : '#i-muted');
}

function tone(freq, length = .09, delay = 0, kind = 'sine') {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const osc = audio.createOscillator(), gain = audio.createGain();
    const t = audio.currentTime + delay;
    osc.type = kind;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.072, t + .013);
    gain.gain.exponentialRampToValueAtTime(.0001, t + length);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + length + .015);
  } catch {}
}

function refreshObjective() {
  const { owned, basket, arcadeEarned, credits } = shop.state;
  let step = 0, title = 'Head inside', description = 'Walk up to the doors of the game store.';
  if (visited) {
    if (!owned.length) {
      step = 1;
      title = 'Pick your first game';
      description = 'Tap a cover on the shelf and add it to your basket.';
    } else if (!arcadeEarned) {
      step = 2;
      title = 'Earn arcade credits';
      description = 'Try Neon Dash or Signal Relay at the back of the store.';
    } else {
      const rarities = new Set(owned.map(index => GAMES[index].rarity)).size;
      const complete = owned.length >= collectorGoal.titles && rarities >= collectorGoal.rarities;
      step = complete ? 4 : 3;
      title = complete ? 'Collector goal complete' : 'Build your collection';
      description = complete ? 'Your collection is ready to explore from your wallet.'
        : 'Collect five games across three rarities. ' + Math.min(owned.length,5) + '/5 games · ' + Math.min(rarities,3) + '/3 tiers.';
    }
    if (basket.length) {
      const missing = shop.basketTotal - credits;
      title = missing > 0 ? 'Earn more credits' : 'Head to checkout';
      description = missing > 0 ? 'Earn ' + missing + ' more CR at the arcade, or remove a case from your basket.'
        : 'Pay for the games in your basket at the counter on the right.';
    }
  }
  $('objective-count').textContent = '0' + Math.min(step + 1,4) + ' / 04';
  $('objective-title').textContent = title;
  $('objective-description').textContent = description;
  document.querySelectorAll('.objective-bars i').forEach((bar, i) => {
    bar.classList.toggle('active', i === step);
    bar.classList.toggle('done', i < step);
  });
}

function showToast(message) {
  const node = $('toast');
  clearTimeout(toastTimeout);
  node.textContent = message;
  node.hidden = false;
  toastTimeout = setTimeout(() => { node.hidden = true; }, 2300);
}

function updateBest() {
  const value = String(best).padStart(4, '0');
  $('arcade-best').textContent = value;
}

function stopStick() {
  if (!moveGesture) return;
  moveGesture = null;
  analog.x = analog.z = 0;
  stick.style.setProperty('--stick-x','0px');
  stick.style.setProperty('--stick-y','0px');
  stick.classList.remove('engaged');
}

function stopLook() {
  if (!lookGesture) return;
  lookGesture = null;
  game.classList.remove('looking');
}

function clearMovement() {
  keys.clear();
  stopStick();
  stopLook();
}

function modalOpen() {
  return menu.open || online.open || help.open || arcade.open || caseDialog.open || signal.open || shop.open;
}

function currentAction() {
  if (!doorOpened && player.z >= -.20 && Math.hypot(player.x, player.z - .28) <= 2.08) return 'doors';
  if (!inside) return null;
  let action = null, nearest = Infinity;
  for (const id in stations) {
    const {spot,radius} = stations[id];
    const distance = Math.hypot(player.x-spot.x,player.z-spot.approachZ);
    if (distance <= radius && distance < nearest) { action = id; nearest = distance; }
  }
  return action;
}

function interact() {
  if (!world || modalOpen()) return;
  const item = currentAction();
  if (item === 'doors') {
    doorOpened = true;
    tone(294, .19, 0, 'triangle');
    tone(440, .17, .065);
    tone(659, .18, .125);
    return;
  }
  if (item === 'arcade') openArcade();
  if (item === 'signal') { clearMovement(); signal.show(); }
  if (item === 'checkout') shop.openCheckout();
}

function paintCover(art,index,face) {
  const { x, y, w, h } = coverRegion(index,face);
  const page = coverAtlases[Math.floor(index/coversPerAtlas)];
  art.style.backgroundImage = 'url("' + (page.currentSrc || page.src) + '")';
  art.style.backgroundSize = 100*atlasWidth/w + '% ' + 100*atlasHeight/h + '%';
  art.style.backgroundPosition = 100*x/(atlasWidth-w) + '% ' + 100*y/(atlasHeight-h) + '%';
}

function showCaseFace(face) {
  if (selectedGame < 0) return;
  const art = $('case-art');
  paintCover(art,selectedGame,face);
  art.setAttribute('aria-label',(face === 'front' ? 'Front' : 'Back') + ' of ' + GAMES[selectedGame].title);
  $('case-front').setAttribute('aria-pressed',String(face === 'front'));
  $('case-back').setAttribute('aria-pressed',String(face === 'back'));
}

function syncCaseVisibility() {
  if (!world) return;
  const { owned, basket, caseSlots } = shop.state;
  const { caseGames, posterSlot } = world;
  const hidden = new Uint8Array(posterSlot + 1);
  for (const index of [...owned,...basket]) {
    const saved = caseSlots[index];
    // Older saves tracked the title alone. Choose one matching shelf copy.
    const slot = caseGames[saved] === index ? saved : caseGames.indexOf(index);
    if (slot > 0) hidden[slot] = 255;
  }
  renderer.setHiddenSlots(hidden);
}

function inspectCase(clientX,clientY) {
  if (!world || modalOpen()) return;
  const {left,top,width,height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const hit = renderer.pickCase(world.cases,(clientX-left)/width,(clientY-top)/height);
  const slot = hit === world.posterSlot ? world.caseGames.indexOf(LATEST_RELEASE) : hit;
  const index = world.caseGames[slot];
  const entry = GAMES[index];
  if (!entry) return;
  clearMovement();
  selectedGame = index;
  $('case-kicker').textContent = index === LATEST_RELEASE ? 'LATEST RELEASE' : 'GAME LIBRARY';
  $('case-title').textContent = entry.title;
  $('case-genre').textContent = entry.genre;
  $('case-blurb').textContent = entry.blurb;
  const rarity = RARITIES[entry.rarity], copies = world.stockCopies[index];
  caseDialog.style.setProperty('--case-rarity',rarity.color);
  $('case-art').setAttribute('data-rarity-mark',rarity.mark);
  $('case-rarity').textContent = rarity.label;
  shop.inspect(index,slot,copies);
  showCaseFace('front');
  caseDialog.showModal();
  caseDialog.scrollTop = 0;
  $('case-close').focus({ preventScroll: true });
}

function setTarget(i) {
  if (target !== -1) {
    tiles[target].classList.remove('target');
    tiles[target].setAttribute('aria-label', 'Tile ' + (target + 1));
  }
  target = i;
  if (target !== -1) {
    tiles[target].classList.add('target');
    tiles[target].setAttribute('aria-label', 'Lit tile ' + (target + 1));
  }
}

function updateRoundDisplay(ms, score) {
  $('arcade-score').textContent = String(score).padStart(4, '0');
  $('arcade-time').textContent = (ms / 1000).toFixed(1);
  $('time-fill').style.transform = 'scaleX(' + ms / duration + ')';
}

function openArcade() {
  clearMovement();
  round = null;
  setTarget(-1);
  tiles.forEach(tile => { tile.disabled = true; tile.classList.remove('miss'); });
  updateRoundDisplay(duration, 0);
  $('arcade-message').textContent = 'Hit the lit tiles for 20 seconds. Score 800 points for a credit bonus.';
  $('arcade-tip').textContent = 'Click, tap, or use keys 1–9.';
  const start = $('arcade-start');
  start.firstChild.textContent = 'Start game ';
  start.hidden = false;
  arcade.showModal();
  start.focus();
  tone(523, .13, 0, 'triangle');
  tone(784, .18, .08);
}

function startRound() {
  const now = performance.now();
  round = { ends: now + duration, score: 0, previousBest: best };
  targetUntil = 0;
  nextAt = now + 180;
  lastTarget = -1;
  setTarget(-1);
  tiles.forEach(tile => { tile.disabled = false; tile.classList.remove('miss'); });
  $('arcade-start').hidden = true;
  $('arcade-close').focus();
  $('arcade-message').textContent = 'Hit each tile while it’s lit.';
  $('arcade-tip').textContent = 'Click, tap, or use keys 1–9.';
  updateRoundDisplay(duration, 0);
  tone(659, .12, 0, 'triangle');
  tone(880, .17, .11);
}

function finishRound() {
  const { score, previousBest } = round;
  round = null;
  const reward = shop.recordArcade('neon',score);
  setTarget(-1);
  tiles.forEach(tile => { tile.disabled = true; });
  updateRoundDisplay(0, score);
  if (score >= goal) {
    $('arcade-message').textContent = 'Challenge cleared! You scored ' + score + ' points.';
    tone(523, .24, 0, 'triangle');
    tone(659, .22, .10, 'triangle');
    tone(784, .29, .21, 'triangle');
  } else {
    $('arcade-message').textContent = 'Time’s up. You scored ' + score + ' of the 800 points needed.';
    tone(392, .16);
    tone(294, .21, .11);
  }
  const result = score > previousBest ? 'New personal best' : 'Best score ' + best;
  $('arcade-tip').textContent = reward ? '+' + reward + ' CR earned · ' + result : result;
  const start = $('arcade-start');
  start.firstChild.textContent = 'Play again ';
  start.hidden = false;
  start.focus();
}

function tickRound(now) {
  if (!round) return;
  const remaining = Math.max(0, round.ends - now);
  if (!remaining) { finishRound(); return; }
  updateRoundDisplay(remaining, round.score);
  if (target !== -1 && now >= targetUntil) {
    setTarget(-1);
    nextAt = now + 130;
  }
  if (target === -1 && now >= nextAt) {
    const count = lastTarget === -1 ? 9 : 8;
    let choice = Math.floor(Math.random() * count);
    if (lastTarget !== -1 && choice >= lastTarget) choice++;
    lastTarget = choice;
    setTarget(choice);
    targetUntil = now + Math.max(490, 1280 - round.score * .29);
  }
}

function hit(i) {
  if (!round) return;
  const now = performance.now();
  if (now >= round.ends) { finishRound(); return; }
  if (i === target && now < targetUntil) {
    round.score += 100;
    setTarget(-1);
    nextAt = now + 150;
    if (round.score > best) {
      best = round.score;
      save('after-hours-best', String(best));
      updateBest();
    }
    tone(520 + Math.min(round.score, 1400) * .31, .112, 0, 'triangle');
    updateRoundDisplay(round.ends - now, round.score);
    return;
  }
  const tile = tiles[i];
  tile.classList.add('miss');
  setTimeout(() => tile.classList.remove('miss'), 155);
  tone(162, .09);
}

function allow(x, z) {
  const r = .245;
  if (z < -.27) {
    if (Math.abs(x) > storeHalfWidth(z) - .54 || z < STORE.back + .41) return false;
  } else if (!canWalkOnPorch(x,z,r)) return false;
  if (door < .78 && Math.abs(x) < 1.79 && z > -.19 - r && z < .25 + r) return false;
  return !world.obstacles.some(([l,h,b,f]) => {
    const dx = x - clamp(x,l,h), dz = z - clamp(z,b,f);
    return dx * dx + dz * dz < r * r;
  });
}

function move(dt) {
  if (modalOpen()) return;
  const on = (...codes) => codes.some(key => keys.has(key));
  const x = Number(on('KeyD','ArrowRight')) - Number(on('KeyA','ArrowLeft')) + analog.x;
  const z = Number(on('KeyS','ArrowDown')) - Number(on('KeyW','ArrowUp')) + analog.z;
  const sprint = on('ShiftLeft','ShiftRight');
  const active = Math.hypot(x,z);
  const effort = Math.min(1,active);
  let traveled = 0;
  if (active) {
    const yaw = orbit.active ? orbit.yaw : 0;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const speed = sprint ? 8.4 : 5.6;
    const pace = speed * dt * effort ** .28 / Math.max(1,active);
    const dx = (x*c + z*s) * pace, dz = (z*c - x*s) * pace;
    // Use short steps for collision checks when frames are slow.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx,dz)/.22));
    const stepX = dx/steps, stepZ = dz/steps;
    for (let i=0;i<steps;i++) {
      if (allow(player.x + stepX, player.z)) { player.x += stepX; traveled += Math.abs(stepX); }
      if (allow(player.x, player.z + stepZ)) { player.z += stepZ; traveled += Math.abs(stepZ); }
    }
    const want = Math.atan2(-dx,-dz);
    const arc = Math.atan2(Math.sin(want - player.yaw), Math.cos(want - player.yaw));
    player.yaw += arc * (1 - Math.exp(-dt * 17));
  }
  stride = mix(stride, traveled > 0 ? (sprint ? 1.10 : .83) * Math.sqrt(effort) : 0, 1 - Math.exp(-dt * 14));
  walkPhase += dt * (sprint ? 18.2 : 13.6) * (.53 + .47*effort);
  const newInside = player.z < -.52;
  if (newInside !== inside) {
    inside = newInside;
    $('zone').textContent = inside ? 'Inside the store' : 'Storefront';
    $('storefront-time').hidden = inside;
    if (inside && !visited) {
      visited = true;
      refreshObjective();
      showToast(touchLayout.matches ? 'Tap a cover to pick a game' : 'Click a cover to pick a game');
    }
  }
}

function cameraBlocked(x,y,z) {
  if (z < -.15) {
    const ceiling = z < STORE.taperStart ? 4.08 : 3.53;
    if (z < STORE.back+.32 || Math.abs(x) > storeHalfWidth(z)-.26 || y > ceiling) return true;
  }
  if (z >= -.23 && z <= .36 && Math.abs(x) < 1.66 && (door < .78 || y > 2.99)) return true;
  const pad = .11;
  return world.obstacles.some(([l,r,b,f,height]) => y < height + pad && x > l-pad && x < r+pad && z > b-pad && z < f+pad);
}

function orbitCamera(dt,aspect) {
  const y = 1.32, sin = Math.sin(orbit.yaw), cos = Math.cos(orbit.yaw);
  const level = Math.cos(orbit.pitch), up = Math.sin(orbit.pitch);
  const desired = inside ? 4.92 : 5.90;
  let safe = desired;
  for (let d=.16; d<desired+.16; d+=.16) {
    const sample = Math.min(d,desired);
    if (cameraBlocked(player.x + sin*level*sample, y + up*sample, player.z + cos*level*sample)) {
      safe = Math.max(.16,sample-.17);
      break;
    }
  }
  orbit.distance = orbit.distance ? Math.min(safe,mix(orbit.distance,safe,1-Math.exp(-dt*9))) : safe;
  const distance = orbit.distance;
  const ahead = mix(.49,1.04,smooth(.8,3.2,distance));
  camera = {
    eye: [player.x + sin*level*distance, y + up*distance, player.z + cos*level*distance],
    aim: [player.x - sin*ahead, 1.34, player.z - cos*ahead],
    fov: Math.max(1.01,2*Math.atan(.35 / Math.max(aspect,.43))),
    hideAvatar: distance < 1.10
  };
  return camera;
}

const wardrobeSpot = {x:0,z:4.68};
function cameraFor(dt, aspect, preview) {
  if (preview) {
    const wide = aspect > 1 && innerWidth > 650;
    return {
      eye: [0,1.55,wardrobeSpot.z+(wide ? 5.12 : 5.52)],
      aim: [wide ? -1.46 : 0,wide ? 1.10 : .25,wardrobeSpot.z],
      fov: wide ? .62 : .90,
      hideAvatar: true
    };
  }
  if (menu.open) {
    const wide = aspect > 1.32 && innerWidth > 650;
    return {
      eye: [0,6.55,24.1],
      aim: [wide ? -6.15 : 0,wide ? 1.72 : 1.25,0],
      fov: Math.max(.58,2*Math.atan(.326 / Math.max(aspect,.43))),
      hideAvatar: true
    };
  }
  if (orbit.active) return orbitCamera(dt,aspect);
  const blend = doorOpened ? smooth(.27,-2.78,player.z) : 0;
  const rear = smooth(STORE.taperStart,STORE.taperEnd,player.z);
  const exterior = [player.x * .48, 6.40, 24.10 + (player.z - 4.55) * .58];
  const close = [player.x * mix(.75,.63,rear), mix(2.97,3.43,rear), player.z + mix(4.02,4.60,rear)];
  const lookOutside = [player.x * .42, 1.41, -.05 + (player.z - 4.55) * .14];
  const lookInside = [player.x * .90, mix(1.15,1.36,rear), player.z - mix(2.88,3.23,rear)];
  const outsideFov = Math.max(.575, 2 * Math.atan(.326 / Math.max(aspect,.43)));
  const insideFov = Math.max(mix(.93,1.035,rear), 2 * Math.atan(mix(.31,.34,rear) / Math.max(aspect,.43)));
  const next = {
    eye: exterior.map((v,i) => mix(v, close[i], blend)),
    aim: lookOutside.map((v,i) => mix(v, lookInside[i], blend)),
    fov: mix(outsideFov, insideFov, blend)
  };
  if (!camera) camera = next;
  const a = 1 - Math.exp(-dt * 10);
  camera.eye = camera.eye.map((v,i) => mix(v,next.eye[i],a));
  camera.aim = camera.aim.map((v,i) => mix(v,next.aim[i],a));
  camera.fov = next.fov;
  return camera;
}

function waypoint(matrix) {
  const node = $('waypoint');
  const item = currentAction();
  if (action !== item) {
    action = item;
    const label = item === 'doors' ? 'Open doors' : stations[item]?.prompt || 'Interact';
    const button = $('touch-action');
    button.disabled = !item;
    button.setAttribute('aria-label',label);
    button.querySelector('span').textContent = label;
  }
  const entrance = !inside && !doorOpened;
  const { owned, basket, arcadeEarned, credits } = shop.state;
  let guidance = null;
  if (inside && basket.length && shop.basketTotal <= credits) guidance = 'checkout';
  else if (inside && (basket.length || (owned.length && !arcadeEarned))) guidance = 'arcade';
  const destination = item || (entrance ? 'doors' : guidance);
  if (modalOpen() || !destination) { node.hidden = true; return; }
  const station = stations[destination];
  const point = station ? [station.spot.x,station.y,station.spot.z+.32] : [0,2.48,.32];
  const [x,y,w] = project(matrix,point);
  if (w <= .3 || x < .07 || x > .93 || y < .13 || y > .88) { node.hidden = true; return; }
  node.style.left = x * 100 + '%';
  node.style.top = y * 100 + '%';
  node.classList.toggle('hint', !item);
  node.tabIndex = item ? 0 : -1;
  $('waypoint-text').textContent = station ? (item ? station.prompt : station.title) : (item ? 'Open doors' : 'Entrance');
  node.hidden = false;
}

function draw(dt, now) {
  renderer.resize();
  const aspect = canvas.width / canvas.height;
  const preview = menu.preview;
  const { eye, aim, fov, hideAvatar } = cameraFor(dt, aspect, preview);
  const matrix = viewProjection(eye,aim,fov,aspect);
  const offset = smooth(0,1,door) * 1.515;
  const doors = [model(-offset,0,0),model(offset,0,0)];
  renderer.begin(matrix,eye);
  world.opaque.forEach(mesh => renderer.draw(mesh));
  const { owned, basket } = shop.state;
  const releaseState = owned.includes(LATEST_RELEASE) ? 'sold' : basket.includes(LATEST_RELEASE) ? 'basket' : 'available';
  renderer.draw(world.releasePosters[releaseState]);
  world.doors.forEach(([mesh],i) => renderer.draw(mesh,doors[i]));
  renderer.blend(true);
  world.decals.forEach(mesh => renderer.draw(mesh));
  if (preview || !menu.open) {
    const spot = preview ? wardrobeSpot : player;
    renderer.draw(world.avatarShadow,model(spot.x,0,spot.z));
  }
  renderer.blend(false);
  if (!hideAvatar) drawAvatar(renderer,world,player,walkPhase,stride,reduced.matches ? 0 : now/1000,menu.look);
  if (preview) {
    drawAvatar(renderer,world,{...wardrobeSpot,yaw:Math.PI+preview.angle},0,0,0,preview.look);
  }
  if (!menu.open) online.draw(matrix,eye,dt,peer => {
    drawAvatar(renderer,world,peer,peer.phase,peer.stride,reduced.matches ? 0 : now/1000);
  });
  renderer.blend(true);
  world.transparent.forEach(mesh => renderer.draw(mesh));
  world.doors.forEach(([,glass],i) => renderer.draw(glass,doors[i]));
  renderer.end();
  waypoint(matrix);
}

function frame(now) {
  if (!running) return;
  const dt = Math.min((now - lastFrame) / 1000, .20);
  lastFrame = now;
  move(dt);
  if (doorOpened && door < 1) door = Math.min(1,door + dt * 1.91);
  tickRound(now);
  signal.tick(now);
  const interval = modalOpen() ? 65 : stride > .03 ? 12 : 28;
  if (now - lastDraw >= interval) {
    draw(Math.min((now - lastDraw) / 1000,.125),now);
    lastDraw = now;
  }
  requestAnimationFrame(frame);
}

async function startup() {
  const loading = coverAtlases.filter(atlas => !atlas.complete);
  if (loading.length) await Promise.all(loading.map(atlas => atlas.decode().catch(() => {})));
  if (coverAtlases.length !== Math.ceil(GAMES.length/coversPerAtlas) || coverAtlases.some(atlas => atlas.naturalWidth !== atlasWidth || atlas.naturalHeight !== atlasHeight)) {
    $('load').hidden = false;
    $('load').querySelector('p').textContent = 'The cover artwork could not load. Refresh to try again.';
    return;
  }
  try {
    renderer = new Renderer(canvas);
    world = createWorld(renderer,coverAtlases);
    syncCaseVisibility();
    camera = null;
    draw(1,performance.now());
    $('load').hidden = true;
    if (!running) {
      running = true;
      if (!introShown) {
        menu.show();
        introShown = true;
      }
      lastFrame = lastDraw = performance.now();
      requestAnimationFrame(frame);
    }
  } catch (error) {
    console.error(error);
    $('load').hidden = false;
    $('load').querySelector('p').textContent = 'This game needs a browser with WebGL 2 enabled.';
  }
}

function resetCamera() {
  if (!orbit.active) return;
  stopLook();
  orbit.active = false;
  orbit.yaw = 0;
  orbit.pitch = .31;
  orbit.distance = 0;
  camera = null;
  $('reset-camera').hidden = true;
}

function openCollection() {
  if (world && !modalOpen()) shop.openCollection();
}

canvas.addEventListener('pointerdown', event => {
  if (modalOpen() || (event.pointerType === 'mouse' && event.button !== 0)) return;
  const rect = canvas.getBoundingClientRect();
  const {clientX:x,clientY:y,pointerId:id} = event;
  const useStick = (event.pointerType === 'touch' || touchLayout.matches) && x < rect.left + rect.width/2;
  if (useStick) {
    if (moveGesture) return;
    moveGesture = {id,x,y,dragging:false};
    stick.style.setProperty('--stick-left',clamp(x-rect.left,46,Math.max(46,rect.width/2-8))+'px');
    stick.style.setProperty('--stick-top',clamp(y-rect.top,49,rect.height-49)+'px');
    stick.classList.add('engaged');
  } else {
    if (lookGesture) return;
    lookGesture = {id,x,y,dragging:false};
  }
  event.preventDefault();
  canvas.setPointerCapture(id);
});

canvas.addEventListener('pointermove', event => {
  const {clientX:x,clientY:y,pointerId:id} = event;
  if (moveGesture?.id === id) {
    const dx = x-moveGesture.x, dy = y-moveGesture.y;
    const length = Math.hypot(dx,dy), reach = Math.min(1,length/36);
    moveGesture.dragging ||= reach > .12;
    const force = Math.max(0,(reach-.12)/.88) / Math.max(1,length);
    const thumb = 24*reach / Math.max(1,length);
    analog.x = dx*force;
    analog.z = dy*force;
    stick.style.setProperty('--stick-x',dx*thumb+'px');
    stick.style.setProperty('--stick-y',dy*thumb+'px');
  } else if (lookGesture?.id === id) {
    const dx = x-lookGesture.x, dy = y-lookGesture.y;
    if (!lookGesture.dragging && Math.hypot(dx,dy) < 4) return;
    if (!orbit.active) {
      orbit.active = true;
      if (camera) orbit.yaw = Math.atan2(camera.eye[0]-camera.aim[0],camera.eye[2]-camera.aim[2]);
      $('reset-camera').hidden = false;
    }
    lookGesture.dragging = true;
    lookGesture.x = x;
    lookGesture.y = y;
    const yaw = orbit.yaw - dx*(event.pointerType === 'mouse' ? .0065 : .009);
    orbit.yaw = Math.atan2(Math.sin(yaw),Math.cos(yaw));
    orbit.pitch = clamp(orbit.pitch + dy*.0054,.08,.69);
    game.classList.add('looking');
  }
});

for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  canvas.addEventListener(type, event => {
    const move = moveGesture?.id === event.pointerId;
    const look = lookGesture?.id === event.pointerId;
    const gesture = move ? moveGesture : look ? lookGesture : null;
    if (!gesture) return;
    const tap = type === 'pointerup' && !gesture.dragging && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y) < 5;
    if (move) stopStick();
    if (look) stopLook();
    if (tap) inspectCase(event.clientX,event.clientY);
  });
}

$('main-menu-button').addEventListener('click', () => {
  if (!world || modalOpen()) return;
  clearMovement();
  menu.show();
});
$('waypoint').addEventListener('click', interact);
$('touch-action').addEventListener('click', interact);
$('collection-button').addEventListener('click',openCollection);
$('reset-camera').addEventListener('click', resetCamera);
$('help-button').addEventListener('click', () => {
  clearMovement();
  help.showModal();
});
$('help-close').addEventListener('click', () => help.close());
$('resume-button').addEventListener('click', () => help.close());
$('case-front').addEventListener('click', () => showCaseFace('front'));
$('case-back').addEventListener('click', () => showCaseFace('back'));
$('case-close').addEventListener('click', () => caseDialog.close());
caseDialog.addEventListener('close', () => {
  if (!caseDialog.open) { selectedGame = -1; shop.clearInspection(); }
});
$('arcade-close').addEventListener('click', () => arcade.close());
$('arcade-start').addEventListener('click', startRound);
arcade.addEventListener('close', () => {
  round = null;
  setTarget(-1);
  clearMovement();
});
function toggleSound() {
  sound = !sound;
  save('after-hours-sound', sound ? 'on' : 'off');
  refreshSound();
  tone(612,.13,0,'triangle');
}
$('sound-button').addEventListener('click',toggleSound);

const fullscreen = $('fullscreen-button');
fullscreen.hidden = !document.fullscreenEnabled;
$('menu-fullscreen').disabled = !document.fullscreenEnabled;
if (!document.fullscreenEnabled) $('menu-fullscreen-value').textContent = 'Unavailable';
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $('menu-fullscreen-value').textContent = 'Unavailable';
    if (!menu.open) showToast('Fullscreen is unavailable here');
  }
}
fullscreen.addEventListener('click',toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const active = !!document.fullscreenElement;
  const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
  fullscreen.setAttribute('aria-label', label);
  fullscreen.setAttribute('aria-pressed', String(active));
  fullscreen.title = label;
  $('menu-fullscreen-value').textContent = active ? 'Exit' : 'Enter';
  fullscreen.querySelector('use').setAttribute('href',active ? '#i-window' : '#i-full');
});

document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (arcade.open && round && /^[1-9]$/.test(event.key)) {
    event.preventDefault();
    if (!event.repeat) hit(Number(event.key)-1);
    return;
  }
  if (signal.open && /^[1-4]$/.test(event.key)) {
    event.preventDefault();
    if (!event.repeat) signal.press(Number(event.key)-1);
    return;
  }
  if (modalOpen()) return;
  if (movement.has(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }
  if (!event.repeat && event.code === 'KeyE') {
    event.preventDefault();
    interact();
  }
  if (!event.repeat && event.code === 'KeyR') resetCamera();
  if (!event.repeat && event.code === 'KeyC') openCollection();
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', clearMovement);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearMovement(); });

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  running = false;
  clearMovement();
  $('load').querySelector('p').textContent = 'Reconnecting to WebGL';
  $('load').hidden = false;
});
canvas.addEventListener('webglcontextrestored', startup);

refreshSound();
updateBest();
refreshObjective();
requestAnimationFrame(startup);
