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

Deno.serve(async request => {
  if (request.headers.get('origin') !== origin) return respond({error:'Open the game to join a room.'}, 403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return respond({error:'Method not allowed.'},405);

  try {
    const text = await request.text();
    if (text.length > 1024) return respond({error:'Invalid request.'},400);
    const {op,room,token,x,z,yaw,stride} = JSON.parse(text);
    if (!['create','join','sync','leave'].includes(op)) return respond({error:'Invalid action.'},400);
    const joining = op === 'create' || op === 'join';
    const code = op === 'create' ? crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase() : room;
    if (typeof code !== 'string' || !/^[A-F0-9]{12}$/.test(code)) return respond({error:'Enter a valid room code.'},400);
    if (!joining && (typeof token !== 'string' || !uuid.test(token))) return respond({error:'Invalid session.'},401);
    const session = joining ? crypto.randomUUID() : token;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const result = await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/after_hours_room',{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:key!,Authorization:'Bearer '+key},
      body:JSON.stringify({op,code,session_id:session,px:bounded(x,-11,11,0),pz:bounded(z,-20,10,4.55),
        angle:bounded(yaw,-7,7,0),pace:bounded(stride,0,1.3,0)})
    });
    if (!result.ok) return respond({error:'Online rooms are temporarily unavailable.'},503);
    const state = await result.json();
    if (state.error || state.expired) return respond(state,state.expired ? 410 : 409);
    return respond(joining ? {...state,token:session} : state);
  } catch {
    return respond({error:'Could not reach the room server.'},400);
  }
});
