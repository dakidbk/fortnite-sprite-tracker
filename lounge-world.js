import { material as m } from './webgl.js?v=lighting-22';
import { boardGames, tableLayout } from './supabase/functions/game-rooms/lounge-rules.js?v=lounge-23';

export const LOUNGE = {doorX:8.82,doorHalf:1.08,left:-10.49,right:10.50,back:-39.10};
export const loungeTables = tableLayout.map((spot,index)=>({
  ...spot,index,w:1.70,d:1.18,name:boardGames[spot.kind].name,color:boardGames[spot.kind].color
}));
export const loungeReach = 1.97;
const sofas = [-.63,2.47,5.57,8.67].map(x=>({x,z:-37.97,w:2.52,d:.95,yaw:0}));
export const loungeSofaSeats = sofas.flatMap(({x,z})=>
  [-.60,.60].map(offset=>({x:x+offset,z:z+.08,yaw:Math.PI})));
const lightXs = [-7.3,-2.65,2.1,6.7];
const lightZs = [-22.5,-28.7,-35.5];
export const loungeLights = [
  ...lightZs.flatMap(z=>lightXs.map(x=>[[x,3.37,z],'#ffe4bc',6.45,1.23])),
  [[8.7,3.21,-20.1],'#ffda9f',5.4,1.19],
  [[7.15,2.02,-38.03],'#ffd999',5.4,.95],
  [[-2.24,2.02,-38.03],'#ffd999',5.4,.82],
  [[6.2,3.6,-16.5],'#ffcdb3',5.3,.98]
];

export function loungeSeats(index) {
  const {x,z}=loungeTables[index];
  return [{x,z:z+1.02,yaw:0},{x,z:z-1.02,yaw:Math.PI}];
}

const walnut=m('#72523c',0,1,.28), oak=m('#b68b60',0,1,.28);
const iron=m('#303736',0,1,.46), brass=m('#c4a371',.13,1,.46);
const paint=m('#69887d',.22), linen=m('#d1bdaa',.20);
const wall=m('#a9aaa0',.14), plum=m('#795d65',.14);
const cushion=m('#708d7e',.11), deep=m('#49695d',.11);
const panel=m('#718376',.17), awning=m('#3e5961',.19);
const lit=m('#ffe4b6',1.04), white=m('#fff4e2',.85);
const script = 'Arial, "DejaVu Sans", sans-serif';

function atlasUV(index,top,bottom) {
  const left=(index%2+.009)/2,right=(index%2+.991)/2,row=Math.floor(index/2);
  const a=1-(row+bottom)/5,b=1-(row+top)/5;
  return [[left,a],[right,a],[right,b],[left,b]];
}

export function paintTableAtlas(ctx,width,height) {
  const w=width/2,h=height/5;
  for (const {kind,index,name,color} of loungeTables) {
    const {cols,rows}=boardGames[kind];
    ctx.save();
    ctx.translate(index%2*w,Math.floor(index/2)*h);
    ctx.fillStyle='#23352f';ctx.fillRect(0,0,w,h);
    ctx.fillStyle=color;ctx.fillRect(0,0,w,72);
    ctx.font='800 34px '+script;
    ctx.textBaseline='middle';
    ctx.fillStyle='#202927';
    ctx.fillText(String(index+1).padStart(2,'0'),21,37);
    ctx.fillRect(77,20,2,32);
    ctx.fillText(name.toUpperCase(),96,37,w-114);

    ctx.fillStyle=color;ctx.fillRect(9,84,w-18,h-95);
    ctx.fillStyle='#273a34';ctx.fillRect(18,93,w-36,h-113);
    const gx=66,gy=110,dx=(w-2*gx)/cols,dy=(h-133)/rows;
    const mark=(x,y,r,ink)=>{
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=ink;ctx.fill();
    };
    const well=(x,y,rx,ry)=>{
      ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
      ctx.fillStyle='#4c3428';ctx.fill();ctx.strokeStyle='#d3a575';ctx.lineWidth=3;ctx.stroke();
    };
    if (kind==='mancala') {
      ctx.fillStyle='#9b724b';ctx.fillRect(24,98,w-48,h-122);
      for (const x of [45,w-45]) well(x,gy+dy,17,dy*.83);
    }
    if (kind==='dots') {
      ctx.strokeStyle='#799399';
      ctx.lineWidth=3;
      ctx.beginPath();
      for (let i=0;i<=rows;i++) {
        ctx.moveTo(gx,gy+dy*i);ctx.lineTo(w-gx,gy+dy*i);
        ctx.moveTo(gx+dx*i,gy);ctx.lineTo(gx+dx*i,gy+dy*rows);
      }
      ctx.stroke();
    }
    const extra=kind==='dots' ? 1 : 0;
    const artRows=rows+extra,artCols=cols+extra;
    for (let row=0;row<artRows;row++) for (let col=0;col<artCols;col++) {
      const x=gx+col*dx,y=gy+row*dy,alt=(row+col)%2;
      if (kind==='nim' && col>2+row*2) continue;
      if (kind==='checkers' || kind==='breakthrough') {
        ctx.fillStyle=alt ? '#69524c' : '#c3a781';
        ctx.fillRect(x,y,dx+.2,dy+.2);
        if (alt && (row<2 || row>=rows-2)) mark(x+dx/2,y+dy/2,dy*.36,row<2 ? '#81bba6' : '#e9b57e');
      } else if (kind==='three' || kind==='reversi' || kind==='gomoku') {
        ctx.strokeStyle='#e7d7ae';ctx.lineWidth=kind==='three' ? 2.4 : 1;
        ctx.strokeRect(x,y,dx,dy);
        if (kind==='three' && (row===col || row+col===2)) {
          ctx.fillStyle=row===1 ? '#8edbcb' : '#e9b57e';
          ctx.font='900 43px '+script;
          ctx.textAlign='center';
          ctx.fillText(row===1 ? '○' : '×',x+dx/2,y+dy/2);
        } else if ((row+col*2)%5===0 && (row>0 || col>0)) {
          mark(x+dx/2,y+dy/2,Math.min(dx,dy)*.28,alt ? '#b4d1bb' : '#e9b57e');
        }
      } else if (kind==='mancala') {
        const xx=x+dx/2,yy=y+dy/2;
        well(xx,yy,dx*.40,dy*.36);
        mark(xx-6,yy-6,5,alt ? '#8edbcb' : '#e9b57e');
        mark(xx+4,yy+4,5,'#e9d3ac');
      } else if (kind==='hex') {
        const xx=x+dx*.32+row*3.8,yy=y+dy/2;
        ctx.beginPath();
        for (let i=0;i<6;i++) {
          const angle=(i+.5)*Math.PI/3;
          ctx.lineTo(xx+Math.sin(angle)*dx*.48,yy+Math.cos(angle)*dy*.54);
        }
        ctx.closePath();ctx.fillStyle=(row*3+col)%7===0 ? '#e9b57e' : alt ? '#77a6aa' : '#536f78';ctx.fill();
      } else if (kind==='dots') {
        mark(x,y,5,'#e9d3ac');
      } else {
        mark(x+dx/2,y+dy/2,Math.min(dx,dy)*(kind==='four' || kind==='mancala' ? .36 : .22),alt ? color : '#e9d3ac');
      }
    }
    ctx.restore();
  }
}

function box(mesh,{x,z,w,d},h,mat) {
  mesh.box(x,h/2,z,w,h,d,mat);
  return [x-w/2,x+w/2,z-d/2,z+d/2,h];
}

function framedWall(mesh,x,z,width,height) {
  const center=height/2;
  const collider=box(mesh,{x,z,w:width,d:.28},height,wall);
  mesh.box(x,.115,z+.157,width,.19,.055,walnut);
  mesh.box(x,3.44,z+.16,width,.08,.050,oak);
  mesh.box(x,center,z+.145,width,.025,.020,paint);
  return collider;
}

function sofa(mesh,area) {
  const {x,z,w,d}=area;
  mesh.inFrame(x,0,z,area.yaw,part=>{
    for (const s of [-1,1]) for (const t of [-1,1]) part.box(s*(w/2-.16),.09,t*.34,.11,.18,.12,walnut);
    part.block(0,.30,0,w,.34,d,.09,deep);
    part.block(0,.72,-.35,w-.10,.67,.27,.075,deep);
    for (const s of [-1,1]) {
      part.block(s*(w/2-.115),.53,.04,.23,.46,d-.06,.065,deep);
      part.block(s*.51,.482,.06,.965,.17,.67,.061,cushion);
      part.block(s*.51,.80,-.222,.96,.46,.155,.048,cushion);
    }
    part.block(-.87,.72,-.133,.31,.31,.16,.048,plum);
    part.block(.84,.71,-.135,.32,.28,.16,.044,linen);
  });
  return [x-w/2,x+w/2,z-d/2,z+d/2,1.07];
}

function table(mesh,art,table) {
  const {x,z,w,d,index,color}=table;
  mesh.block(x,.772,z,w,.135,d,.052,oak);
  mesh.box(x,.705,z,w-.16,.047,d-.16,walnut);
  mesh.block(x,.341,z,.20,.65,.22,.032,iron);
  mesh.block(x,.047,z,1.15,.09,.71,.034,iron);
  const fabric=m(color,.16,1,.18);
  mesh.block(x,.851,z,1.39,.034,.94,.03,walnut);
  art.ground(x,.871,z,1.32,.88,white,atlasUV(index,.252,.982));
  if (table.kind==='four') {
    mesh.block(x,1.10,z,1.13,.46,.094,.04,awning);
    for (const side of [-1,1]) art.inFrame(x,1.117,z+side*.049,side===1 ? 0 : Math.PI,part=>
      part.front(0,0,0,1.05,.39,white,atlasUV(index,.252,.982)));
  }
  for (const side of [-1,1]) {
    mesh.block(x,.978,z+side*.365,1.12,.191,.067,.018,iron);
    art.inFrame(x,.978,z+side*.403,side===1 ? 0 : Math.PI,part=>
      part.front(0,0,0,1.052,.152,white,atlasUV(index,.016,.209)));
  }
  const collisions=[[x-w/2,x+w/2,z-d/2,z+d/2,table.kind==='four' ? 1.33 : .88]];
  for (const seat of loungeSeats(index)) {
    mesh.inFrame(seat.x,0,seat.z,seat.yaw,part=>{
      part.block(0,.44,0,.68,.12,.62,.053,fabric);
      for (const side of [-1,1]) for (const end of [-1,1]) part.box(side*.24,.22,end*.23,.066,.44,.066,iron);
      part.block(0,.71,.262,.65,.44,.09,.029,walnut);
      part.block(0,.727,.213,.52,.34,.065,.028,fabric);
    });
    collisions.push([seat.x-.33,seat.x+.33,seat.z-.31,seat.z+.31,.94]);
  }
  return collisions;
}

export function buildLounge(mesh,sign,art,front) {
  const {doorX,doorHalf,left,right,back}=LOUNGE;
  const width=right-left,mid=(left+right)/2,depth=front-back,center=(front+back)/2;
  const obstacles=[];
  mesh.box(mid,-.13,center,width,.255,depth+.03,iron);
  mesh.ground(mid,.006,center,width-.04,depth+.03,m('#938573',.19));
  const boards=[m('#a28b72',.18),m('#96816e',.18),m('#ac947a',.18)];
  for (let i=0;i<Math.floor(width/.34);i++) {
    mesh.ground(left+.18+i*.34,.012,center,.324,depth-.04,boards[i%boards.length]);
  }
  mesh.box(mid,3.85,center,width+.20,.23,depth+.08,m('#737a70',.19));
  for (const side of [left,right]) {
    const inset=side<0 ? 1 : -1;
    obstacles.push(box(mesh,{x:side,z:center,w:.28,d:depth},3.79,wall));
    mesh.box(side+inset*.167,.49,center,.052,.98,depth-.38,panel);
    mesh.box(side+inset*.199,1.01,center,.070,.061,depth-.35,oak);
    mesh.box(side+inset*.184,.09,center,.065,.15,depth-.35,walnut);
  }
  obstacles.push(framedWall(mesh,mid,back,width+.26,3.79));
  const segment=doorX-doorHalf-left;
  mesh.box(left+segment/2,1.88,front-.012,segment,3.76,.24,paint);
  const end=right-doorX-doorHalf;
  mesh.box(right-end/2,1.88,front-.012,end,3.76,.24,paint);
  for (const x of [doorX-doorHalf,doorX+doorHalf]) {
    mesh.block(x,1.56,front,.24,3.13,.45,.028,walnut);
    mesh.box(x,1.56,front+.237,.067,3.05,.044,brass);
  }
  mesh.box(doorX,3.54,front,doorHalf*2+.20,1.39,.34,wall);
  mesh.block(doorX,3.21,front+.245,2.00,.44,.16,.032,iron);
  sign.front(doorX,3.21,front+.333,1.91,.35,white);
  mesh.block(doorX,3.21,front-.214,1.84,.39,.13,.025,iron);
  sign.inFrame(doorX,3.21,front-.289,Math.PI,part=>part.front(0,0,0,1.75,.32,white));
  mesh.box(doorX,.023,front,2.03,.044,.49,brass);
  for (const z of lightZs) for (const x of lightXs) {
    mesh.box(x,3.698,z,2.09,.097,.48,iron);
    mesh.box(x,3.635,z,1.87,.047,.34,lit);
  }
  for (const [x,z,w,d] of [[-.60,-24.05,17.25,6.02],[-.60,-31.40,17.25,6.72],[4.03,-37.27,11.6,2.50]]) {
    mesh.ground(x,.019,z,w,d,m('#425a4d',.18));
    mesh.ground(x,.024,z,w-.18,d-.18,m('#96a088',.16));
    mesh.ground(x,.029,z,w-.28,d-.28,m('#536f60',.16));
  }
  for (const prop of sofas) obstacles.push(sofa(mesh,prop));
  for (const spot of loungeTables) obstacles.push(...table(mesh,art,spot));
  for (let x=-2.91;x<10.20;x+=.166) mesh.box(x,.79,back+.17,.073,1.58,.047,oak);
  for (const [index,x] of [-7.72,-4.46,-1.12,2.24,5.60,8.92].entries()) {
    mesh.block(x,2.44,back+.18,1.02,.82,.11,.029,walnut);
    mesh.front(x,2.44,back+.241,.89,.70,linen);
    mesh.front(x,2.48,back+.247,.74,.52,x<4 ? plum : paint);
    mesh.front(x,2.235,back+.251,.46,.022,walnut);
    mesh.rod([x+.071*(index%3-1),2.55,back+.258],[x+.071*(index%3-1),2.55,back+.270],.132,.132,14,brass);
    mesh.front(x,2.37,back+.252,.39,.017,linen);
  }
  for (const x of [-2.24,7.15]) {
    const z=-38.13;
    obstacles.push(box(mesh,{x,z,w:.41,d:.41},.10,iron));
    mesh.rod([x,.10,z],[x,1.95,z],.031,.028,8,iron);
    mesh.rod([x,1.69,z],[x,2.12,z],.32,.20,12,linen);
    mesh.rod([x,1.685,z],[x,1.702,z],.26,.26,10,lit);
  }
  for (const side of [left,right]) {
    for (const z of [-22.7,-26.2,-29.7,-33.2,-36.7]) {
      const x=side+(side<0 ? .18 : -.18);
      mesh.block(x,1.34,z,.14,2.45,.19,.035,walnut);
      mesh.box(x,2.05,z,.12,.34,.14,brass);
    }
  }
  return obstacles;
}
