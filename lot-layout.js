export const lotSize = 14;
export const tileSize = 1.6;
export const floorHeight = 3.05;
export const floorCount = 3;
export const lotHalf = lotSize * tileSize / 2;
export const frontPath = lotHalf + 2.35;
export const lotSpawn = { x:-tileSize/2, y:0, z:frontPath, yaw:0, sitting:false };

export const finishes = [
  ['Ivory','#dfdac5'], ['Oak','#b38b63'], ['Sage','#7c9983'], ['Clay','#bb6f59'],
  ['Slate','#657687'], ['Ink','#373a42'], ['Sand','#cbb89c'], ['Blue','#6799ad']
];
export const categories = ['Structure','Living','Shop','Outside'];
export const pieces = {
  timber: {name:'Wood floor',category:'Structure',layer:'floor',color:1,icon:'timber'},
  tile: {name:'Tile floor',category:'Structure',layer:'floor',color:0,icon:'tile'},
  wall: {name:'Wall',category:'Structure',layer:'edge',color:0,icon:'wall'},
  window: {name:'Window',category:'Structure',layer:'edge',color:0,icon:'window'},
  doorway: {name:'Doorway',category:'Structure',layer:'edge',color:1,icon:'doorway'},
  roof: {name:'Roof panel',category:'Structure',layer:'roof',color:5,icon:'roof'},
  stairs: {name:'Stairs',category:'Structure',layer:'fit',color:1,w:1,d:3,icon:'stairs'},
  bed: {name:'Bed',category:'Living',layer:'fit',color:4,w:1,d:2,height:.65,icon:'bed'},
  sofa: {name:'Sofa',category:'Living',layer:'fit',color:2,w:2,height:.88,icon:'sofa'},
  table: {name:'Dining set',category:'Living',layer:'fit',color:1,height:.77,icon:'table'},
  kitchen: {name:'Kitchen unit',category:'Living',layer:'fit',color:0,w:2,height:.92,icon:'counter'},
  rug: {name:'Rug',category:'Living',layer:'decor',color:3,icon:'rug'},
  counter: {name:'Checkout counter',category:'Shop',layer:'fit',color:1,w:2,height:1.02,icon:'counter'},
  shelf: {name:'Display shelves',category:'Shop',layer:'fit',color:1,w:2,height:1.79,icon:'shelf'},
  display: {name:'Display table',category:'Shop',layer:'fit',color:4,height:.80,icon:'table'},
  sign: {name:'Standing sign',category:'Shop',layer:'fit',color:4,height:1.15,icon:'sign'},
  path: {name:'Paving',category:'Outside',layer:'floor',color:6,icon:'tile'},
  plant: {name:'Planter',category:'Outside',layer:'fit',color:6,height:.68,icon:'plant'},
  bench: {name:'Bench',category:'Outside',layer:'fit',color:1,w:2,height:.82,icon:'bench'},
  lamp: {name:'Lamp',category:'Outside',layer:'fit',color:5,height:1.75,icon:'lamp'}
};

export const defaultLot = {name:'My Lot',items:[]};
export const lotStorage = 'after-hours-personal-lot-v1';
const inRange = (n,max) => Number.isInteger(n) && n>=0 && n<=max;
export const lotName = text => (typeof text==='string' ? text.trim().replace(/\s+/g,' ').slice(0,28) : '') || defaultLot.name;
export const indexAt = coord => Math.floor((coord + lotHalf) / tileSize);
export const centerOf = index => (index + .5) * tileSize - lotHalf;
export const borderOf = index => index * tileSize - lotHalf;
export const onGrid = (col,row) => inRange(col,lotSize-1) && inRange(row,lotSize-1);
export const cellKey = (level,col,row) => (level*lotSize+row)*lotSize+col;

export function footprint(piece) {
  const {w=1,d=1}=pieces[piece.type];
  return piece.turn%2 ? [d,w] : [w,d];
}

export function pieceKey(piece) {
  return [piece.level,pieces[piece.type].layer,piece.col,piece.row,pieces[piece.type].layer==='edge' ? piece.turn : 0].join(':');
}

export function normalizePiece(value) {
  if (!value || !Object.hasOwn(pieces,value.type)) return;
  const {type,level,col,row,turn,color}=value;
  if (!inRange(level,floorCount-1) || !inRange(turn,3) || !inRange(color,finishes.length-1)) return;
  if (pieces[type].layer==='edge') {
    if (turn>1 || !inRange(col,lotSize-1+turn) || !inRange(row,lotSize-turn)) return;
  } else {
    const [w,d]=footprint(value);
    if (!inRange(col,lotSize-w) || !inRange(row,lotSize-d)) return;
  }
  if (type==='stairs' && level===floorCount-1) return;
  return {type,level,col,row,turn,color};
}

export function covers(piece,col,row) {
  const [w,d]=footprint(piece);
  return col>=piece.col && col<piece.col+w && row>=piece.row && row<piece.row+d;
}

export function placePiece(items,piece) {
  const clean=normalizePiece(piece);
  if (!clean) return {error:piece?.type==='stairs' && piece.level===floorCount-1 ? 'Stairs need a floor above.' : 'That piece needs more room on the lot.'};
  const info=pieces[clean.type];
  const key=pieceKey(clean);
  if (info.layer==='fit') {
    const [w,d]=footprint(clean);
    const conflict=items.find(item=>{
      if (item.level!==clean.level || pieces[item.type].layer!=='fit') return false;
      const [a,b]=footprint(item);
      return clean.col<item.col+a && clean.col+w>item.col && clean.row<item.row+b && clean.row+d>item.row;
    });
    if (conflict) return {error:'That space is occupied by '+pieces[conflict.type].name.toLowerCase()+'.'};
  }
  const old=items.find(item=>pieceKey(item)===key);
  if (old?.type===clean.type && old.color===clean.color && old.turn===clean.turn) return {items};
  return {items:[...items.filter(item=>pieceKey(item)!==key),clean]};
}

export function readLot(text) {
  try {
    const value=JSON.parse(text);
    if (!value || !Array.isArray(value.items)) return defaultLot;
    const items=new Map(), occupied=new Set();
    const capacity=floorCount*(4*lotSize*lotSize+2*lotSize*(lotSize+1));
    for (const entry of value.items.slice(0,capacity)) {
      const piece=normalizePiece(entry);
      if (!piece) continue;
      if (pieces[piece.type].layer==='fit') {
        const [w,d]=footprint(piece), cells=[];
        for (let z=0;z<d;z++) for (let x=0;x<w;x++) cells.push(cellKey(piece.level,piece.col+x,piece.row+z));
        if (cells.some(cell=>occupied.has(cell))) continue;
        cells.forEach(cell=>occupied.add(cell));
      }
      items.set(pieceKey(piece),piece);
    }
    return {name:lotName(value.name),items:[...items.values()]};
  } catch {
    return defaultLot;
  }
}

export function pieceCenter(piece) {
  if (pieces[piece.type].layer==='edge') {
    return [piece.turn ? borderOf(piece.col) : centerOf(piece.col),piece.turn ? centerOf(piece.row) : borderOf(piece.row)];
  }
  const [w,d]=footprint(piece);
  return [borderOf(piece.col)+w*tileSize/2,borderOf(piece.row)+d*tileSize/2];
}

export function edgeAt(col,row,side) {
  if (side===1 || side===3) return [col+Number(side===1),row,1];
  return [col,row+Number(side===2),0];
}

export function sampleTile(x,z) {
  const col=indexAt(x),row=indexAt(z);
  if (!onGrid(col,row)) return;
  const dx=(x-borderOf(col))/tileSize,dz=(z-borderOf(row))/tileSize;
  const distances=[dz,1-dx,1-dz,dx];
  const distance=Math.min(...distances);
  return {col,row,side:distances.indexOf(distance),distance};
}

export function candidate(type,level,color,turn,tile) {
  if (!tile) return;
  const [col,row,rotation]=pieces[type].layer==='edge'
    ? edgeAt(tile.col,tile.row,tile.side ?? turn)
    : [tile.col,tile.row,turn];
  return {type,level,col,row,turn:rotation,color};
}

export function existingAt(items,level,tile,selected) {
  if (!tile) return;
  const {col,row,distance,side}=tile;
  const local=items.filter(item=>item.level===level);
  const [edgeCol,edgeRow,edgeTurn]=edgeAt(col,row,side ?? 0);
  const edge=local.find(item=>pieces[item.type].layer==='edge' && item.col===edgeCol && item.row===edgeRow && item.turn===edgeTurn);
  if (distance<=.23 && edge) return edge;
  const at=layer=>local.find(item=>pieces[item.type].layer===layer && covers(item,col,row));
  return (selected==='roof' && at('roof')) || at('fit') || at('decor') || at('floor') || edge || at('roof');
}

export function stairCells(items) {
  const openings=new Set();
  for (const stair of items.filter(item=>item.type==='stairs')) {
    const [w,d]=footprint(stair);
    for (let z=stair.row;z<stair.row+d;z++) for (let x=stair.col;x<stair.col+w;x++) {
      openings.add(cellKey(stair.level+1,x,z));
    }
  }
  return openings;
}

export const lotPlans = [
  {id:'house',name:'Juniper House',detail:'Two bedrooms and an open living room'},
  {id:'shop',name:'Corner Shop',detail:'Display shelves, a checkout, and front windows'},
  {id:'apartments',name:'Maple Apartments',detail:'Two floors connected by a central staircase'}
];

export function starterLot(id) {
  const plan=lotPlans.find(choice=>choice.id===id);
  if (!plan) return defaultLot;
  const items=[];
  const add=(type,col,row,level=0,turn=0,color=pieces[type].color)=>items.push({type,level,col,row,turn,color});
  const room=(level,floor,wallColor,roofed)=>{
    for (let z=4;z<=10;z++) for (let x=3;x<=10;x++) {
      add(floor,x,z,level);
      if (roofed) add('roof',x,z,level);
    }
    for (let x=3;x<=10;x++) {
      add(x%3===1 ? 'window' : 'wall',x,4,level,0,wallColor);
      add(x===6 && level===0 ? 'doorway' : x%2===1 ? 'window' : 'wall',x,11,level,0,wallColor);
    }
    for (let z=4;z<=10;z++) for (const x of [3,11]) add(z%3===0 ? 'window' : 'wall',x,z,level,1,wallColor);
  };
  const bedrooms=(level,color)=>{
    for (let x=3;x<=10;x++) add(x===4 || x===9 ? 'doorway' : 'wall',x,7,level,0,color);
    for (let z=4;z<7;z++) add('wall',7,z,level,1,color);
    add('bed',4,5,level); add('bed',9,5,level,0,3);
  };
  for (const z of [11,12,13]) add('path',6,z);
  add('plant',4,11,0,0,1); add('plant',8,11);
  if (id==='shop') {
    room(0,'tile',6,true);
    add('counter',8,5,0,0,1); add('shelf',4,4);
    add('shelf',4,6,0,1); add('display',7,7,0,0,2);
    add('display',8,8,0,0,4); add('sign',8,12,0,0,4);
    add('bench',9,12,0,0,1);
  } else if (id==='house') {
    room(0,'timber',0,true);
    bedrooms(0,6);
    add('sofa',4,8,0,0,2); add('rug',5,9);
    add('kitchen',8,7);
    add('table',9,9,0,0,1);
  } else {
    room(0,'timber',2,false);
    room(1,'timber',0,true);
    add('stairs',6,7); add('bed',4,5); add('bed',9,5,0,0,3);
    add('sofa',8,9,0,0,2); add('kitchen',8,7);
    add('bed',4,5,1,0,2); add('bed',9,5,1);
    add('sofa',8,8,1,0,3); add('kitchen',4,8,1);
    for (let z=4;z<7;z++) {
      add('wall',7,z,0,1,6);
      add('wall',7,z,1,1,6);
    }
    for (const level of [0,1]) {
      add('doorway',4,7,level);
      add('wall',5,7,level);
      add('wall',8,7,level);
      add('doorway',9,7,level);
    }
  }
  return {name:plan.name,items};
}
