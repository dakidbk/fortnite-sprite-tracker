import { createUsernameEditor, profileToken, profileUsername } from './username.js?v=arcade-rankings-24';
import { arcadeRandom } from './supabase/functions/arcade-rankings/arcade-rules.js?v=arcade-rankings-24';

const $ = id => document.getElementById(id);
const endpoint='https://fwjthjqevmukrovpbvfx.supabase.co/functions/v1/arcade-rankings';
const units={neon:'Points',signal:'Levels',circuit:'Signals'};
const number=new Intl.NumberFormat('en-US');

async function request(body) {
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    signal:AbortSignal.timeout(5500),
    body:JSON.stringify(body)
  });
  const data=await response.json();
  if (!response.ok) throw Error(data.error || 'Arcade rankings are temporarily unavailable.');
  return data;
}

export function createLeaderboards({clearMovement,best}) {
  const dialog=$('leaderboard-dialog'), table=$('ranking-table'), rows=$('ranking-rows');
  const status=$('ranking-status'), retry=$('ranking-retry'), setName=$('ranking-name-open'), nameForm=$('ranking-name-form');
  const games=Object.keys(units);
  const links=Object.fromEntries(games.map(game=>[game,$(game+'-rankings')]));
  const latest=new Map();
  let selected='neon', lookup=0;
  const editor=createUsernameEditor({
    prefix:'ranking-name',
    onSave() {
      nameForm.hidden=true;
      $('ranking-'+selected).focus();
      refresh();
    }
  });

  function personal(entry) {
    const name=profileUsername();
    const score=best(selected);
    setName.hidden=Boolean(name);
    $('ranking-personal-label').textContent=name ? 'Your rank' : 'Your profile';
    $('ranking-personal').textContent=entry ? '#'+entry.rank+' · '+number.format(entry.score)+' '+units[selected].toLowerCase()
      : name ? 'Complete a run to get ranked' : 'Set a username to post scores';
    $('ranking-local').textContent=score && score!==entry?.score ? 'Best on this device · '+number.format(score) : '';
  }

  async function refresh() {
    const id=++lookup;
    const game=selected;
    dialog.dataset.game=game;
    for (const key of games) $('ranking-'+key).setAttribute('aria-pressed',String(key===game));
    $('ranking-unit').textContent=units[game];
    personal(null);
    retry.hidden=true;
    table.hidden=true;
    status.textContent='Loading scores…';
    try {
      const {leaders,personal:entry}=await request({op:'list',game,profileToken:profileToken()});
      if (!dialog.open || id!==lookup) return;
      rows.replaceChildren(...leaders.map(({rank,name,score,you})=>{
        const row=document.createElement('tr');
        row.dataset.rank=rank;
        row.classList.toggle('your-score',you);
        const place=document.createElement('td'), player=document.createElement('td'), total=document.createElement('td');
        place.textContent=rank;
        player.textContent=name;
        if (you) {
          const marker=document.createElement('span');
          marker.className='ranking-you';
          marker.textContent='You';
          player.append(marker);
        }
        total.textContent=number.format(score);
        row.append(place,player,total);
        return row;
      }));
      personal(entry);
      table.hidden=!leaders.length;
      status.textContent=leaders.length ? '' : 'No scores yet. Play this cabinet to set the first one.';
    } catch {
      if (!dialog.open || id!==lookup) return;
      status.textContent='Couldn’t load the scores.';
      retry.hidden=false;
    }
  }

  function open(game=selected) {
    if (dialog.open) return;
    selected=game;
    nameForm.hidden=true;
    clearMovement();
    dialog.showModal();
    $('ranking-'+game).focus();
    refresh();
  }

  for (const game of games) {
    links[game].addEventListener('click',()=>{ if (!links[game].disabled) open(game); });
    $('ranking-'+game).addEventListener('click',()=>{
      if (selected===game) return;
      selected=game;
      refresh();
    });
  }
  $('menu-rankings').addEventListener('click',()=>open());
  $('load-rankings').addEventListener('click',()=>open());
  $('ranking-close').addEventListener('click',()=>dialog.close());
  retry.addEventListener('click',refresh);
  setName.addEventListener('click',()=>{
    nameForm.hidden=false;
    editor.open();
  });
  $('ranking-name-close').addEventListener('click',()=>{
    nameForm.hidden=true;
    setName.focus();
  });

  function reset(game) {
    latest.delete(game);
    links[game].disabled=false;
    $(game+'-rank-status').textContent='';
  }

  function begin(game,now) {
    reset(game);
    links[game].disabled=true;
    const player=profileToken();
    if (!player || !profileUsername()) return;
    const ticket=crypto.randomUUID(), seed=crypto.getRandomValues(new Uint32Array(1))[0];
    const started=request({op:'start',game,profileToken:player,ticket,seed}).catch(()=>null);
    latest.set(game,ticket);
    return {ticket,player,random:arcadeRandom(seed),events:[],stamp:time=>Math.floor(time-now),started};
  }

  async function finish(game,ranked,now,score) {
    links[game].disabled=false;
    if (!score) return;
    const note=$(game+'-rank-status');
    if (!ranked) {
      note.textContent='Set a username in Leaderboard to post your next run.';
      return;
    }
    const {ticket,player,events,stamp,started}=ranked;
    const body={op:'finish',game,profileToken:player,ticket,events,elapsed:stamp(now)};
    note.textContent='Posting your score…';
    try {
      await started;
      let result;
      try {
        result=await request(body);
      } catch (error) {
        if (!['TypeError','TimeoutError','AbortError'].includes(error.name)) throw error;
        result=await request(body);
      }
      if (latest.get(game)===ticket) {
        note.textContent=result.improved ? 'New online best posted.' : 'Your online best is on the leaderboard.';
      }
      if (dialog.open && selected===game) refresh();
    } catch {
      if (latest.get(game)===ticket) note.textContent='Couldn’t post this score online. Your device saved it.';
    }
  }

  return {begin,finish,reset,get open(){return dialog.open;}};
}
