import { isArcadeGame, scoreArcadeRun } from './arcade-rules.js';

const origin='https://gamestorehunt.mooo.com';
const headers={
  'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Headers':'content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json',
  'Cache-Control':'no-store',
};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validToken=(value:unknown): value is string=>typeof value==='string' && uuid.test(value);

async function rpc(name:string, data:object) {
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const response=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key},
    body:JSON.stringify(data)
  });
  if (!response.ok) throw Error('Arcade database unavailable');
  return response.json();
}

Deno.serve(async request=>{
  if (request.headers.get('origin')!==origin) return respond({error:'Open the game to see arcade rankings.'},403);
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if (request.method!=='POST') return respond({error:'Method not allowed.'},405);

  let data;
  try {
    const body=await request.text();
    if (body.length>6500) return respond({error:'Invalid arcade request.'},400);
    data=JSON.parse(body);
  } catch {
    return respond({error:'Invalid arcade request.'},400);
  }
  if (!data || typeof data!=='object') return respond({error:'Invalid arcade request.'},400);
  const {op,game,profileToken,ticket,seed,events,elapsed}=data;
  if (!isArcadeGame(game)) return respond({error:'Choose an arcade game.'},400);
  const player_id=validToken(profileToken) ? profileToken : null;

  try {
    if (op==='list') return respond(await rpc('after_hours_arcade_rankings',{cabinet:game,player_id}));
    if (op!=='start' && op!=='finish') return respond({error:'Choose an arcade action.'},400);
    if (!player_id) return respond({error:'This arcade run needs a device profile.'},401);
    if (!validToken(ticket)) return respond({error:'Invalid arcade run.'},400);
    const run={cabinet:game,player_id,ticket};
    if (op==='start') {
      if (!Number.isInteger(seed) || seed<0 || seed>0xffffffff) return respond({error:'Invalid arcade run.'},400);
      const started=await rpc('after_hours_arcade_start',{...run,cue_seed:seed});
      return started ? respond({started:true}) : respond({error:'This arcade run couldn’t start online.'},409);
    }

    const runSeed=await rpc('after_hours_arcade_seed',run);
    const expired={error:'This run is saved on this device.',code:'run_expired'};
    if (runSeed===null) return respond(expired,409);
    const score=scoreArcadeRun(game,runSeed,events,elapsed);
    if (score===null) return respond({error:'This run couldn’t be posted.',code:'run_invalid'},422);
    const result=await rpc('after_hours_arcade_finish',{...run,run_score:score,elapsed_ms:elapsed});
    if (result.expired) return respond(expired,409);
    if (result.name_required) return respond({error:'Choose a username to post this score.',code:'username_required'},401);
    return respond(result,result.error ? 409 : 200);
  } catch {
    return respond({error:'Arcade rankings are temporarily unavailable.'},503);
  }
});
