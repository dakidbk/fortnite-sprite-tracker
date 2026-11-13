import { clamp, mix, project } from './webgl.js';

import { profileToken } from './username.js?v=usernames-10';

const endpoint = 'https://fwjthjqevmukrovpbvfx.supabase.co/functions/v1/game-rooms';
const roomPattern = /^[A-F0-9]{12}$/;
const interval = 280;

async function request(payload, keepalive = false) {
  const response = await fetch(endpoint,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload), keepalive, signal:AbortSignal.timeout(6500)
  });
  const result = await response.json();
  if (!response.ok && !result.expired) throw Error(result.error || 'Online rooms are temporarily unavailable.');
  return result;
}

export function createOnline({ clearMovement, position, onEnter, canOccupy }) {
  const $ = id => document.getElementById(id);
  const dialog = $('online-dialog'), button = $('online-button');
  const field = $('room-code'), status = $('room-status'), invite = $('room-invite');
  const lobby = $('room-lobby'), connected = $('room-connected');
  const tags = $('room-tags');
  const peers = new Map();
  let session, timer, pending = false, count = 0, reconnecting = false;
  let codeFromLink = new URL(location.href).searchParams.get('room')?.toUpperCase();
  if (roomPattern.test(codeFromLink || '')) field.value = codeFromLink;

  function showState(message) {
    lobby.hidden = !!session;
    connected.hidden = !session;
    button.setAttribute('aria-label', session ? 'Online room, '+count+' of 4 players' : 'Online play, up to 4 players');
    button.title = button.getAttribute('aria-label');
    button.classList.toggle('connected',!!session);
    if (session) $('room-count').textContent = count+' / 4 players';
    if (message !== undefined) status.textContent = message;
  }

  function apply(roster) {
    count = roster.length;
    const slots = new Set();
    for (const player of roster) {
      if (player.slot === session.slot || !Number.isFinite(player.x) || !Number.isFinite(player.z) || !canOccupy(player.x,player.z)) continue;
      slots.add(player.slot);
      let peer = peers.get(player.slot);
      if (!peer) {
        const tag = document.createElement('span');
        tag.className = 'room-tag';
        tag.dataset.slot = player.slot;
        tags.append(tag);
        peer = {...player, phase:0, tag};
        peers.set(player.slot,peer);
      }
      peer.target = player;
      peer.tag.textContent = player.username || 'Player '+player.slot;
    }
    for (const [slot,peer] of peers) {
      if (slots.has(slot)) continue;
      peer.tag.remove();
      peers.delete(slot);
    }
  }

  function clearSession(message) {
    clearTimeout(timer);
    session = null;
    count = 0;
    reconnecting = false;
    peers.clear();
    tags.replaceChildren();
    showState(message);
  }

  async function sync(current) {
    if (session !== current) return;
    const start = performance.now();
    try {
      const state = await request({op:'sync',...current,...position()});
      if (session !== current) return;
      if (state.expired) {
        clearSession('Your room connection expired. Create or join a room again.');
        return;
      }
      apply(state.players);
      showState(reconnecting ? 'Reconnected.' : undefined);
      reconnecting = false;
    } catch {
      if (session !== current) return;
      if (!reconnecting) showState('Connection interrupted. Reconnecting…');
      reconnecting = true;
    }
    timer = setTimeout(() => sync(current),Math.max(50,interval-(performance.now()-start)));
  }

  async function enter(op) {
    if (pending || session) return;
    const room = field.value.trim().toUpperCase();
    if (op === 'join' && !roomPattern.test(room)) {
      status.textContent = 'Enter the 12-character room code.';
      field.focus();
      return;
    }
    const roomEntry = { x:0, z:4.55, yaw:0, stride:0 };
    pending = true;
    $('room-create').disabled = $('room-join').disabled = true;
    showState(op === 'create' ? 'Creating your room…' : 'Joining room…');
    try {
      const state = await request({op,room,profileToken:profileToken(),...roomEntry});
      const current = {room:state.room,token:state.token,slot:state.slot};
      if (!dialog.open) {
        await request({op:'leave',...current},true).catch(() => {});
        return;
      }
      session = current;
      const url = new URL(location.pathname,location.origin);
      url.searchParams.set('room',session.room);
      invite.value = url.href;
      field.value = session.room;
      $('room-current-code').textContent = session.room;
      apply(state.players);
      showState('Share the invite with up to three friends.');
      dialog.close();
      onEnter(roomEntry, session.room);
      timer = setTimeout(() => sync(current),interval);
    } catch (error) {
      showState(error.name === 'Error' ? error.message : 'Could not reach the room server. Try again.');
    } finally {
      pending = false;
      $('room-create').disabled = $('room-join').disabled = false;
    }
  }

  function leave() {
    if (!session) return;
    const current = session;
    clearSession('You left the room.');
    request({op:'leave',...current},true).catch(() => {});
  }

  function open() {
    if (dialog.open) return;
    clearMovement();
    dialog.showModal();
  }

  button.addEventListener('click',open);
  $('online-close').addEventListener('click',() => dialog.close());
  $('room-play').addEventListener('click',() => dialog.close());
  $('room-create').addEventListener('click',() => enter('create'));
  $('room-form').addEventListener('submit',event => { event.preventDefault(); enter('join'); });
  $('room-leave').addEventListener('click',leave);
  $('room-copy').addEventListener('click',async () => {
    try {
      await navigator.clipboard.writeText(invite.value);
      status.textContent = 'Invite link copied.';
    } catch {
      invite.focus();
      invite.select();
      status.textContent = 'Copy the selected invite link.';
    }
  });
  window.addEventListener('pagehide',leave);

  return {
    get open() { return dialog.open; },
    openMenu: open,
    openInvite() {
      if (!roomPattern.test(codeFromLink || '')) return false;
      codeFromLink = null;
      open();
      enter('join');
      return true;
    },
    draw(matrix, eye, dt, render) {
      const blend = 1-Math.exp(-dt*13);
      for (const peer of peers.values()) {
        const target = peer.target;
        const x = mix(peer.x,target.x,blend), z = mix(peer.z,target.z,blend);
        if (canOccupy(x,z)) {
          peer.x = x;
          peer.z = z;
        } else {
          peer.x = target.x;
          peer.z = target.z;
        }
        peer.stride = mix(peer.stride,target.stride,blend);
        const difference = target.yaw-peer.yaw;
        peer.yaw += Math.atan2(Math.sin(difference),Math.cos(difference))*blend;
        peer.phase += dt*13.6;
        render(peer);
        const [screenX,screenY,w] = project(matrix,[peer.x,2.08,peer.z]);
        const distance = Math.hypot(eye[0]-peer.x,eye[2]-peer.z);
        peer.tag.hidden = w < .3 || distance > 26 || screenX < .04 || screenX > .96 || screenY < .11 || screenY > .88;
        if (!peer.tag.hidden) {
          peer.tag.style.left = (clamp(screenX,0,1)*100)+'%';
          peer.tag.style.top = (clamp(screenY,0,1)*100)+'%';
        }
      }
    }
  };
}
