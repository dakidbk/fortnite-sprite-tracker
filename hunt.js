import { clamp } from './webgl.js';
import { stockDestination, stockRunState } from './economy.js?v=store-economy-19';

export const huntReward = 120;
export const stamps = [
  { x:-5.42, z:6.82, label:'Porch', clue:'Look near the benches on the west side of the porch.', color:'#dda066' },
  { x:2.63, z:-2.38, label:'Entry', clue:'Check just inside the door near the controller display.', color:'#a8c8b1' },
  { x:-5.54, z:-8.22, label:'Library', clue:'Search the left side of the first display table.', color:'#deb277' },
  { x:6.58, z:-9.44, label:'Demo desk', clue:'Follow the glow from the demo monitors into the right aisle.', color:'#a8b9d4' },
  { x:7.48, z:-13.92, label:'Checkout', clue:'Look at the far end of the checkout counter.', color:'#dab3be' },
  { x:-.98, z:-16.39, label:'Arcade', clue:'Check the floor by the row of arcade cabinets.', color:'#cbb6db' }
];

export const stampRadius = 1.17;
export const stampHeight = .89;
export const fullStampMask = (1 << stamps.length) - 1;
export const stampMask = value => Number.isInteger(value) && value >= 0 && value <= fullStampMask ? value : 0;
export const huntDay = () => new Date().toISOString().slice(0,10);
export const hasStamp = (mask,index) => Boolean(mask & (1 << index));

export function huntState(profile) {
  const day = huntDay();
  const saved = profile.hunt?.day === day ? profile.hunt : {};
  return {day, mask:stampMask(saved.mask), claimed:saved.claimed === true};
}

const $ = id => document.getElementById(id);
const mapX = x => clamp(50+x*4.31,4,96);
const mapY = z => clamp((z+20.4)*3.16,4,96);

export function createHunt({ shop, ready, clearMovement, getPosition, getFriends, connected, collectInRoom, announce }) {
  const dialog = $('hunt-dialog'), claim = $('hunt-claim');
  const status = $('hunt-status'), mapPlayer = $('hunt-map-player');
  const stockPin = $('hunt-map-stock'), stockLegend = $('hunt-legend-stock');
  const mapFriends = Array.from({length:3},() => {
    const dot = document.createElement('span');
    dot.className = 'hunt-map-friend';
    dot.hidden = true;
    $('hunt-map-friends').append(dot);
    return dot;
  });
  let room, roomMask = 0, roomDay, pending = false, clock = 0, displayedDay, displayedMask = 0;
  const lists = stamps.map(({label,clue,x,z},index) => {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    const detail = document.createElement('span');
    name.textContent = label;
    detail.textContent = clue;
    item.append(name,detail);
    $('hunt-clues').append(item);
    const pin = document.createElement('span');
    pin.className = 'hunt-pin';
    pin.textContent = String(index+1);
    pin.style.left = mapX(x)+'%';
    pin.style.top = mapY(z)+'%';
    pin.hidden = true;
    $('hunt-map-pins').append(pin);
    return {item,pin};
  });

  function activeMask() {
    return displayedMask;
  }

  function refresh() {
    const personal = huntState(shop.state);
    displayedDay = personal.day;
    const mask = room ? (roomDay === personal.day ? roomMask : 0) : personal.mask;
    displayedMask = mask;
    const count = stamps.filter((_,index) => hasStamp(mask,index)).length;
    $('hunt-mode').textContent = room ? 'ROOM HUNT' : 'DAILY HUNT';
    $('hunt-legend-friends').hidden = !room;
    $('hunt-progress').textContent = count+' / '+stamps.length+' stamps';
    $('hunt-button').classList.toggle('hunt-ready',count === stamps.length && !personal.claimed);
    for (const [index,{item,pin}] of lists.entries()) {
      const found = hasStamp(mask,index);
      item.classList.toggle('found',found);
      pin.classList.toggle('found',found);
    }
    claim.disabled = personal.claimed || mask !== fullStampMask;
    claim.textContent = personal.claimed ? 'Reward claimed' : 'Claim '+huntReward+' CR';
  }

  function updateMap() {
    const {x,z} = getPosition();
    mapPlayer.style.left = mapX(x)+'%';
    mapPlayer.style.top = mapY(z)+'%';
    const delivery = stockDestination(stockRunState(shop.state));
    stockPin.hidden = stockLegend.hidden = !delivery;
    if (delivery) {
      stockPin.style.left = mapX(delivery.x)+'%';
      stockPin.style.top = mapY(delivery.z)+'%';
      stockLegend.textContent = delivery.label;
    }
    const friends = getFriends();
    mapFriends.forEach((dot,index) => {
      const friend = friends[index];
      dot.hidden = !friend;
      if (!friend) return;
      dot.style.left = mapX(friend.x)+'%';
      dot.style.top = mapY(friend.z)+'%';
      dot.title = friend.username || 'Player '+friend.slot;
    });
  }

  function open() {
    if (dialog.open || !ready()) return;
    clearMovement();
    updateMap();
    status.textContent = '';
    refresh();
    dialog.showModal();
    $('hunt-close').focus();
  }

  function setRoom(current, mask, day) {
    const value = stampMask(mask);
    if (current && current === room && day && roomDay && day < roomDay) return;
    if (current === room && day === roomDay) {
      const added = value & ~roomMask;
      if (!added) return;
      roomMask |= value;
      if (current) {
        const found = stamps.find((_,index) => hasStamp(added,index));
        announce(roomMask === fullStampMask ? 'Room hunt complete · Claim your reward on the map' : 'Room stamp found · '+found.label);
      }
    } else {
      roomMask = value;
    }
    room = current;
    roomDay = day;
    refresh();
  }

  function nearby() {
    const mask = activeMask();
    const {x,z} = getPosition();
    return stamps.findIndex((stamp,index) => !hasStamp(mask,index) && Math.hypot(x-stamp.x,z-stamp.z) <= stampRadius);
  }

  async function collect(index) {
    if (index < 0 || index !== nearby()) return;
    if (connected()) {
      if (pending) return;
      pending = true;
      try {
        await collectInRoom(index);
      } catch (error) {
        announce(error.message || 'Try picking up that stamp again.');
      } finally {
        pending = false;
      }
    } else if (shop.recordStamp(index)) {
      announce(activeMask() === fullStampMask ? 'Hunt complete · Claim your reward on the map' : 'Stamp found · '+stamps[index].label);
    }
  }

  $('hunt-button').addEventListener('click',open);
  $('hunt-close').addEventListener('click',() => dialog.close());
  $('hunt-hints').addEventListener('click',() => {
    const button = $('hunt-hints');
    const show = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed',String(show));
    button.textContent = show ? 'Hide stamp locations' : 'Show stamp locations';
    for (const {pin} of lists) pin.hidden = !show;
  });
  claim.addEventListener('click',async () => {
    claim.disabled = true;
    try {
      if (room && activeMask() === fullStampMask) await shop.claimHunt({day:roomDay,mask:roomMask});
      else await shop.claimHunt();
      refresh();
      if (huntState(shop.state).claimed) status.textContent = 'Added '+huntReward+' CR to your wallet.';
    } catch {
      status.textContent = 'Could not save your reward. Try again.';
      refresh();
    }
  });

  return {
    open, refresh, setRoom, nearby, collect, activeMask,
    get isOpen() { return dialog.open; },
    tick(now) {
      if (now < clock) return;
      clock = now+1000;
      if (displayedDay !== huntDay()) refresh();
      if (dialog.open) updateMap();
    }
  };
}
