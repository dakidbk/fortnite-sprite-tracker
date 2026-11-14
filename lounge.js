import { boardGames, boardScore, houseMove, legalMoves, newBoard, playBoard } from './supabase/functions/game-rooms/lounge-rules.js?v=back-room-20';
import { loungeTables } from './lounge-world.js?v=back-room-20';

const $ = id => document.getElementById(id);
const symbols = ['','●','◆'];

function createBoard(onMove) {
  const board=$('table-board');
  let kind, cells, moves, boxes;

  function cell(className, index, label) {
    const node=document.createElement(index===undefined ? 'span' : 'button');
    node.className=className;
    if (index!==undefined) {
      node.type='button';
      node.setAttribute('aria-label',label);
      node.addEventListener('click',()=>onMove(index));
      moves[index]=node;
    }
    board.append(node);
    return node;
  }

  function build(gameKind) {
    kind=gameKind;
    const game=boardGames[kind];
    board.dataset.game=kind;
    board.style.setProperty('--cols',game.cols);
    board.replaceChildren();
    cells=[];
    moves=[];
    boxes=[];
    if (kind==='four') {
      for (let c=0;c<game.cols;c++) {
        const col=cell('table-column',c,'Drop in column '+(c+1));
        for (let r=0;r<game.rows;r++) {
          const hole=document.createElement('span');
          hole.className='table-cell';
          col.append(hole);
          cells[r*game.cols+c]=hole;
        }
      }
      return;
    }
    if (kind==='dots') {
      for (let r=0;r<7;r++) for (let c=0;c<7;c++) {
        const row=Math.floor(r/2), col=Math.floor(c/2);
        if (r%2===0 && c%2===0) cell('table-dot');
        else if (r%2===0) cell('table-edge horizontal',row*3+col,'Horizontal edge, row '+(row+1)+', column '+(col+1));
        else if (c%2===0) cell('table-edge vertical',12+row*4+col,'Vertical edge, row '+(row+1)+', column '+(col+1));
        else boxes.push(cell('table-box'));
      }
      return;
    }
    for (let i=0;i<game.rows*game.cols;i++) {
      const row=Math.floor(i/game.cols)+1, col=i%game.cols+1;
      cells.push(cell('table-cell',i,'Row '+row+', column '+col));
    }
  }

  return (state,canPlay)=>{
    if (state.kind!==kind) build(state.kind);
    const legal=canPlay ? legalMoves(state) : [];
    for (const [i,node] of moves.entries()) {
      node.setAttribute('aria-disabled',String(!legal.includes(i)));
      node.classList.toggle('legal',legal.includes(i));
    }
    if (state.kind==='dots') {
      boxes.forEach((node,i)=>{node.dataset.side=state.cells[i];node.textContent=symbols[state.cells[i]];});
      moves.forEach((node,i)=>{node.dataset.side=state.edges[i];node.classList.toggle('last',state.last===i);});
      return;
    }
    const marks=state.kind==='three' ? ['','X','O'] : symbols;
    cells.forEach((node,i)=>{
      node.dataset.side=state.cells[i];
      node.textContent=marks[state.cells[i]];
      node.classList.toggle('last',state.last===i);
      node.classList.toggle('win',state.line.includes(i));
      if (state.kind!=='four') {
        const value=marks[state.cells[i]];
        node.setAttribute('aria-label','Row '+(Math.floor(i/boardGames[state.kind].cols)+1)+', column '+(i%boardGames[state.kind].cols+1)+(value ? ', '+value : ', empty'));
      }
    });
  };
}

export function createLounge({online,clearMovement,seat,announce,tone}) {
  const dialog=$('table-dialog'), selector=$('table-games'), lobby=$('table-lobby'), playing=$('table-playing');
  const host=$('table-host'), join=$('table-join'), reset=$('table-reset'), leave=$('table-leave'), notice=$('table-notice');
  const local=new Map();
  const renderBoard=createBoard(move);
  let active, selected='four', pending=false, snapshot, lastRender='', nextHouseMove=0, roomEnded=false;

  const buttons=Object.entries(boardGames).map(([id,game])=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='table-choice';
    button.textContent=game.name;
    button.addEventListener('click',()=>{selected=id;render(true);});
    selector.append(button);
    return [id,button];
  });
  const currentTable=()=>online.tables.find(table=>table.board===active);
  const sideFor=table=>online.slot===table.host ? 1 : online.slot===table.guest ? 2 : 0;
  const roomName=slot=>slot===online.slot ? 'You' : online.friends.find(peer=>peer.slot===slot)?.username || 'Player '+slot;

  function roundFor(table) {
    if (snapshot?.version===table.version && snapshot.index===table.moves.length) return snapshot.round;
    let round=newBoard(table.kind);
    for (const move of table.moves) round=playBoard(round,move) || round;
    snapshot={version:table.version,index:table.moves.length,round};
    return round;
  }

  function render(force=false) {
    if (!dialog.open) return;
    const onlineTable=currentTable();
    const offline=onlineTable ? undefined : local.get(active), table=offline ? undefined : onlineTable;
    const state=offline?.round || (table && roundFor(table));
    const names=table ? [roomName(table.host),table.guest ? roomName(table.guest) : 'Open seat']
      : offline?.mode==='house' ? ['You','House'] : ['Player 1','Player 2'];
    const key=JSON.stringify([active,selected,pending,online.connected,online.tablesSupported,roomEnded,table?.version,table?.guest,table?.moves.length,names,offline?.round]);
    if (!force && key===lastRender) return;
    lastRender=key;
    const openedBoard=!!state && playing.hidden;
    lobby.hidden=!!state;
    playing.hidden=!state;
    host.hidden=!online.connected;
    host.disabled=pending || !online.tablesSupported;
    $('table-house').disabled=$('table-local').disabled=pending;
    $('table-title').textContent=state ? boardGames[state.kind].name : loungeTables[active].name;
    if (!state) {
      $('table-tip').textContent=boardGames[selected].tip;
      $('table-status').textContent=roomEnded ? 'The room game ended. Choose a game to start again.'
        : online.connected ? online.tablesSupported ? 'Start a table so a friend in this room can join.' : 'Connecting to online tables…'
        : 'Play the house or take turns on this device.';
      for (const [id,button] of buttons) button.setAttribute('aria-pressed',String(id===selected));
      return;
    }
    $('table-tip').textContent=boardGames[state.kind].tip;
    const side=table ? sideFor(table) : 0;
    const waiting=table && !table.guest;
    const canPlay=!pending && (table ? !waiting && side===state.turn : offline.mode==='local' || state.turn===1);
    const marks=boardGames[state.kind].marks;
    const counting=state.kind==='reversi' || state.kind==='dots';
    const score=counting ? boardScore(state) : null;
    for (const [i,name] of names.entries()) {
      const node=$('table-player-'+(i+1));
      node.textContent=name+' · '+marks[i]+(score ? ' · '+score[i] : '');
      node.classList.toggle('turn',state.winner===null && !waiting && state.turn===i+1);
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
    selected='four';
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
    local.set(active,{mode,round:newBoard(selected)});
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
  host.addEventListener('click',()=>roomAction('host',{kind:selected}));
  join.addEventListener('click',()=>roomAction('join'));
  reset.addEventListener('click',()=>{
    const table=currentTable(), offline=table ? undefined : local.get(active);
    if (offline) {
      selected=offline.round.kind;
      start(offline.mode);
    } else if (table) roomAction('reset',{version:table.version,index:table.moves.length});
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
