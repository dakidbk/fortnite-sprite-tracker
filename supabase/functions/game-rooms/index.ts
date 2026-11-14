import { boardGames, newBoard, playBoard } from './lounge-rules.js';

const origin = 'https://gamestorehunt.mooo.com';
const headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bounded = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min,Math.min(max,value)) : fallback;

const usernamePattern = /^[A-Za-z][A-Za-z0-9_]{2,15}$/;
function rpc(name: string, data: object) {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key},
    body:JSON.stringify(data)
  });
}

type TableInput = {
  board: unknown; verb: unknown; kind: unknown; version: unknown; index: unknown; move: unknown;
};
async function tableAction(input: TableInput, code: string, token: string, px: number, pz: number) {
  const {board,verb,kind,version,index,move}=input;
  if ((board!==0 && board!==1) || typeof verb!=='string' || !['host','join','move','reset','leave'].includes(verb)) {
    return respond({error:'Choose a table and action.'},400);
  }
  const base={code,session_id:token,table_id:board,px,pz};
  let action={...base,verb};
  if (verb==='host') {
    if (typeof kind!=='string' || !Object.hasOwn(boardGames,kind)) return respond({error:'Choose a table game.'},400);
    action=Object.assign(action,{game_kind:kind});
  }
  if (verb==='move' || verb==='reset') {
    if (typeof version!=='number' || !Number.isSafeInteger(version) || version<=0 || typeof index!=='number' || !Number.isInteger(index) || index<0 || index>42
        || (verb==='move' && (typeof move!=='number' || !Number.isInteger(move) || move<0 || move>41))) {
      return respond({error:'Choose a valid move.'},400);
    }
    const snapshot=await rpc('after_hours_table_action',{...base,verb:'view'});
    if (!snapshot.ok) return respond({error:'The table is temporarily unavailable.'},503);
    const state=await snapshot.json();
    if (state.expired) return respond(state,410);
    const table=state.tables.find((table: {board: number})=>table.board===board);
    const side=table?.host===state.slot ? 1 : table?.guest===state.slot ? 2 : 0;
    if (!side || !table.guest) return respond({error:'Two players need to join this table.'},409);
    if (table.version!==version || index>table.moves.length || (verb==='reset' && index!==table.moves.length)) {
      return respond({error:'The table changed. Try again.'},409);
    }
    let position=newBoard(table.kind);
    for (const prior of table.moves.slice(0,index)) {
      const next=playBoard(position,prior);
      if (!next) return respond({error:'The table needs to be reopened.'},409);
      position=next;
    }
    if (verb==='reset') {
      if (position.winner===null) return respond({error:'Finish this round before starting another.'},409);
    } else {
      if (position.turn!==side || !playBoard(position,move)) return respond({error:'Choose a legal move on your turn.'},409);
      if (index<table.moves.length) {
        return table.moves[index]===move ? respond(state) : respond({error:'The table changed. Try again.'},409);
      }
    }
    action=Object.assign(action,{round_id:version,move_index:index,move_value:verb==='move' ? move : null});
  }
  const result=await rpc('after_hours_table_action',action);
  if (!result.ok) return respond({error:'The table is temporarily unavailable.'},503);
  const state=await result.json();
  return respond(state,state.expired ? 410 : state.error ? 409 : 200);
}

Deno.serve(async request => {
  if (request.headers.get('origin') !== origin) return respond({error:'Open the game to join a room.'}, 403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return respond({error:'Method not allowed.'},405);

  try {
    const text = await request.text();
    if (text.length > 1024) return respond({error:'Invalid request.'},400);
    const {op,room,token,x,z,yaw,stride,profileToken,username,chat,message,messageId,hunt,stamp,lounge,sitting,board,verb,kind,version,index,move} = JSON.parse(text);
    if (op === 'username') {
      if (typeof profileToken !== 'string' || !uuid.test(profileToken)) return respond({error:'Invalid profile.'},400);
      if (typeof username !== 'string' || !usernamePattern.test(username)) return respond({error:'Use 3–16 letters, numbers or underscores, starting with a letter.'},400);
      const result = await rpc('after_hours_reserve_name',{profile_token:profileToken,requested:username});
      if (!result.ok) return respond({error:'Username service is temporarily unavailable.'},503);
      const state = await result.json();
      return respond(state,state.error ? 409 : 200);
    }
    if (!['create','join','sync','leave','chat','stamp','table'].includes(op)) return respond({error:'Invalid action.'},400);
    const joining = op === 'create' || op === 'join';
    const code = op === 'create' ? crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase() : room;
    if (typeof code !== 'string' || !/^[A-F0-9]{12}$/.test(code)) return respond({error:'Enter a valid room code.'},400);
    if (!joining && (typeof token !== 'string' || !uuid.test(token))) return respond({error:'Invalid session.'},401);
    const px=bounded(x,-11,11,0), pz=bounded(z,-29,10,4.55);
    if (op==='table') return await tableAction({board,verb,kind,version,index,move},code,token,px,pz);
    const session = joining ? crypto.randomUUID() : token;
    const parameters = {
      op,code,session_id:session,px,pz,
      angle:bounded(yaw,-7,7,0),pace:bounded(stride,0,1.3,0),
      profile_token: joining && typeof profileToken === 'string' && uuid.test(profileToken) ? profileToken : null
    };
    const sending = op === 'chat';
    const withChat = sending || chat === true;
    let result: Response;
    if (sending) {
      const body = typeof message === 'string' ? message.trim() : '';
      if (!body || [...body].length > 60 || /[\u0000-\u001f\u007f-\u009f]/u.test(body) || !body.isWellFormed()) {
        return respond({error:'Enter a message up to 60 characters.'},400);
      }
      if (typeof messageId !== 'string' || !uuid.test(messageId)) return respond({error:'Invalid message.'},400);
      result = await rpc('after_hours_room_with_chat',{...parameters,message_text:body,nonce:messageId});
    } else if (op === 'stamp') {
      if (!Number.isInteger(stamp) || stamp < 0 || stamp > 5) return respond({error:'Invalid stamp.'},400);
      if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) {
        return respond({error:'Step closer to pick up the stamp.'},400);
      }
      result = await rpc('after_hours_room_with_hunt',{...parameters,stamp_id:stamp,with_chat:false});
    } else if (lounge === true && op !== 'leave') {
      result = await rpc('after_hours_room_with_lounge',{...parameters,with_chat:withChat,with_hunt:hunt===true,is_sitting:sitting===true});
    } else if (hunt === true && op !== 'leave') {
      result = await rpc('after_hours_room_with_hunt',{...parameters,with_chat:withChat});
    } else {
      result = await rpc(withChat ? 'after_hours_room_with_chat' : 'after_hours_room_named',parameters);
    }
    if (!result.ok) return respond({error:sending ? 'Could not send your message. Try again.' : 'Online rooms are temporarily unavailable.'},503);
    const state = await result.json();
    if (state.rate_limited) return respond(state,429);
    if (state.error || state.expired) return respond(state,state.expired ? 410 : 409);
    return respond(joining ? {...state,token:session} : state);
  } catch {
    return respond({error:'Could not reach the room server.'},400);
  }
});
