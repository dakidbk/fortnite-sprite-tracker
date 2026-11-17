export const boardGames = {
  four: {name:'Connect Four', rows:6, cols:7, length:4, marks:['Amber','Teal'], color:'#c38d56', tip:'Drop a disc into a column. Line up four to win.'},
  three: {name:'Tic-Tac-Toe', rows:3, cols:3, length:3, marks:['X','O'], color:'#b9705c', tip:'Get three in a row, column, or diagonal.'},
  reversi: {name:'Reversi', rows:6, cols:6, marks:['Amber','Teal'], color:'#83a792', tip:'Trap the other side’s discs in a straight line to flip them. Most discs wins.'},
  dots: {name:'Dots & Boxes', rows:3, cols:3, marks:['Amber','Teal'], color:'#809caf', tip:'Draw an edge. Complete a square to score and take another turn.'},
  checkers: {name:'Checkers', rows:8, cols:8, marks:['Amber','Teal'], color:'#bd795d', tip:'Pick a checker, then a lit square. Jumps are mandatory. Reach the far row to crown a king.'},
  gomoku: {name:'Gomoku', rows:9, cols:9, length:5, marks:['Ink','Ivory'], color:'#c5a469', tip:'Place a stone on the grid. Make a line of five or more to win.'},
  mancala: {name:'Mancala', rows:2, cols:6, marks:['Amber','Teal'], color:'#c39c68', tip:'Sow a pit on your side. Finish in your store for an extra turn. Finish in an empty home pit to capture opposite seeds.'},
  hex: {name:'Hex', rows:7, cols:7, marks:['Amber ↕','Teal ↔'], color:'#779baf', tip:'Connect your two edges with touching tiles. Amber connects top to bottom. Teal connects left to right.'},
  nim: {name:'Nim', rows:3, cols:7, marks:['Amber','Teal'], color:'#a58aab', tip:'Pick one row and remove as many tokens as you like from its right end. Take the last token to win.'},
  breakthrough: {name:'Breakthrough', rows:6, cols:6, marks:['Amber','Teal'], color:'#96ad86', tip:'Step forward into an empty square or move diagonally forward. Capture on a diagonal. Reach the far row to win.'}
};

export const tableLayout = [
  {kind:'four',x:2.05,z:-23.55}, {kind:'three',x:6.48,z:-25.85},
  {kind:'reversi',x:-2.85,z:-23.55}, {kind:'dots',x:-7.10,z:-23.55},
  {kind:'checkers',x:-7.10,z:-29}, {kind:'gomoku',x:-2.85,z:-29},
  {kind:'mancala',x:2.05,z:-29}, {kind:'hex',x:6.48,z:-31},
  {kind:'nim',x:-5.30,z:-34.20}, {kind:'breakthrough',x:.15,z:-34.20}
];

export const turnLimit = 320;
export const pieceMoveBase = 64;
export const maxBoardMove = pieceMoveBase**2-1;
export const movesPieces = kind => kind==='checkers' || kind==='breakthrough';
export const pieceSide = value => value > 2 ? value-2 : value;
export const moveFrom = move => Math.floor(move/pieceMoveBase);
export const moveTo = move => move%pieceMoveBase;
export const moveBetween = (from,to) => from*pieceMoveBase+to;

const lines = [[1,0],[0,1],[1,1],[1,-1]];
const directions = [...lines,...lines.map(([r,c])=>[-r,-c])];
const get = (cells,game,row,col) =>
  row >= 0 && row < game.rows && col >= 0 && col < game.cols ? cells[row*game.cols+col] : undefined;

export function newBoard(kind) {
  const game=boardGames[kind], count=game.rows*game.cols;
  const state={kind,cells:Array(count).fill(0),turn:1,winner:null,last:-1,line:[]};
  if (kind === 'reversi') {
    state.cells[14]=state.cells[21]=2;
    state.cells[15]=state.cells[20]=1;
  }
  if (kind === 'dots') state.edges=Array(24).fill(0);
  if (kind === 'checkers') {
    for (let i=0;i<count;i++) {
      const row=Math.floor(i/game.cols), col=i%game.cols;
      if ((row+col)%2 && (row<3 || row>4)) state.cells[i]=row<3 ? 2 : 1;
    }
    state.chain=-1;
    state.quiet=0;
  }
  if (kind === 'breakthrough') {
    state.cells.fill(2,0,game.cols*2);
    state.cells.fill(1,count-game.cols*2);
  }
  if (kind === 'mancala') {
    state.cells=Array(14).fill(4);
    state.cells[6]=state.cells[13]=0;
  }
  if (kind === 'nim') {
    state.cells=[3,5,7];
    state.taken=[0,0];
  }
  return state;
}

function flips(cells,game,index,side) {
  if (cells[index] !== 0) return [];
  const row=Math.floor(index/game.cols),col=index%game.cols, captured=[];
  for (const [dr,dc] of directions) {
    const ray=[];
    let r=row+dr,c=col+dc;
    while (get(cells,game,r,c) === 3-side) {
      ray.push(r*game.cols+c);
      r+=dr;
      c+=dc;
    }
    if (get(cells,game,r,c) === side) captured.push(...ray);
  }
  return captured;
}

export function legalMoves(state,side=state.turn) {
  if (state.winner !== null) return [];
  const {kind,cells,edges}=state, game=boardGames[kind];
  if (kind === 'four') return Array.from({length:game.cols},(_,i)=>i).filter(i=>cells[i]===0);
  if (kind === 'dots') return edges.flatMap((edge,i)=>edge ? [] : [i]);
  if (movesPieces(kind)) return legalPieceMoves(state,side,game);
  if (kind === 'mancala') {
    const start=(side-1)*7;
    return Array.from({length:6},(_,i)=>start+i).filter(i=>cells[i]>0);
  }
  if (kind === 'nim') return cells.flatMap((count,row)=>
    Array.from({length:count},(_,index)=>row*game.cols+index));
  return cells.flatMap((cell,i)=>cell || (kind === 'reversi' && !flips(cells,game,i,side).length) ? [] : [i]);
}

function legalPieceMoves(state,side,game) {
  const {cells,kind,chain}=state;
  const captures=[],steps=[];
  const forward=side===1 ? -1 : 1;
  for (const [i,piece] of cells.entries()) {
    if (pieceSide(piece)!==side || (chain>=0 && chain!==i)) continue;
    const row=Math.floor(i/game.cols), col=i%game.cols;
    for (const dr of piece>2 ? [forward,-forward] : [forward]) {
      for (const dc of kind==='checkers' ? [-1,1] : [-1,0,1]) {
        const adjacent=get(cells,game,row+dr,col+dc);
        const dest=(row+dr)*game.cols+col+dc;
        if (adjacent===0 || (kind==='breakthrough' && dc && adjacent===3-side)) steps.push(moveBetween(i,dest));
        if (kind==='checkers' && adjacent && pieceSide(adjacent)===3-side && get(cells,game,row+2*dr,col+2*dc)===0) {
          captures.push(moveBetween(i,(row+2*dr)*game.cols+col+2*dc));
        }
      }
    }
  }
  return captures.length || chain>=0 ? captures : steps;
}

export function boxEdges(index) {
  const row=Math.floor(index/3),col=index%3;
  const horizontal=row*3+col,vertical=12+row*4+col;
  return [horizontal,horizontal+3,vertical,vertical+1];
}

export function boardScore(state) {
  if (state.kind==='mancala') return [state.cells[6],state.cells[13]];
  if (state.kind==='nim') return state.taken;
  const score=[0,0];
  for (const value of state.cells) if (value) score[pieceSide(value)-1]++;
  return score;
}

function scoreWinner(state) {
  const [a,b]=boardScore(state);
  return a===b ? 0 : a>b ? 1 : 2;
}

function playPiece(next,move,side,game) {
  const {cells,kind}=next, from=moveFrom(move), to=moveTo(move), piece=cells[from];
  const row=Math.floor(to/game.cols), far=row===(side===1 ? 0 : game.rows-1);
  next.last=to;
  next.from=from;
  cells[from]=0;
  cells[to]=piece;
  if (kind==='checkers') {
    const capture=Math.abs(Math.floor(from/game.cols)-row)===2;
    if (capture) cells[(from+to)/2]=0;
    const crowned=far && piece<=2;
    if (crowned) cells[to]=side+2;
    next.quiet=capture || crowned ? 0 : next.quiet+1;
    next.chain=capture && !crowned ? to : -1;
    if (next.chain!==-1 && legalMoves(next,side).length) {
      next.turn=side;
      return;
    }
    next.chain=-1;
  }
  if ((kind==='breakthrough' && far) || !legalMoves(next).length) {
    next.winner=side;
    next.line=[to];
  } else if (kind==='checkers' && next.quiet>=80) next.winner=0;
}

function sow(next,move,side) {
  const {cells}=next, home=side===1 ? 6 : 13, other=19-home;
  let cursor=move, remaining=cells[move];
  cells[move]=0;
  while (remaining) {
    cursor=(cursor+1)%cells.length;
    if (cursor===other) continue;
    cells[cursor]++;
    remaining--;
  }
  next.last=cursor;
  next.from=move;
  const inHome=cursor>=home-6 && cursor<home;
  if (inHome && cells[cursor]===1 && cells[12-cursor]) {
    cells[home]+=1+cells[12-cursor];
    cells[cursor]=cells[12-cursor]=0;
  }
  if (cursor===home) next.turn=side;
  const pits=[cells.slice(0,6),cells.slice(7,13)];
  if (pits.some(side=>!side.some(Boolean))) {
    for (const [i,values] of pits.entries()) {
      cells[6+i*7]+=values.reduce((sum,value)=>sum+value,0);
      cells.fill(0,i*7,i*7+6);
    }
    next.winner=scoreWinner(next);
  }
}

function hexConnection(cells,game,side) {
  const queue=[], parent=new Int16Array(cells.length).fill(-1);
  for (let i=0;i<game.cols;i++) {
    const start=side===1 ? i : i*game.cols;
    if (cells[start]===side) {
      queue.push(start);
      parent[start]=start;
    }
  }
  for (let i=0;i<queue.length;i++) {
    let current=queue[i];
    const row=Math.floor(current/game.cols), col=current%game.cols;
    if (side===1 ? row===game.rows-1 : col===game.cols-1) {
      const line=[current];
      while (current!==parent[current]) { current=parent[current]; line.push(current); }
      return line;
    }
    for (const [dr,dc] of [[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0]]) {
      const next=(row+dr)*game.cols+col+dc;
      if (get(cells,game,row+dr,col+dc)!==side || parent[next]!==-1) continue;
      parent[next]=current;
      queue.push(next);
    }
  }
  return [];
}

export function playBoard(state,move) {
  if (!Number.isInteger(move) || !legalMoves(state).includes(move)) return null;
  const {kind,turn}=state, game=boardGames[kind];
  const next={...state,cells:[...state.cells],turn:3-turn,last:move,from:-1,plies:(state.plies || 0)+1};
  const cells=next.cells;
  if (movesPieces(kind)) playPiece(next,move,turn,game);
  else if (kind==='mancala') sow(next,move,turn);
  else if (kind==='nim') {
    const row=Math.floor(move/game.cols), keep=move%game.cols;
    next.taken=[...state.taken];
    next.taken[turn-1]+=cells[row]-keep;
    cells[row]=keep;
    if (!cells.some(Boolean)) next.winner=turn;
  }
  if (movesPieces(kind) || kind==='mancala' || kind==='nim') {
    if (next.plies>=turnLimit && next.winner===null) next.winner=0;
    return next;
  }
  if (kind === 'dots') {
    next.edges=[...state.edges];
    next.edges[move]=turn;
    let earned=0;
    for (let i=0;i<cells.length;i++) {
      const edges=boxEdges(i);
      if (!cells[i] && edges.includes(move) && edges.every(edge=>next.edges[edge])) {
        cells[i]=turn;
        earned++;
      }
    }
    if (earned) next.turn=turn;
    if (cells.every(Boolean)) next.winner=scoreWinner(next);
    return next;
  }
  if (kind === 'reversi') {
    for (const index of flips(cells,game,move,turn)) cells[index]=turn;
    cells[move]=turn;
    if (!legalMoves(next).length) {
      next.turn=turn;
      if (!legalMoves(next).length) next.winner=scoreWinner(next);
    }
    return next;
  }
  let index=move;
  if (kind === 'four') {
    for (let row=game.rows-1;row>=0;row--) {
      index=row*game.cols+move;
      if (!cells[index]) break;
    }
  }
  cells[index]=turn;
  next.last=index;
  if (kind==='hex') {
    next.line=hexConnection(cells,game,turn);
    if (next.line.length) next.winner=turn;
    return next;
  }
  const row=Math.floor(index/game.cols),col=index%game.cols;
  for (const [dr,dc] of lines) {
    const line=[index];
    for (const sign of [-1,1]) {
      let r=row+dr*sign,c=col+dc*sign;
      while (get(cells,game,r,c)===turn) {
        line.push(r*game.cols+c);
        r+=dr*sign;
        c+=dc*sign;
      }
    }
    if (line.length>=game.length) {
      next.winner=turn;
      next.line=line;
      return next;
    }
  }
  if (cells.every(Boolean)) next.winner=0;
  return next;
}

export function houseMove(state) {
  const legal=legalMoves(state);
  if (!legal.length) return;
  const opponent={...state,turn:3-state.turn};
  const winning=legal.find(move=>playBoard(state,move)?.winner===state.turn);
  if (winning !== undefined) return winning;
  if (['three','four','gomoku'].includes(state.kind)) {
    const block=legal.find(move=>playBoard(opponent,move)?.winner===opponent.turn);
    if (block !== undefined) return block;
    const center={three:4,four:3,gomoku:40}[state.kind];
    if (legal.includes(center)) return center;
  }
  if (state.kind === 'dots') {
    const box=legal.find(move=>playBoard(state,move).turn===state.turn);
    if (box !== undefined) return box;
  }
  if (state.kind === 'reversi') {
    const corner=legal.find(move=>[0,5,30,35].includes(move));
    if (corner !== undefined) return corner;
  }
  if (state.kind==='mancala') {
    const before=boardScore(state)[state.turn-1];
    const rated=legal.map(move=>{
      const next=playBoard(state,move);
      return {move,score:boardScore(next)[state.turn-1]-before+(next.turn===state.turn ? 3 : 0)};
    }).sort((a,b)=>b.score-a.score);
    if (rated[0].score>0) return rated[0].move;
  }
  if (state.kind==='nim') {
    const zero=legal.find(move=>playBoard(state,move).cells.reduce((xor,n)=>xor^n,0)===0);
    if (zero!==undefined) return zero;
  }
  if (state.kind==='breakthrough') {
    const capture=legal.find(move=>state.cells[moveTo(move)]===3-state.turn);
    if (capture!==undefined) return capture;
  }
  return legal[Math.floor(Math.random()*legal.length)];
}
