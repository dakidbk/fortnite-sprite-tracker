import { Mesh, clamp, material, seeded } from './webgl.js?v=visual-28';
import { autumnTree, contactShadow, shrub } from './scenery.js?v=visual-28';
import {
  borderOf, cellKey, centerOf, finishes, floorCount, floorHeight, footprint,
  frontPath, indexAt, lotHalf, lotSize, lotSpawn, onGrid, pieceCenter, pieces, stairCells, tileSize
} from './lot-layout.js?v=property-26';

const color = (hex,glow=0,alpha=1,surface=0,sheen=.22) => material(hex,glow,alpha,sheen,surface);
const finishes3d = finishes.map(([,hex])=>color(hex,.08));
const cream=color('#ede5d0',.035,1,4,.12), oak=color('#af8861',.025,1,1), dark=color('#38403d',.02,1,5,.45);
const brass=color('#b89b70',.05,1,5,.64), basin=color('#718686',.04,1,5,.62);
const glassColor=color('#9dc3c5',.35,.24,0,.76), warm=color('#ffdd9d',.98);
const fitSizes={
  bed:[1.25,2.35], sofa:[2.66,1.07], table:[1.26,1.30], kitchen:[2.68,.70],
  counter:[2.70,.87], shelf:[2.72,.57], display:[1.10,1.05], sign:[.79,.55],
  plant:[.66,.66], bench:[2.55,.70], lamp:[.29,.29]
};
const lobbyLights=[
  [[-7,5.8,10.4],'#ffc88f',16,.97], [[7,5.1,9.7],'#ffe7c8',15,.87],
  [[0,7.9,-4.9],'#c4dbf0',15,.91], [[-7.5,4.3,-6.7],'#ffd7a7',12,.78],
  [[6,6,-6.5],'#ffdab0',13,.84], [[0,2.5,16.9],'#eec189',7,.88]
];

function tree(mesh,x,z,scale,ink) {
  autumnTree(mesh,x,z,4*scale,Math.round(Math.abs(x+z))%4,0);
}

function house(mesh,x,z,facade) {
  const w=5.3,d=4.25,h=3.25;
  mesh.block(x,h/2,z,w,h,d,.04,color(facade,.035,1,3,.12));
  mesh.box(x,.14,z,w+.19,.28,d+.21,dark);
  mesh.box(x,3.30,z,w+.47,.20,d+.48,dark);
  mesh.box(x,3.59,z-.33,w*.54,.36,d*.65,dark);
  mesh.front(x-.35,1.12,z+d/2+.02,1.13,2.04,color('#a87c59',.17));
  for (const a of [-1.78,1.49]) {
    mesh.front(x+a,1.89,z+d/2+.022,1.16,1.06,dark);
    mesh.front(x+a,1.89,z+d/2+.026,.98,.86,color('#f2d3a3',.62));
    mesh.front(x+a,1.89,z+d/2+.03,.046,.88,dark);
  }
}

export function createLotGround(renderer) {
  const ground=new Mesh();
  const lawn=color('#6b8056',.04,1,6,.08), earth=color('#596e4e',.05,1,6,.08), curb=color('#b4afa1',.03,1,2);
  const random=seeded(47281);
  ground.ground(0,-.16,0,100,100,earth);
  ground.ground(0,-.01,0,lotHalf*2+2.55,lotHalf*2+4.02,lawn);
  ground.ground(0,-.006,frontPath+.62,68,2.3,curb);
  for (let z=lotHalf+.39;z<frontPath;z+=.81) ground.ground(lotSpawn.x,.004,z,tileSize-.055,.78,color('#ac9b82',.12));
  ground.ground(0,-.047,frontPath+5.30,74,7.10,color('#49545b',.025,1,2));
  ground.box(0,-.034,frontPath+1.77,69,.15,.19,curb);
  for (let x=-33;x<35;x+=3.4) ground.ground(x,-.041,frontPath+5.04,1.38,.12,color('#b9a989',.22));

  for (const side of [-1,1]) {
    const x=side*(lotHalf+1.13);
    ground.box(x,.41,-.15,.12,.12,lotHalf*2+.30,oak);
    for (let z=-lotHalf;z<lotHalf+.2;z+=2.24) ground.box(x,.26,z,.16,.56,.17,dark);
  }
  ground.box(0,.40,-lotHalf-1.01,lotHalf*2+2.43,.13,.12,oak);
  for (let x=-lotHalf-1;x<lotHalf+1.1;x+=2.24) ground.box(x,.26,-lotHalf-1.01,.17,.55,.18,dark);
  for (let index=0;index<6;index++) {
    const x=-22+index*8.6;
    house(ground,x,-20.3-(index%2)*1.33,['#a68f79','#92a296','#b0a697'][index%3]);
    tree(ground,x+3.15,-16.75-random()*3,.84+random()*.47,['#b37d50','#a68850','#926d59'][index%3]);
  }
  for (const side of [-1,1]) {
    tree(ground,side*14.1,7.2,1.24,side<0 ? '#b17c4e' : '#a78e52');
    for(let z=-10;z<10;z+=1.3) shrub(ground,side*(lotHalf+1.65),0,z,.91,'#637453');
    tree(ground,side*15.0,-5.7,1.35,side<0 ? '#8f704e' : '#b36d4d');
    ground.box(side*1.65,.055,frontPath-.38,.36,.11,.32,dark);
    ground.box(side*1.65,.55,frontPath-.38,.11,1.02,.11,dark);
    ground.block(side*1.65,1.07,frontPath-.38,.27,.24,.26,.022,warm);
  }
  for (let i=0;i<96;i++) {
    const x=(random()-.5)*24,z=(random()-.47)*25, size=.07+random()*.14;
    ground.inFrame(x,.002,z,random()*6.28,y=>y.ground(0,0,0,size,size*.64,color(i%3===0 ? '#ad784c' : '#957850',.16)));
  }
  return renderer.upload(ground);
}

export function createBuildGrid(renderer) {
  const mesh=new Mesh(), line=color('#bcc9ad',.38), outline=color('#edcd9b',.56);
  for (let i=0;i<=lotSize;i++) {
    const mat=i===0 || i===lotSize ? outline : line;
    const size=i===0 || i===lotSize ? .063 : .029;
    mesh.ground(borderOf(i),0,0,size,lotHalf*2,mat);
    mesh.ground(0,0,borderOf(i),lotHalf*2,size,mat);
  }
  return renderer.upload(mesh);
}

function edgeParts(mesh,pane,type,h,paint) {
  const width=tileSize-.003;
  if (h>2) mesh.box(0,h-.047,0,width,.094,.24,dark);
  if (type==='wall') {
    mesh.box(0,h/2,0,width,h,.14,paint);
    mesh.box(0,.048,0,width,.080,.175,oak);
    return;
  }
  if (type==='doorway') {
    for (const side of [-1,1]) mesh.box(side*.716,h/2,0,.175,h,.21,paint);
    const top=h*.16;
    mesh.box(0,h-top/2,0,width,top,.21,paint);
    mesh.box(0,h-top-.024,0,1.40,.049,.30,oak);
    return;
  }
  const bottom=h*.31, top=h*.19, middle=h-bottom-top;
  mesh.box(0,bottom/2,0,width,bottom,.15,paint);
  mesh.box(0,h-top/2,0,width,top,.15,paint);
  for (const x of [-.745,0,.745]) mesh.box(x,bottom+middle/2,0,x===0 ? .043 : .124,middle,.17,oak);
  mesh.box(0,bottom,0,width,.045,.24,oak);
  mesh.box(0,h-top,0,width,.042,.21,oak);
  pane.box(0,bottom+middle/2,0,1.44,middle,.019,glassColor);
  for(const side of [-1,1]) pane.inFrame(0,0,side*.011,side<0 ? Math.PI : 0,part=>{
    part.quad([-.65,bottom+middle*.77,0],[-.65,bottom+middle*.92,0],[.45,bottom+.04,0],[.27,bottom+.04,0],color('#e4ece0',.85,.09));
  });
}

const stairRun=tileSize*3;
const stairSteps=13;
const stairTread=stairRun/stairSteps;
export const treadHeight = index => clamp(index,0,stairSteps-1)*floorHeight/(stairSteps-1);

function stairs(mesh,paint) {
  for (let i=0;i<stairSteps;i++) {
    const h=treadHeight(i), z=stairRun/2-(i+.5)*stairTread;
    mesh.box(0,h-.06,z,1.36,.12,stairTread+.008,paint);
    mesh.box(0,h-.13,z+.17,1.29,.16,.066,oak);
    if (i%3===0) {
      for (const x of [-.67,.67]) mesh.box(x,h+.43,z,.068,.91,.064,dark);
    }
  }
  for (const x of [-.67,.67]) {
    mesh.rod([x,.86,stairRun/2-.17],[x,floorHeight+.86,-stairRun/2+.17],.038,.038,6,dark);
    mesh.rod([x,-.17,stairRun/2-.12],[x,floorHeight-.17,-stairRun/2+.11],.071,.071,5,oak);
  }
}

function legs(mesh,w,d,y) {
  for (const x of [-w/2+.12,w/2-.12]) for (const z of [-d/2+.11,d/2-.11]) mesh.box(x,y/2,z,.11,y,.11,dark);
}

function furniture(mesh,type,paint) {
  if (type==='stairs') { stairs(mesh,paint); return; }
  const [w,d]=fitSizes[type];
  if (type==='bed') {
    legs(mesh,w,d,.24);
    mesh.block(0,.29,0,w,.19,d,.06,oak);
    mesh.block(0,.45,-.02,w-.07,.19,d-.09,.055,cream);
    mesh.block(0,.56,.38,w-.09,.088,1.42,.046,paint);
    for (const x of [-.28,.28]) mesh.ellipsoid(x,.57,-.81,.255,.105,.205,12,7,cream);
    mesh.block(0,.45,-d/2+.02,w,.89,.12,.036,paint);
    mesh.box(0,.612,.88,w-.16,.026,.18,cream);
  } else if (type==='sofa' || type==='bench') {
    legs(mesh,w,d,.25);
    mesh.block(0,.36,0,w,.29,d,.055,type==='bench' ? oak : paint);
    mesh.block(0,.65,-d/2+.13,w,.55,.24,.055,paint);
    for (const side of [-1,1]) mesh.block(side*(w/2-.12),.49,0,.24,.32,d,.06,paint);
    for (const x of [-w*.23,w*.23]) {
      mesh.block(x,.52,.086,w*.431,.15,d*.66,.069,cream);
      if(type==='sofa')mesh.block(x,.77,-.30,w*.41,.33,.19,.065,cream);
    }
    if(type==='sofa')mesh.ellipsoid(-w*.32,.72,-.13,.18,.20,.11,12,8,paint);
  } else if (type==='table' || type==='display') {
    const depth=type==='table' ? .90 : d;
    legs(mesh,w,depth,.68);
    mesh.block(0,.726,0,w,.11,depth,.053,paint);
    if (type==='table') {
      for (const z of [-.63,.63]) {
        mesh.block(0,.33,z,.43,.12,.36,.038,oak);
        mesh.box(0,.47,z+Math.sign(z)*.16,.39,.48,.066,paint);
      }
    } else {
      mesh.box(-.21,.83,.08,.28,.13,.34,brass);
      mesh.box(.17,.85,.06,.29,.18,.34,oak);
    }
  } else if (type==='kitchen' || type==='counter') {
    mesh.block(0,.47,0,w,.91,d,.042,paint);
    mesh.block(0,.94,0,w+.08,.105,d+.085,.041,cream);
    for (const x of [-w*.33,0,w*.33]) {
      mesh.front(x,.46,d/2+.007,w*.31,.67,oak);
      mesh.box(x,.64,d/2+.029,.22,.038,.044,dark);
    }
    if (type==='kitchen') {
      mesh.box(.72,1.006,0,.59,.030,.42,basin);
      mesh.rod([.72,1.0,-.16],[.72,1.22,-.16],.025,.025,8,brass);
      for(let i=0;i<8;i++){
        const p=a=>[.72,1.22+Math.sin(a)*.08,-.08-Math.cos(a)*.08];
        mesh.rod(p(i*Math.PI/8),p((i+1)*Math.PI/8),.025,.025,8,brass);
      }
      for (const x of [-.84,-.51]) mesh.box(x,1.007,0,.22,.026,.23,dark);
    } else {
      mesh.box(.67,1.06,-.13,.51,.10,.32,dark);
      mesh.box(.67,1.25,-.22,.55,.27,.072,dark);
      mesh.front(.67,1.25,-.181,.44,.18,basin);
    }
  } else if (type==='shelf') {
    mesh.box(0,.87,-.24,w,1.74,.078,dark);
    for (const x of [-w/2+.05,w/2-.05]) mesh.box(x,.89,0,.10,1.78,d,paint);
    for (const y of [.14,.62,1.10,1.58]) {
      mesh.box(0,y,0,w,.073,d,paint);
      for (let i=0;i<5;i++) {
        const ink=finishes3d[(i+Math.floor(y*8))%finishes3d.length];
        mesh.block((i-2)*.44,y+.18,-.018,.30,.29,.32,.018,ink);
      }
    }
  } else if (type==='plant') {
    mesh.rod([0,.04,0],[0,.34,0],.23,.32,9,paint);
    for (let i=0;i<5;i++) {
      const a=i*1.26;
      mesh.rod([0,.32,0],[Math.sin(a)*.24,.67+Math.sin(a)*.12,Math.cos(a)*.24],.13,.046,5,finishes3d[2]);
    }
  } else if (type==='sign') {
    for (const x of [-.34,.34]) mesh.box(x,.49,0,.081,.98,d,oak);
    mesh.block(0,.74,.012,.79,.72,.11,.034,paint);
    mesh.front(0,.78,.071,.65,.51,dark);
    for (let y=.65;y<.92;y+=.105) mesh.front(0,y,.076,.34,.025,cream);
  } else if (type==='lamp') {
    mesh.rod([0,0,0],[0,.08,0],.19,.19,8,paint);
    mesh.rod([0,.07,0],[0,1.63,0],.037,.030,7,paint);
    mesh.rod([0,1.52,0],[0,1.84,0],.24,.16,9,cream);
    mesh.rod([0,1.506,0],[0,1.53,0],.18,.18,9,warm);
  }
}

function surface(mesh,type,paint) {
  if (type==='roof') {
    mesh.box(0,floorHeight-.091,0,tileSize,.16,tileSize,paint);
    mesh.box(0,floorHeight-.010,.36,tileSize-.002,.032,.051,dark);
  } else if (type==='rug') {
    mesh.ground(0,.028,0,1.34,1.31,paint);
    mesh.ground(0,.029,0,1.16,1.11,cream);
    mesh.ground(0,.030,0,1.10,1.05,paint);
  } else if (type==='timber') {
    mesh.box(0,-.031,0,tileSize,.093,tileSize,oak);
    for (let i=0;i<4;i++) mesh.ground((i-1.5)*tileSize/4,.017,0,tileSize/4-.010,tileSize-.009,paint);
  } else {
    mesh.box(0,-.035,0,tileSize,.098,tileSize,oak);
    const w=tileSize/2;
    for (const a of [-1,1]) for (const b of [-1,1]) mesh.ground(a*w/2,.017,b*w/2,w-.023,w-.023,paint);
  }
}

function upload(renderer,mesh) {
  return mesh.data.length ? renderer.upload(mesh) : null;
}

export function makeProperty(renderer,items,buildLevel,showRoof=false) {
  const solid=new Mesh(), glass=new Mesh(), shadow=new Mesh();
  const openings=stairCells(items);
  for (const item of items) {
    const {type,level,col,row,turn,color:ink}=item;
    if (buildLevel!==null && level>buildLevel) continue;
    const layer=pieces[type].layer;
    const surfaceId=type==='timber' || type==='stairs' || type==='bench' || type==='shelf' || type==='table' ? 1
      : type==='rug' || type==='bed' || type==='sofa' ? 4
      : layer==='edge' ? 3 : type==='lamp' ? 5 : 2;
    const paint=color(finishes[ink][1],.025,1,surfaceId,surfaceId===5 ? .55 : .19);
    const [x,z]=pieceCenter(item), y=level*floorHeight, yaw=turn*Math.PI/2;
    if (layer==='edge') {
      const h=level===buildLevel ? 1.03 : floorHeight;
      solid.inFrame(x,y,z,yaw,part=>glass.inFrame(x,y,z,yaw,pane=>edgeParts(part,pane,type,h,paint)));
    } else if (layer==='fit') {
      solid.inFrame(x,y+.020,z,yaw,part=>furniture(part,type,paint));
      if(type!=='stairs'){
        const [w,d]=fitSizes[type];
        shadow.inFrame(x,y,z,yaw,part=>contactShadow(part,0,.025,0,w+.24,d+.22));
      }
    } else if (layer==='roof' && buildLevel!==null) {
      if (level===buildLevel && showRoof) {
        solid.ground(x-.65,y+.033,z,.051,1.26,paint);
        solid.ground(x+.65,y+.033,z,.051,1.26,paint);
      }
    } else if (layer==='floor' || layer==='roof' || layer==='decor') {
      const above=level+Number(layer==='roof');
      if (!openings.has(cellKey(above,col,row))) solid.inFrame(x,y,z,0,part=>surface(part,type,paint));
    }
  }
  const lights=[...lobbyLights];
  for (const item of items.filter(item=>item.type==='lamp').slice(0,8)) {
    const [x,z]=pieceCenter(item);
    lights.push([[x,item.level*floorHeight+1.84,z],'#ffc794',5.9,1.04]);
  }
  return {solid:upload(renderer,solid),glass:upload(renderer,glass),shadow:upload(renderer,shadow),lights};
}

export function makeMarker(renderer,piece,valid,level,tile) {
  if (!piece && !tile) return null;
  const mesh=new Mesh(), ink=color(valid ? '#e5e9b0' : '#ef957c',.62);
  let [x,z]=piece && pieces[piece.type] ? pieceCenter(piece) : [centerOf(tile.col),centerOf(tile.row)];
  let [width,depth]=piece ? footprint(piece).map(n=>n*tileSize) : [tileSize,tileSize];
  if (piece && pieces[piece.type].layer==='edge') [width,depth]=piece.turn ? [.19,tileSize] : [tileSize,.19];
  const y=level*floorHeight+.050;
  if (piece?.type==='stairs') {
    const a=piece.turn*Math.PI/2;
    mesh.inFrame(x,y,z,a,part=>part.ground(0,0,-stairRun/2+.24,1.22,.13,ink));
  }
  for (const side of [-1,1]) {
    mesh.ground(x,y,z+side*(depth-.046)/2,width,.058,ink);
    mesh.ground(x+side*(width-.046)/2,y,z,.058,depth,ink);
  }
  return renderer.upload(mesh);
}

function collisionBox(bounds,x,y,z,w,d,h) {
  bounds.push([x-w/2,x+w/2,z-d/2,z+d/2,y,y+h]);
}

export function propertyPhysics(items) {
  const bounds=[], floors=new Set(), stairways=[];
  const openings=stairCells(items);
  for (const item of items) {
    const {type,level,turn,col,row}=item;
    const layer=pieces[type].layer, y=level*floorHeight;
    const [x,z]=pieceCenter(item);
    if (type==='stairs') {
      const a=turn*Math.PI/2;
      stairways.push({x,y,z,s:Math.sin(a),c:Math.cos(a)});
    } else if (layer==='fit') {
      const [w,d]=fitSizes[type];
      collisionBox(bounds,x,y,z,turn%2 ? d : w,turn%2 ? w : d,pieces[type].height);
    } else if (layer==='edge') {
      const wall=(along,height,width,base=0)=>collisionBox(bounds,x+(turn ? 0 : along),y+base,z-(turn ? along : 0),turn ? .165 : width,turn ? width : .165,height);
      if (type==='doorway') {
        for (const a of [-.716,.716]) wall(a,floorHeight,.175);
        wall(0,.49,tileSize,2.56);
      } else wall(0,floorHeight,tileSize+.01);
    } else if (layer==='floor') {
      const key=cellKey(level,col,row);
      if (openings.has(key)) continue;
      floors.add(key);
      if (level) collisionBox(bounds,x,y-.083,z,tileSize,tileSize,.1);
    } else if (layer==='roof' && !openings.has(cellKey(level+1,col,row))) {
      collisionBox(bounds,x,y+floorHeight-.171,z,tileSize,tileSize,.171);
    }
  }

  const inside=(x,z)=>Math.abs(x)<=lotHalf+.90 && z>=-lotHalf-.78 && z<=frontPath+.26;
  const hits=(x,z,y,r=.235,height=2.20)=>bounds.some(([l,u,b,f,bottom,top])=>{
    if (top<=y+.024 || bottom>=y+height) return false;
    const dx=x-clamp(x,l,u), dz=z-clamp(z,b,f);
    return dx*dx+dz*dz<r*r;
  });
  return {
    step(x,z,height) {
      if (!inside(x,z)) return null;
      const surfaces=[0], col=indexAt(x),row=indexAt(z);
      if (onGrid(col,row)) for (let level=1;level<floorCount;level++) {
        if (floors.has(cellKey(level,col,row))) surfaces.push(level*floorHeight);
      }
      for (const {x:cx,y,z:cz,c,s} of stairways) {
        const dx=x-cx,dz=z-cz;
        if (Math.abs(dx*c-dz*s)>.70) continue;
        const offset=dx*s+dz*c;
        if (Math.abs(offset)>stairRun/2+.015) continue;
        surfaces.push(y+treadHeight(Math.floor((stairRun/2-offset)/stairTread)));
      }
      surfaces.sort((a,b)=>b-a);
      for (const y of surfaces) {
        if (Math.abs(y-height)>.32 || hits(x,z,y)) continue;
        return y;
      }
      return null;
    },
    cameraBlocked(x,y,z) {
      return hits(x,z,y-.09,.12,.19);
    }
  };
}
