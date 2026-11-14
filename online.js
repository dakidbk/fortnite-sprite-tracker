import { clamp, mix, project } from './webgl.js';

import { profileToken } from './username.js?v=usernames-10';

const endpoint = 'https://fwjthjqevmukrovpbvfx.supabase.co/functions/v1/game-rooms';
const roomPattern = /^[A-F0-9]{12}$/;
const interval = 280;
const requestTimeout = 6500;
const chatLimit = 60;
const chatLifetime = 10000;

async function request(payload, keepalive = false) {
  const response = await fetch(endpoint,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload), keepalive, signal:AbortSignal.timeout(requestTimeout)
  });
  const result = await response.json();
  if (!response.ok && !result.expired) throw Error(result.error || 'Online rooms are temporarily unavailable.');
  return result;
}

export function createOnline({ clearMovement, position, onEnter, canOccupy, onHunt }) {
  const $ = id => document.getElementById(id);
  const dialog = $('online-dialog'), button = $('online-button');
  const field = $('room-code'), status = $('room-status'), invite = $('room-invite');
  const lobby = $('room-lobby'), connected = $('room-connected');
  const tags = $('room-tags');
  const chatButton = $('chat-button'), chatDialog = $('chat-dialog'), chatLog = $('room-chat-log');
  const chatInput = $('chat-message'), chatSend = $('chat-send'), chatStatus = $('chat-status');
  const peers = new Map();
  const captions = new Map();
  const recentMessages = new Map();
  let tableStates = [], tablesSupported = false, tableEpoch = 0;
  let session, timer, pending = false, count = 0, reconnecting = false;
  let composing = false, draft, sending;
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

  function captionFor(slot) {
    if (captions.has(slot)) return captions.get(slot);
    const label = document.createElement('div');
    label.className = 'room-caption';
    label.dataset.slot = slot;
    label.style.visibility = 'hidden';
    const bubbles = document.createElement('div');
    bubbles.className = 'room-bubbles';
    label.append(bubbles);
    const caption = {label,bubbles};
    if (slot !== session.slot) {
      const name = document.createElement('span');
      name.className = 'room-tag';
      label.append(name);
      caption.name = name;
    }
    tags.append(label);
    captions.set(slot,caption);
    return caption;
  }

  function apply(roster) {
    count = roster.length;
    const slots = new Set();
    for (const player of roster) {
      if (player.slot === session.slot || !Number.isFinite(player.x) || !Number.isFinite(player.z) || !canOccupy(player.x,player.z)) continue;
      slots.add(player.slot);
      let peer = peers.get(player.slot);
      if (!peer) {
        peer = {...player, phase:0};
        peers.set(player.slot,peer);
      }
      peer.target = player;
      captionFor(player.slot).name.textContent = player.username || 'Player '+player.slot;
    }
    for (const slot of peers.keys()) {
      if (slots.has(slot)) continue;
      captions.get(slot).label.remove();
      captions.delete(slot);
      peers.delete(slot);
    }
  }

  function showMessages(messages, started) {
    if (!Array.isArray(messages)) return;
    chatButton.hidden = false;
    const now = performance.now();
    for (const [key, message] of recentMessages) {
      if (message.forgetAt <= now) recentMessages.delete(key);
    }
    for (const {id, slot, username, text, remaining_ms} of messages) {
      const key = slot+':'+id;
      const remaining = Math.min(chatLifetime,remaining_ms) - (now-started)/2;
      if (recentMessages.has(key) || !(remaining > 0)) continue;

      const announcement = document.createElement('div');
      announcement.textContent = (username || 'Player '+slot)+': '+text;
      chatLog.append(announcement);
      const bubble = document.createElement('div');
      bubble.className = 'room-chat-message';
      bubble.dir = 'auto';
      bubble.textContent = text;
      const fade = Math.min(1500,remaining);
      bubble.style.setProperty('--fade-delay',(remaining-fade)+'ms');
      bubble.style.setProperty('--fade-duration',fade+'ms');
      captionFor(slot).bubbles.append(bubble);
      recentMessages.set(key,{
        timer: setTimeout(() => { bubble.remove(); announcement.remove(); },remaining),
        forgetAt: now+chatLifetime+requestTimeout
      });
    }
  }

  function applyHunt(state) {
    if (!Number.isInteger(state.hunt) || typeof state.hunt_day !== 'string') return;
    session.hunt = true;
    onHunt(session.room,state.hunt,state.hunt_day);
  }

  function applyTables(state) {
    if (!Array.isArray(state.tables)) return;
    tableStates = state.tables;
    tablesSupported = true;
  }

  async function tableAction(board,verb,fields) {
    const current=session;
    if (!current || !tablesSupported) throw Error('The room tables are reconnecting.');
    tableEpoch++;
    try {
      const state=await request({op:'table',room:current.room,token:current.token,...position(),...fields,board,verb});
      if (session!==current) return;
      if (state.expired) {
        clearSession('Your room connection expired. Create or join a room again.');
        return;
      }
      applyTables(state);
    } finally {
      tableEpoch++;
    }
  }

  async function collectStamp(stamp) {
    const current = session;
    if (!current?.hunt) throw Error('The room hunt is reconnecting. Try again.');
    const state = await request({op:'stamp',room:current.room,token:current.token,stamp,...position()});
    if (session !== current) return;
    if (state.expired) {
      clearSession('Your room connection expired. Create or join a room again.');
      return;
    }
    applyHunt(state);
  }

  function updateChatInput() {
    const characters = [...chatInput.value];
    if (!composing && characters.length > chatLimit) chatInput.value = characters.slice(0,chatLimit).join('');
    $('chat-count').textContent = (composing ? characters.length : Math.min(chatLimit,characters.length))+' / '+chatLimit;
    chatInput.readOnly = !!sending;
    chatSend.disabled = !!sending || composing || !chatInput.value.trim();
  }

  function openChat() {
    if (!session || chatButton.hidden || dialog.open || chatDialog.open) return false;
    clearMovement();
    if (!sending) chatStatus.textContent = '';
    chatDialog.showModal();
    chatInput.focus();
    return true;
  }

  async function sendChat(event) {
    event.preventDefault();
    if (!session || !chatDialog.open || sending || composing) return;
    const message = chatInput.value.trim();
    if (!message || [...message].length > chatLimit) return;
    const current = session;
    if (draft?.message !== message) draft = {message,messageId:crypto.randomUUID()};
    const outgoing = draft;
    sending = outgoing;
    chatStatus.textContent = 'Sending…';
    updateChatInput();
    const started = performance.now();
    try {
      const state = await request({op:'chat',room:current.room,token:current.token,...outgoing});
      if (session !== current) return;
      if (state.expired) {
        clearSession('Your room connection expired. Create or join a room again.');
        return;
      }
      showMessages(state.messages,started);
      chatInput.value = '';
      chatStatus.textContent = '';
      draft = null;
      if (chatDialog.open) chatDialog.close();
    } catch (error) {
      if (session === current) chatStatus.textContent = error.name === 'Error' ? error.message : 'Could not send your message. Try again.';
    } finally {
      if (sending === outgoing) {
        sending = null;
        updateChatInput();
      }
    }
  }

  function clearSession(message) {
    clearTimeout(timer);
    session = null;
    tablesSupported = false;
    tableStates = [];
    onHunt(null,0);
    count = 0;
    reconnecting = false;
    peers.clear();
    captions.clear();
    tags.replaceChildren();
    for (const {timer} of recentMessages.values()) clearTimeout(timer);
    recentMessages.clear();
    chatLog.replaceChildren();
    composing = false;
    draft = sending = null;
    chatInput.value = '';
    chatStatus.textContent = '';
    if (chatDialog.open) chatDialog.close();
    chatButton.hidden = true;
    updateChatInput();
    showState(message);
  }

  async function sync(current) {
    if (session !== current) return;
    const start = performance.now();
    const epoch=tableEpoch;
    try {
      const state = await request({op:'sync',room:current.room,token:current.token,...position(),chat:true,hunt:true,lounge:true});
      if (session !== current) return;
      if (state.expired) {
        clearSession('Your room connection expired. Create or join a room again.');
        return;
      }
      apply(state.players);
      showMessages(state.messages,start);
      applyHunt(state);
      if (epoch===tableEpoch) applyTables(state);
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
    const started = performance.now();
    try {
      const state = await request({op,room,profileToken:profileToken(),...roomEntry,chat:true,hunt:true,lounge:true});
      const current = {room:state.room,token:state.token,slot:state.slot};
      if (!dialog.open) {
        await request({op:'leave',...current},true).catch(() => {});
        return;
      }
      session = current;
      onHunt(current.room,0);
      const url = new URL(location.pathname,location.origin);
      url.searchParams.set('room',session.room);
      invite.value = url.href;
      field.value = session.room;
      $('room-current-code').textContent = session.room;
      apply(state.players);
      showMessages(state.messages,started);
      applyHunt(state);
      applyTables(state);
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
  chatButton.addEventListener('click',openChat);
  $('chat-close').addEventListener('click',() => chatDialog.close());
  $('chat-form').addEventListener('submit',sendChat);
  chatInput.addEventListener('input',() => {
    chatStatus.textContent = '';
    updateChatInput();
  });
  chatInput.addEventListener('compositionstart',() => {
    composing = true;
    updateChatInput();
  });
  chatInput.addEventListener('compositionend',() => {
    composing = false;
    updateChatInput();
  });
  chatDialog.addEventListener('close',() => {
    composing = false;
    updateChatInput();
  });
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

  function positionCaption(caption, matrix, eye, head) {
    const {label,bubbles,name} = caption;
    if (!head || (!name && !bubbles.firstElementChild)) {
      label.style.visibility = 'hidden';
      return;
    }
    const [x,y,w] = project(matrix,head);
    const visible = w >= .3 && Math.hypot(eye[0]-head[0],eye[2]-head[2]) <= 26 && x >= .04 && x <= .96 && y >= .11 && y <= .88;
    label.style.visibility = visible ? '' : 'hidden';
    if (visible) {
      label.style.setProperty('--caption-x',(clamp(x,0,1)*100)+'vw');
      label.style.top = (clamp(y,0,1)*100)+'%';
    }
  }

  return {
    get connected() { return !!session; },
    get slot() { return session?.slot; },
    get tables() { return tableStates; },
    get tablesSupported() { return tablesSupported; },
    tableAction,
    get friends() { return Array.from(peers.values(),peer => peer.target); },
    collectStamp,
    get open() { return dialog.open || chatDialog.open; },
    openChat,
    openMenu: open,
    openInvite() {
      if (!roomPattern.test(codeFromLink || '')) return false;
      codeFromLink = null;
      open();
      enter('join');
      return true;
    },
    draw(matrix, eye, dt, localHead, render) {
      if (!session) return;
      const localCaption = captions.get(session.slot);
      if (localCaption) positionCaption(localCaption,matrix,eye,localHead);
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
        peer.sitting = target.sitting === true;
        const difference = target.yaw-peer.yaw;
        peer.yaw += Math.atan2(Math.sin(difference),Math.cos(difference))*blend;
        peer.phase += dt*13.6;
        positionCaption(captions.get(peer.slot),matrix,eye,render(peer));
      }
    }
  };
}
