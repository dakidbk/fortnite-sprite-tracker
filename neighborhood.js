import { material as m, seeded } from './webgl.js';

const groundY = -.22;
const grass = m('#414c43', .44);
const curb = m('#999185', .37);
const sidewalk = m('#7c7876', .40);
const road = m('#353c48', .49);
const paint = m('#beaa82', .53);
const asphaltMark = m('#a39d93', .43);
const trunk = m('#5d483d', .37);
const roof = m('#41444f', .47);
const eaves = m('#373940', .40);
const stone = m('#786d64', .41);
const frame = m('#463d3c', .45);
const warm = m('#ffd69b', .94);
const cool = m('#8da3af', .62);
const door = m('#5c4a42', .49);
const trim = m('#b5a48e', .51);
const tire = m('#272a30', .45);
const glass = m('#536175', .50);
const houseColors = ['#967568','#777d76','#8c8573','#776c80','#9e8873'].map(color=>m(color,.58));
const foliage = ['#b77c43','#945c3d','#936948','#a06a50','#77734e'].map(color=>m(color,.48));

function window(mesh, x, y, z, w, h, light) {
  mesh.box(x,y,z,w+.13,h+.14,.11,frame);
  mesh.front(x,y,z+.061,w,h,light);
  mesh.front(x,y,z+.066,.055,h,trim);
  mesh.front(x,y,z+.067,w,.048,trim);
  mesh.box(x,y-h/2-.064,z+.035,w+.19,.08,.19,trim);
}

function house(mesh, x, z, yaw, style, random) {
  const width=5.3+random()*1.35, depth=4.9+random()*.72;
  const height=3.25+random()*.55+(style%3===1?.75:0);
  const siding=houseColors[style%houseColors.length];
  const half=width/2, front=depth/2, peak=height+1.55+random()*.40;
  mesh.inFrame(x,groundY,z,yaw,part => {
    part.box(0,.14,0,width+.15,.28,depth+.18,stone);
    part.box(0,height/2+.14,0,width,height-.28,depth,siding);
    const overhang=.31, left=-half-overhang, right=half+overhang;
    const near=front+overhang, far=-front-overhang;
    part.triangle([-half,height,front],[half,height,front],[0,peak,front],siding);
    part.triangle([half,height,-front],[-half,height,-front],[0,peak,-front],siding);
    part.quad([left,height,near],[0,peak,near],[0,peak,far],[left,height,far],roof);
    part.quad([0,peak,near],[right,height,near],[right,height,far],[0,peak,far],roof);
    for (const face of [near,far]) {
      part.rod([left,height,face],[0,peak,face],.077,.077,4,eaves);
      part.rod([0,peak,face],[right,height,face],.077,.077,4,eaves);
    }
    part.box(width*.23,height+.77,-depth*.23,.46,1.24,.49,stone);
    part.box(width*.23,height+1.41,-depth*.23,.59,.14,.60,eaves);

    const entry=style%2===0?0:-width*.21;
    part.box(entry,.87,front+.043,.86,1.63,.14,frame);
    part.front(entry,.87,front+.119,.69,1.44,door);
    part.front(entry,.98,front+.123,.37,.44,warm);
    part.box(entry,.135,front+.39,1.23,.25,.78,stone);
    part.box(entry,.047,front+.90,1.39,.09,.43,sidewalk);
    part.ground(entry,.008,front+1.65,.92,1.42,sidewalk);
    const windowOffsets=entry===0?[-width*.27,width*.27]:[width*.20];
    for (const [i,offset] of windowOffsets.entries()) {
      window(part,offset,1.46,front+.01,1.02,1.01,(i+style)%3===1?cool:warm);
    }
    for (const offset of [-width*.25,width*.25]) window(part,offset,height-.74,front+.013,.85,.88,warm);
    for (const side of [-1,1]) {
      part.inFrame(side*(half+.01),0,0,side*Math.PI/2,facade => {
        window(facade,-depth*.22,1.46,0,.78,.91,cool);
        window(facade,depth*.22,height-.74,0,.83,.88,warm);
      });
    }
    part.box(entry+.65,1.65,front+.10,.14,.28,.18,warm);
    part.box(entry+.65,1.82,front+.10,.22,.055,.23,eaves);
  });
}

function tree(mesh,x,z,height,style) {
  const color=foliage[style%foliage.length];
  const next=foliage[(style+1)%foliage.length];
  const crown=groundY+height*.70;
  mesh.rod([x,groundY,z],[x+.09,crown,z],.16,.09,6,trunk);
  for (const side of [-1,1]) {
    const branch=[x+side*.59,crown+.22,z+side*.31];
    mesh.rod([x,crown-.65,z],branch,.09,.035,5,trunk);
    mesh.ellipsoid(...branch,height*.285,height*.29,height*.25,8,5,color,true);
  }
  mesh.ellipsoid(x+.14,crown+.66,z-.10,height*.29,height*.28,height*.26,9,5,next,true);
}

function streetlight(mesh,x,z) {
  const y=groundY+.02;
  mesh.box(x,y+.09,z,.48,.18,.48,eaves);
  mesh.rod([x,y,z],[x,y+3.75,z],.076,.052,7,frame);
  mesh.rod([x,y+3.67,z],[x+.39,y+3.86,z],.049,.042,6,frame);
  mesh.box(x+.45,y+3.75,z,.38,.17,.34,warm);
  mesh.box(x+.45,y+3.86,z,.49,.09,.44,eaves);
  mesh.ground(x,y+.005,z,1.65,1.68,m('#a89670',.57,1,.07));
}

function car(mesh,x,z,yaw,color) {
  const body=m(color,.52,1,.32);
  mesh.inFrame(x,groundY,z,yaw,part => {
    part.block(0,.47,0,1.62,.55,3.33,.13,body);
    part.block(0,.89,-.12,1.40,.50,1.70,.19,glass);
    part.block(0,1.13,-.12,1.31,.08,1.26,.027,body);
    for (const side of [-1,1]) {
      for (const end of [-1,1]) {
        part.rod([side*.70,.32,end*1.08],[side*.86,.32,end*1.08],.27,.27,10,tire);
      }
      part.front(side*.59,.51,1.669,.23,.12,cool);
      part.inFrame(side*.59,.51,-1.669,Math.PI,tail=>tail.front(0,0,0,.22,.12,m('#bd5b50',.78)));
    }
  });
}

export function buildNeighborhood(mesh, porchFront, porchHalfWidth) {
  const random=seeded(720813);
  const streetZ=porchFront+6.10;
  const edgeX=porchHalfWidth+2.30, lotX=edgeX+10.10;
  const roadWidth=6.85;
  mesh.ground(0,groundY-.40,0,142,137,grass);
  mesh.ground(0,groundY,10,115,83,grass);
  mesh.ground(0,groundY+.022,streetZ,115,roadWidth,road);
  for (const side of [-1,1]) {
    const z=streetZ+side*(roadWidth/2+.84);
    mesh.box(0,groundY+.032,z,113,.10,1.67,sidewalk);
    mesh.box(0,groundY+.045,streetZ+side*roadWidth/2,113,.14,.16,curb);
    mesh.ground(side*(edgeX+3.8),groundY+.027,-4.6,6.65,streetZ+9.2,road);
    mesh.box(side*(edgeX+.36),groundY+.047,-4.6,1.33,.12,streetZ+9.2,sidewalk);
    mesh.box(side*(edgeX+7.22),groundY+.047,-4.6,1.33,.12,streetZ+9.2,sidewalk);
    for (const x of [edgeX+1.12,edgeX+2.13,edgeX+3.14,edgeX+4.15,edgeX+5.16,edgeX+6.17]) {
      mesh.ground(x*side,groundY+.049,streetZ-3.88,.46,2.08,asphaltMark);
    }
    for (let i=0;i<4;i++) {
      house(mesh,side*(lotX+.55*(i%2)),4-i*9.1,-side*Math.PI/2,i+side+1,random);
      tree(mesh,side*(edgeX+7.78),8.1-i*8.7,4+random()*1.5,i+side+1);
      streetlight(mesh,side*(edgeX+.63),3.8-i*8.4);
    }
  }
  for (let x=-52;x<=52;x+=3.5) mesh.ground(x,groundY+.048,streetZ,1.38,.09,paint);
  for (let i=-5;i<=5;i++) {
    const x=i*8.5;
    house(mesh,x,streetZ+9.15+random()*1.1,Math.PI,i+5,random);
    tree(mesh,x+4.05,streetZ+5.62,3.7+random()*1.8,i+5);
    if (i%2===0) streetlight(mesh,x+2.85,streetZ+4.05);
  }
  for (let i=-3;i<=3;i++) {
    house(mesh,i*11+2.5,streetZ+21.5,Math.PI,i+4,random);
    house(mesh,i*12-1.7,-32.7,0,i+6,random);
  }
  car(mesh,-6.8,streetZ+.65,Math.PI/2,'#795248');
  car(mesh,8.6,streetZ+2.05,-Math.PI/2,'#607885');
  car(mesh,-23.9,streetZ+2.05,Math.PI/2,'#967f5d');
  car(mesh,edgeX+5.05,1.4,0,'#687262');
}
