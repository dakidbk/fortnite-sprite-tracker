import { material as m } from './webgl.js';

export const LOUNGE = {doorX:8.82,doorHalf:1.08,left:-.92,right:10.50,back:-28.6};
export const loungeTables = [
  {x:2.05,z:-23.55,w:1.54,d:1.18,name:'Library table'},
  {x:6.48,z:-25.85,w:1.54,d:1.18,name:'Corner table'}
];
const sofas = [
  {x:1.24,z:-27.74,w:2.45,d:.93,yaw:0},
  {x:4.20,z:-27.74,w:2.45,d:.93,yaw:0}
];
export const loungeSofaSeats = sofas.flatMap(({x,z})=>
  [-.60,.60].map(offset=>({x:x+offset,z:z+.08,yaw:Math.PI})));

export function loungeSeats(index) {
  const {x,z}=loungeTables[index];
  return [{x,z:z+1.02,yaw:0},{x,z:z-1.02,yaw:Math.PI}];
}

const walnut=m('#72523c',0,1,.28), oak=m('#b68b60',0,1,.28);
const iron=m('#303736',0,1,.46), brass=m('#c4a371',.13,1,.46);
const paint=m('#69887d',.22), linen=m('#d1bdaa',.20);
const wall=m('#a9aaa0',.14), plum=m('#795d65',.14);
const cushion=m('#708d7e',.11), deep=m('#49695d',.11);
const lit=m('#ffe4b6',1.04), white=m('#fff4e2',.85);

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

function table(mesh,table,index) {
  const {x,z,w,d}=table;
  mesh.block(x,.772,z,w,.135,d,.052,oak);
  mesh.box(x,.705,z,w-.16,.047,d-.16,walnut);
  mesh.block(x,.341,z,.20,.65,.22,.032,iron);
  mesh.block(x,.047,z,1.15,.09,.71,.034,iron);
  mesh.ground(x,.842,z,.95,.71,index ? paint : plum);
  if (!index) {
    for (const offset of [-.12,.12]) {
      mesh.box(x+offset,.852,z,.014,.008,.61,linen);
      mesh.box(x,.852,z+offset,.84,.008,.014,linen);
    }
    for (const [dx,dz,col] of [[-.27,.19,brass],[.27,-.19,paint],[.27,.19,brass]]) {
      mesh.rod([x+dx,.855,z+dz],[x+dx,.887,z+dz],.068,.068,10,col);
    }
  } else {
    for (let r=-1;r<=1;r++) for (let c=-2;c<=2;c++) {
      mesh.rod([x+c*.16,.849,z+r*.166],[x+c*.16,.872,z+r*.166],.048,.048,10,(r+c)%2 ? linen : walnut);
    }
  }
  const collisions=[[x-w/2,x+w/2,z-d/2,z+d/2,.88]];
  for (const seat of loungeSeats(index)) {
    mesh.inFrame(seat.x,0,seat.z,seat.yaw,part=>{
      part.block(0,.44,0,.68,.12,.62,.053,index ? plum : cushion);
      for (const side of [-1,1]) for (const end of [-1,1]) part.box(side*.24,.22,end*.23,.066,.44,.066,iron);
      part.block(0,.71,.262,.65,.44,.09,.029,walnut);
      part.block(0,.727,.213,.52,.34,.065,.028,index ? plum : cushion);
    });
    collisions.push([seat.x-.33,seat.x+.33,seat.z-.31,seat.z+.31,.94]);
  }
  return collisions;
}

export function buildLounge(mesh,sign,front) {
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
  for (const side of [left,right]) obstacles.push(box(mesh,{x:side,z:center,w:.28,d:depth},3.79,wall));
  obstacles.push(framedWall(mesh,mid,back,width+.26,3.79));
  const segment=doorX-doorHalf-left;
  mesh.box(left+segment/2,1.88,front-.012,segment,3.76,.24,paint);
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
  for (const x of [1.84,5.11,8.08]) {
    mesh.box(x,3.698,center,.77,.097,3.17,iron);
    mesh.box(x,3.635,center,.59,.047,2.93,lit);
  }
  mesh.ground(4.19,.019,-25.0,8.20,4.82,m('#5c7366',.20));
  mesh.ground(4.19,.024,-25.0,7.98,4.60,m('#7b9181',.16));
  mesh.ground(4.19,.030,-25.0,7.87,4.49,m('#5e7469',.16));
  for (const prop of sofas) obstacles.push(sofa(mesh,prop));
  for (const [i,spot] of loungeTables.entries()) obstacles.push(...table(mesh,spot,i));
  for (const x of [1.62,4.25,6.91,8.82]) {
    mesh.block(x,2.44,back+.18,1.02,.82,.11,.029,walnut);
    mesh.front(x,2.44,back+.241,.89,.70,linen);
    mesh.front(x,2.48,back+.247,.74,.52,x<4 ? plum : paint);
    mesh.front(x,2.235,back+.251,.46,.022,walnut);
    mesh.rod([x,2.53,back+.258],[x,2.53,back+.270],.147,.147,14,brass);
  }
  const lampX=5.91,lampZ=-27.70;
  mesh.block(lampX,.055,lampZ,.43,.108,.43,.038,iron);
  mesh.rod([lampX,.10,lampZ],[lampX,1.95,lampZ],.031,.028,8,iron);
  mesh.rod([lampX,1.69,lampZ],[lampX,2.12,lampZ],.32,.20,12,linen);
  mesh.rod([lampX,1.685,lampZ],[lampX,1.702,lampZ],.26,.26,10,lit);
  return obstacles;
}
