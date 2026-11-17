import {
  boardGames, boardScore, houseMove, legalMoves, moveBetween, moveFrom, movesPieces, moveTo,
  newBoard, pieceSide, playBoard
} from './supabase/functions/game-rooms/lounge-rules.js?v=lounge-23';
import { loungeTables } from './lounge-world.js?v=lounge-23';

const $ = id => document.getElementById(id);
const demoMoves = {
  four:[2,3,3,2,4,5,4,2], three:[0,4,8,3], reversi:[8,7,6,9],
  dots:[0,3,12,13,4,16,7], gomoku:[31,42,40,33,50,51], hex:[10,22,17,23,30,24]
};
const scoring = new Set(['reversi','dots','checkers','mancala','nim','breakthrough']);

function createBoard(board,onMove) {
  let kind, game, state, canPlay, selected=-1;
  const cells=[], targets=new Map();

  function press(index) {
    if (!canPlay) return;
    if (!movesPieces(kind)) {
      if (legalMoves(state).includes(index)) onMove(index);
      return;
    }
    const legal=legalMoves(state);
    const move=moveBetween(selected,index);
    if (selected>=0 && legal.includes(move)) onMove(move);
    else {
      selected = index!==selected && legal.some(move=>moveFrom(move)===index) ? index : state.chain ?? -1;
      paint();
    }
  }

  function item(className,index,label,parent=board) {
    const control=onMove && index!==undefined;
    const node=document.createElement(control ? 'button' : 'span');
    node.className=className;
    if (control) {
      node.type='button';
      node.setAttribute('aria-label',label);
      node.addEventListener('click',()=>press(index));
      targets.set(index,node);
    }
    parent.append(node);
    return node;
  }

  function build() {
    board.dataset.game=kind;
    board.style.setProperty('--cols',game.cols);
    board.replaceChildren();
    cells.length=0;
    targets.clear();
    if (kind==='four') {
      for (let col=0;col<game.cols;col++) {
        const column=item('table-column',col,'Drop in column '+(col+1));
        item('column-number',undefined,undefined,column).textContent=col+1;
        for (let row=0;row<game.rows;row++) cells[row*game.cols+col]=item('table-cell',undefined,undefined,column);
      }
    } else if (kind==='dots') {
      for (let r=0;r<7;r++) for (let c=0;c<7;c++) {
        const row=Math.floor(r/2), col=Math.floor(c/2);
        if (r%2===0 && c%2===0) item('table-dot');
        else if (r%2===0) item('table-edge horizontal',row*3+col,'Horizontal edge, row '+(row+1)+', column '+(col+1));
        else if (c%2===0) item('table-edge vertical',12+row*4+col,'Vertical edge, row '+(row+1)+', column '+(col+1));
        else cells.push(item('table-box'));
      }
    } else if (kind==='mancala') {
      for (const [column,index] of [13,12,11,10,9,8,7,6,0,1,2,3,4,5].entries()) {
        const store=index===6 || index===13;
        const node=item(store ? 'table-store' : 'table-pit',store ? undefined : index);
        if (store) node.style.gridColumn=column+1;
        cells[index]=node;
      }
    } else if (kind==='nim') {
      for (let row=0;row<3;row++) {
        const line=item('table-nim-row');
        item('table-row-label',undefined,undefined,line).textContent='Row '+(row+1);
        for (let col=0;col<3+row*2;col++) {
          const index=row*game.cols+col;
          cells[index]=item('table-token',index,'',line);
        }
      }
    } else {
      for (let row=0;row<game.rows;row++) {
        const parent=kind==='hex' ? item('table-hex-row') : board;
        if (kind==='hex') parent.style.setProperty('--row-index',row);
        for (let col=0;col<game.cols;col++) {
          const index=row*game.cols+col;
          const node=item('table-cell',index,'',parent);
          node.dataset.square=(row+col)%2;
          cells.push(node);
        }
      }
    }
  }

  function paint() {
    const legal=canPlay ? legalMoves(state) : [];
    const pieces=movesPieces(kind);
    const origins=pieces ? new Set(legal.map(moveFrom)) : null;
    const available=pieces ? new Set(legal.filter(move=>moveFrom(move)===selected).map(moveTo)) : new Set(legal);
    const line=new Set(state.line);
    board.dataset.turn=state.turn;

    for (const [index,node] of targets) {
      const valid=available.has(index);
      const origin=!!origins?.has(index);
      node.setAttribute('aria-disabled',String(!valid && !origin));
      node.tabIndex=valid || origin ? 0 : -1;
      node.classList.toggle('legal',valid);
      node.classList.toggle('origin',origin);
      node.classList.toggle('selected',index===selected);
      if (pieces) node.setAttribute('aria-pressed',String(index===selected));
      if (kind==='dots') {
        node.dataset.side=state.edges[index];
        node.classList.toggle('last',index===state.last);
      }
    }
    cells.forEach((node,index)=>{
      node.classList.toggle('last',index===state.last);
      node.classList.toggle('win',line.has(index));
      if (kind==='nim') {
        const row=Math.floor(index/game.cols), col=index%game.cols;
        const remaining=state.cells[row], remove=remaining-col;
        node.dataset.count=String(Math.max(0,remove));
        if (onMove) node.setAttribute('aria-label',remove>0 ? 'Remove '+remove+' from row '+(row+1) : 'Empty space');
        return;
      }
      const value=state.cells[index];
      if (kind==='mancala') {
        const store=index===6 || index===13;
        node.dataset.count=String(value);
        node.dataset.side=index<7 ? 1 : 2;
        node.textContent=value;
        if (onMove) node.setAttribute('aria-label',(store ? 'Store' : 'Pit '+(index%7+1))+', '+game.marks[index<7 ? 0 : 1]+', '+value+' seeds');
        return;
      }
      const side=pieceSide(value);
      const label=side ? game.marks[side-1]+(kind==='checkers' && value>2 ? ' king' : '') : 'empty';
      node.dataset.side=side;
      node.dataset.king=String(value>2);
      node.textContent=kind==='three' ? (value===1 ? '×' : value===2 ? '○' : '')
        : kind==='dots' ? (side===1 ? '●' : side===2 ? '◆' : '') : '';
      if (onMove && kind!=='four' && kind!=='dots') {
        node.setAttribute('aria-label','Row '+(Math.floor(index/game.cols)+1)+', column '+(index%game.cols+1)+', '+label);
      }
    });
  }

  return (position,playable=false)=>{
    if (position!==state) selected=position.chain ?? -1;
    state=position;
    if (state.kind!==kind) {
      kind=state.kind;
      game=boardGames[kind];
      build();
    }
    canPlay=playable;
    paint();
  };
}

export function createLounge({online,clearMovement,seat,announce,tone}) {
  const dialog=$('table-dialog'), lobby=$('table-lobby'), playing=$('table-playing');
  const host=$('table-host'), join=$('table-join'), reset=$('table-reset'), leave=$('table-leave'), notice=$('table-notice');
  const local=new Map();
  const renderBoard=createBoard($('table-board'),move);
  const preview=createBoard($('table-preview'));
  let active, pending=false, snapshot, lastRender='', nextHouseMove=0, roomEnded=false;
  const currentTable=()=>online.tables.find(table=>table.board===active);
  const sideFor=table=>online.slot===table.host ? 1 : online.slot===table.guest ? 2 : 0;
  const roomName=slot=>slot===online.slot ? 'You' : online.friends.find(peer=>peer.slot===slot)?.username || 'Player '+slot;

  function roundFor(table) {
    if (snapshot?.board===table.board && snapshot.version===table.version && snapshot.index===table.moves.length) return snapshot.round;
    let round=newBoard(table.kind);
    for (const move of table.moves) round=playBoard(round,move) || round;
    snapshot={board:table.board,version:table.version,index:table.moves.length,round};
    return round;
  }

  function render(force=false) {
    if (!dialog.open) return;
    const onlineTable=currentTable();
    const offline=onlineTable ? undefined : local.get(active), table=offline ? undefined : onlineTable;
    const state=offline?.round || (table && roundFor(table));
    const names=table ? [roomName(table.host),table.guest ? roomName(table.guest) : 'Open seat']
      : offline?.mode==='house' ? ['You','House'] : ['Player 1','Player 2'];
    const spot=loungeTables[active], kind=state?.kind || spot.kind, game=boardGames[kind];
    const key=JSON.stringify([active,kind,pending,online.connected,online.tablesSupported,roomEnded,table?.version,table?.guest,table?.moves.length,names,offline?.round]);
    if (!force && key===lastRender) return;
    lastRender=key;
    const openedBoard=!!state && playing.hidden;
    lobby.hidden=!!state;
    playing.hidden=!state;
    host.hidden=!online.connected;
    host.disabled=pending || !online.tablesSupported;
    $('table-house').disabled=$('table-local').disabled=pending;
    dialog.dataset.game=kind;
    dialog.style.setProperty('--game-accent',game.color);
    $('table-label').textContent='Game lounge · Table '+String(active+1).padStart(2,'0');
    $('table-title').textContent=game.name;
    $('table-tip').textContent=game.tip;
    if (!state) {
      const example=(demoMoves[kind] || []).reduce((state,move)=>playBoard(state,move) || state,newBoard(kind));
      preview(example);
      $('table-status').textContent=roomEnded ? 'The room game ended. Start a new round when you’re ready.'
        : online.connected ? online.tablesSupported ? 'Host a game for a friend in this room.' : 'Connecting to online tables…'
        : 'Play the house or take turns on this device.';
      return;
    }
    const side=table ? sideFor(table) : 0;
    const waiting=table && !table.guest;
    const canPlay=!pending && (table ? !waiting && side===state.turn : offline.mode==='local' || state.turn===1);
    const score=scoring.has(kind) ? boardScore(state) : null;
    for (const [i,name] of names.entries()) {
      const node=$('table-player-'+(i+1)), count=$('table-score-'+(i+1));
      node.textContent=name+' · '+game.marks[i];
      count.textContent=score ? String(score[i]) : '';
      node.parentElement.classList.toggle('turn',state.winner===null && !waiting && state.turn===i+1);
    }
    const result=state.winner===0 ? 'It’s a draw.' : state.winner===null ? '' :
      names[state.winner-1]==='You' ? 'You win!' : names[state.winner-1]+' wins!';
    $('table-status').textContent=result || (waiting ? side ? 'Waiting for a friend to join this table.' : 'There’s an open seat.'
      : table && !side ? names[state.turn-1]+' to play · Watching' : names[state.turn-1]==='You' ? 'Your turn.' : names[state.turn-1]+' to play.');
    join.hidden=!waiting || !!side;
    join.disabled=pending;
    reset.hidden=table ? !side || state.winner===null : false;
    reset.disabled=pending;
    reset.textContent=table ? 'Rematch' : 'New round';
    leave.hidden=!!table && !side;
    leave.disabled=pending;
    renderBoard(state,canPlay && state.winner===null);
    if (openedBoard) $('table-close').focus();
  }

  function open(board) {
    if (dialog.open || !loungeTables[board]) return;
    active=board;
    roomEnded=false;
    lastRender='';
    notice.textContent='';
    clearMovement();
    seat(board);
    dialog.showModal();
    render(true);
    $('table-close').focus();
  }

  async function roomAction(verb,fields) {
    if (pending) return;
    pending=true;
    notice.textContent='';
    const board=active;
    render(true);
    try {
      await online.tableAction(board,verb,fields);
      roomEnded=false;
    } catch (error) {
      if (active===board && dialog.open) notice.textContent=error.message;
    } finally {
      pending=false;
      render(true);
    }
  }

  function start(mode) {
    if (pending || currentTable()) return;
    roomEnded=false;
    notice.textContent='';
    local.set(active,{mode,round:newBoard(loungeTables[active].kind)});
    render(true);
  }

  function move(index) {
    if (pending || !dialog.open) return;
    const offline=currentTable() ? undefined : local.get(active);
    if (offline) {
      if (offline.mode==='house' && offline.round.turn!==1) return;
      const next=playBoard(offline.round,index);
      if (!next) return;
      offline.round=next;
      nextHouseMove=performance.now()+430;
      tone(480,.08,0,'triangle');
      render();
    } else {
      const table=currentTable();
      if (!table?.guest) return;
      const round=roundFor(table);
      if (sideFor(table)!==round.turn || !playBoard(round,index)) return;
      roomAction('move',{version:table.version,index:table.moves.length,move:index});
    }
  }

  $('table-close').addEventListener('click',()=>dialog.close());
  $('table-house').addEventListener('click',()=>start('house'));
  $('table-local').addEventListener('click',()=>start('local'));
  host.addEventListener('click',()=>roomAction('host',{kind:loungeTables[active].kind}));
  join.addEventListener('click',()=>roomAction('join'));
  reset.addEventListener('click',()=>{
    const table=currentTable(), offline=table ? undefined : local.get(active);
    if (offline) start(offline.mode);
    else if (table) roomAction('reset',{version:table.version,index:table.moves.length});
  });
  leave.addEventListener('click',()=>{
    if (currentTable()) roomAction('leave');
    else if (local.delete(active)) render(true);
  });

  let previous;
  return {
    open,
    get isOpen(){return dialog.open;},
    tick(now) {
      if (!dialog.open) { previous=undefined; return; }
      const table=currentTable();
      const side=table && sideFor(table);
      if (side) seat(active,side-1);
      if (previous && !table && !pending) {
        roomEnded=true;
        if (sideFor(previous)) announce('The table game ended.');
      }
      previous=table;
      const offline=table ? undefined : local.get(active);
      if (offline?.mode==='house' && offline.round.turn===2 && offline.round.winner===null && now>=nextHouseMove) {
        const next=playBoard(offline.round,houseMove(offline.round));
        if (next) {
          offline.round=next;
          nextHouseMove=now+430;
          tone(330,.08,0,'triangle');
        }
      }
      render();
    }
  };
}
