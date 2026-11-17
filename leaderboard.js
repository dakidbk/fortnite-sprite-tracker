import { createUsernameEditor, ensureProfileToken, profileToken, profileUsername } from './username.js?v=cabinet-25';
import { arcadeRandom } from './supabase/functions/arcade-rankings/arcade-rules.js?v=arcade-rankings-24';

const $ = id => document.getElementById(id);
const endpoint='https://fwjthjqevmukrovpbvfx.supabase.co/functions/v1/arcade-rankings';
const units={neon:'Points',signal:'Levels',circuit:'Signals'};
const number=new Intl.NumberFormat('en-US');

async function request(body) {
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    signal:AbortSignal.timeout(8500),
    body:JSON.stringify(body)
  });
  const data=await response.json();
  if (!response.ok) throw Object.assign(Error(data.error || 'Arcade rankings are temporarily unavailable.'),{code:data.code});
  return data;
}

export function createLeaderboards({best}) {
  const template=$('arcade-board-template');
  return Object.fromEntries(Object.keys(units).map(game=>[game,createBoard(game,template,()=>best(game))]));
}

function createBoard(game,template,best) {
  const board=$(game+'-board'), play=$(game+'-play');
  board.append(template.content.cloneNode(true));
  const node=name=>board.querySelector('[data-'+name+']');
  const heading=board.querySelector('h3'), standings=node('standings'), rows=node('score-rows');
  const deviceBest=node('device-best'), onlineRank=node('online-rank'), onlineRankWrap=node('online-rank-wrap');
  const status=node('board-status'), postStatus=node('post-status'), retry=node('score-retry');
  const action=node('score-action'), form=node('score-form'), save=form.querySelector('[type="submit"]');
  let visible=false, lookup=0, pending, publishing=false, needsName=false;
  node('score-unit').textContent=units[game];

  const editor=createUsernameEditor({
    form,
    onSave() {
      needsName=false;
      form.hidden=true;
      heading.focus({preventScroll:true});
      if (pending) publish();
      else refresh();
      renderPersonal();
    }
  });

  function renderPersonal() {
    deviceBest.textContent=number.format(best());
    const chooseName=needsName || !profileUsername();
    action.hidden=!form.hidden || publishing || (!chooseName && !pending);
    action.textContent=pending ? 'Post score' : 'Set username';
    save.textContent=pending ? 'Save name & post' : 'Save username';
  }

  function renderScores(leaders,personal) {
    rows.replaceChildren(...leaders.map(({rank,name,score,you})=>{
      const row=document.createElement('tr');
      row.dataset.rank=rank;
      row.classList.toggle('your-score',you);
      const place=document.createElement('td'), player=document.createElement('td'), total=document.createElement('td');
      place.textContent=rank;
      player.textContent=name;
      if (you) {
        const marker=document.createElement('span');
        marker.className='cabinet-you';
        marker.textContent='You';
        player.append(marker);
      }
      total.textContent=number.format(score);
      row.append(place,player,total);
      return row;
    }));
    onlineRankWrap.hidden=!personal;
    onlineRank.textContent=personal ? '#'+personal.rank+' · '+number.format(personal.score) : '';
    standings.hidden=!leaders.length;
    status.textContent=leaders.length ? '' : 'No online scores yet.';
  }

  async function refresh() {
    if (!visible) return;
    const id=++lookup;
    retry.hidden=true;
    if (standings.hidden) status.textContent='Loading online scores…';
    try {
      const {leaders,personal}=await request({op:'list',game,profileToken:profileToken()});
      if (visible && id===lookup) renderScores(leaders,personal);
    } catch {
      if (!visible || id!==lookup) return;
      status.textContent='Couldn’t load online scores.';
      retry.hidden=false;
    }
  }

  async function publish() {
    if (publishing || !pending || needsName || !profileUsername()) return;
    const submission=pending;
    publishing=true;
    postStatus.textContent='Posting your score…';
    renderPersonal();
    try {
      await submission.started;
      let result;
      try {
        result=await request(submission.body);
      } catch (error) {
        if (!['TypeError','TimeoutError','AbortError'].includes(error.name)) throw error;
        result=await request(submission.body);
      }
      if (pending===submission) pending=undefined;
      postStatus.textContent=result.improved ? 'Online best posted.' : 'Your online best is on the board.';
      refresh();
    } catch (error) {
      needsName=error.code==='username_required';
      if (pending===submission && ['run_expired','run_invalid'].includes(error.code)) pending=undefined;
      postStatus.textContent=needsName ? 'Choose a username to post this score.' : 'Score saved on this device.';
    } finally {
      publishing=false;
      renderPersonal();
      if (pending && pending!==submission) publish();
    }
  }

  action.addEventListener('click',()=>{
    if (needsName || !profileUsername()) {
      form.hidden=false;
      renderPersonal();
      editor.open();
    } else publish();
  });
  node('cancel-name').addEventListener('click',()=>{
    form.hidden=true;
    renderPersonal();
    action.focus();
  });
  retry.addEventListener('click',refresh);

  function showBoard() {
    board.hidden=false;
    play.hidden=true;
    renderPersonal();
  }

  return {
    show() {
      visible=true;
      showBoard();
      refresh();
      publish();
    },
    close() {
      visible=false;
      form.hidden=true;
    },
    begin(now) {
      form.hidden=true;
      board.hidden=true;
      play.hidden=false;
      postStatus.textContent='';
      const player=ensureProfileToken();
      if (!player) return;
      const ticket=crypto.randomUUID(), seed=crypto.getRandomValues(new Uint32Array(1))[0];
      const started=request({op:'start',game,profileToken:player,ticket,seed}).catch(()=>null);
      return {ticket,player,random:arcadeRandom(seed),events:[],stamp:time=>Math.floor(time-now),started};
    },
    finish(ranked,now,score) {
      if (ranked && score>0 && (!pending || score>pending.score)) {
        const {ticket,player,events,stamp,started}=ranked;
        pending={score,started,body:{op:'finish',game,profileToken:player,ticket,events,elapsed:stamp(now)}};
      }
      showBoard();
      if (!pending || !profileUsername()) refresh();
      publish();
    }
  };
}
