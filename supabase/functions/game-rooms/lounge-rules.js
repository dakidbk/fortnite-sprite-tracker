export const boardGames = {
  four: {name:'Connect Four', rows:6, cols:7, length:4, marks:['Amber','Teal'], tip:'Drop a disc into a column. Line up four to win.'},
  three: {name:'Tic-Tac-Toe', rows:3, cols:3, length:3, marks:['X','O'], tip:'Get three in a row, column, or diagonal.'},
  reversi: {name:'Reversi', rows:6, cols:6, marks:['Amber','Teal'], tip:'Trap the other side’s discs in a straight line to flip them. Most discs wins.'},
  dots: {name:'Dots & Boxes', rows:3, cols:3, marks:['Amber','Teal'], tip:'Draw an edge. Complete a square to score and take another turn.'}
};

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
  return cells.flatMap((cell,i)=>cell || (kind === 'reversi' && !flips(cells,game,i,side).length) ? [] : [i]);
}

export function boxEdges(index) {
  const row=Math.floor(index/3),col=index%3;
  const horizontal=row*3+col,vertical=12+row*4+col;
  return [horizontal,horizontal+3,vertical,vertical+1];
}

export function boardScore(state) {
  const score=[0,0];
  for (const value of state.cells) if (value) score[value-1]++;
  return score;
}

function scoreWinner(state) {
  const [a,b]=boardScore(state);
  return a===b ? 0 : a>b ? 1 : 2;
}

export function playBoard(state,move) {
  if (!Number.isInteger(move) || !legalMoves(state).includes(move)) return null;
  const {kind,turn}=state, game=boardGames[kind];
  const next={...state,cells:[...state.cells],turn:3-turn,last:move};
  const cells=next.cells;
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
  if (state.kind === 'three' || state.kind === 'four') {
    const block=legal.find(move=>playBoard(opponent,move)?.winner===opponent.turn);
    if (block !== undefined) return block;
    const center=state.kind === 'three' ? 4 : 3;
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
  return legal[Math.floor(Math.random()*legal.length)];
}
