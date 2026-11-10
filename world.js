import { Mesh, clamp, material as m, mix, model, multiply, seeded } from './webgl.js';
import { GAMES, LATEST_RELEASE, RARITIES, coverUV, coversPerAtlas } from './catalog.js';
import { looks } from './menu.js?v=title-menu-2';

const M = {
  lamp: m('#fff0d8', 1.05), white: m('#ffffff', 1),
  steel: m('#454c47', 0, 1, .53), dark: m('#2b322e', 0, 1, .39), trim: m('#59615b', 0, 1, .48),
  plaster: m('#929386'), stone: m('#b7b3a3', 0, 1, .27), ceramic: m('#d4d1c2', 0, 1, .3),
  oak: m('#a7835e', 0, 1, .25), walnut: m('#76583e', 0, 1, .25), copper: m('#ad8660', 0, 1, .41),
  sage: m('#728f80', 0, 1, .26), arcade: m('#98c8b3', .34), black: m('#1b221f'), chrome: m('#9da59b', 0, 1, .72)
};
const neon = m('#ff6051', 1.35);
const aisleLight = m('#ffb078', 1.05);
const random = seeded(9541);
const pick = array => array[Math.floor(random() * array.length)];
const rectangle = (x, z, w, d, height) => [x - w / 2, x + w / 2, z - d / 2, z + d / 2, height];
const SIGN_FONT = 'Arial, "DejaVu Sans", sans-serif';
export const STORE = { entryHalf: 6.15, rearHalf: 10.49, taperStart: -4.18, taperEnd: -8.56, back: -19.65 };
export const CABINET = { x: .32, z: STORE.back + 1.33, approachZ: STORE.back + 2.43 };
export const SIGNAL_CABINET = { x: 2.10, z: STORE.back + 1.33, approachZ: STORE.back + 2.43 };
const DECK = { frontHalf: 10.55, rearHalf: STORE.rearHalf + .34, front: 9.40, back: STORE.back - .26, corner: 1.20 };
const porchCornerX = DECK.frontHalf - DECK.corner;
const porchCornerZ = DECK.front - DECK.corner;
const porchRailX = DECK.frontHalf - .43;
const porchRailFront = porchCornerZ - .07;
const PORCH_BENCHES = [[-7.12, 3.18], [7.12, 3.18], [-7.12, 6.32], [7.12, 6.32]];
const SHELVES = [
  [-5.54, -2.50, 1, 3.03], [5.53, -3.52, -1, 1.45],
  [-9.83, -10.60, 1, 3.19], [-9.83, -15.60, 1, 3.42],
  [9.83, -10.40, -1, 2.87], [9.83, -15.40, -1, 3.17],
  [-7.15, STORE.back + .49, 0, 3.21], [-3.76, STORE.back + .49, 0, 3.21]
];
const GAME_TABLES = [[-3.89, -6.97, 2.74], [-3.89, -11.10, 2.74], [-3.89, -15.23, 2.74]];
const SHELF_ROWS = 4;
const DEMO = { x: 3.98, z: -7.82, w: 2.79, d: 1.10 };
export const CHECKOUT = { x: 5.85, z: -15.19, w: 4.18, d: 1.12, approachZ: -14.08 };
const RELEASE_POSTER = { x: 5.85, y: 2.51, z: STORE.back + .29, w: 3.96, h: 2.28 };
const POSTER_PRINT = { w: 1040, h: 600 };
const POSTER_COVER = { left: 54, top: 48, w: 320, h: 504 };
const PUMPKINS = [
  [-5.02,0,1.38,.46,'#be7040'], [-5.48,0,1.68,.31,'#d8954d'],
  [-4.75,0,1.91,.25,'#d1b084'], [-3.21,.737,1.68,.24,'#c77e42'],
  [4.64,0,2.65,.42,'#bc6b3e'], [5.10,0,2.91,.28,'#d4ab72'], [3.99,.737,1.72,.25,'#c2854c']
];
const MAPLE_LEAF = [
  [0,-1],[.14,-.53],[.43,-.67],[.34,-.29],[.63,-.35],[.51,-.06],[.72,.10],
  [.30,.31],[.07,.29],[.05,.69],[-.04,.69],[-.08,.29],[-.31,.33],[-.69,.12],
  [-.49,-.07],[-.64,-.34],[-.35,-.27],[-.44,-.66],[-.15,-.53]
];

function widthAt(z, front, rear) {
  const t = clamp((z - STORE.taperStart) / (STORE.taperEnd - STORE.taperStart), 0, 1);
  return mix(front, rear, t);
}

export function storeHalfWidth(z) {
  return widthAt(z, STORE.entryHalf, STORE.rearHalf);
}

export function canWalkOnPorch(x, z, radius) {
  const side = Math.abs(x);
  return side <= porchRailX - radius - .05 && z <= DECK.front - radius - .04 &&
    side + z <= DECK.front + porchCornerX - (radius + .02) * Math.SQRT2;
}

function surface(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  return canvas;
}

function controller(ctx, x, y, w, color, filled = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 100, w / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.7;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(33,17); ctx.lineTo(67,17);
  ctx.bezierCurveTo(81,17,88,25,91,37);
  ctx.lineTo(97,55); ctx.bezierCurveTo(101,71,88,77,78,67);
  ctx.lineTo(65,54); ctx.lineTo(35,54);
  ctx.lineTo(22,67); ctx.bezierCurveTo(12,77,-1,71,3,55);
  ctx.lineTo(9,37); ctx.bezierCurveTo(12,25,19,17,33,17);
  ctx.closePath();
  if (filled) ctx.fill();
  else ctx.stroke();
  ctx.strokeStyle = ctx.fillStyle = filled ? '#2b3731' : color;
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(20,37); ctx.lineTo(37,37); ctx.moveTo(28.5,28.5); ctx.lineTo(28.5,45.5);
  ctx.stroke();
  for (const [a,b] of [[72,28],[81,37],[72,46],[63,37]]) {
    ctx.beginPath(); ctx.arc(a,b,3.05,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function storeSign() {
  return surface(1440, 220, (ctx, w, h) => {
    const face = ctx.createLinearGradient(0,0,0,h);
    face.addColorStop(0,'#301b2a'); face.addColorStop(1,'#181520');
    ctx.fillStyle = face; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = '#743843'; ctx.lineWidth = 3;
    ctx.strokeRect(17,17,w-34,h-34);
    ctx.fillStyle = '#f56c58'; ctx.fillRect(31,42,6,136);
    ctx.fillRect(w-37,42,6,136);
    ctx.save();
    ctx.shadowColor = '#ff533d'; ctx.shadowBlur = 26;
    controller(ctx,132,57,135,'#ffab8d');
    ctx.font = `900 116px ${SIGN_FONT}`;
    ctx.fillStyle = '#fff0da';
    ctx.fillText('GAME STORE',309,128,1010);
    ctx.restore();
    ctx.font = `700 31px ${SIGN_FONT}`;
    ctx.fillStyle = '#ffc6a1';
    ctx.fillText('A F T E R   H O U R S',319,178);
  });
}

function arcadeArt(marquee) {
  return surface(520, marquee ? 158 : 330, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#263833'); grad.addColorStop(1, '#192524');
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = '#91b5a4'; ctx.lineWidth = 3;
    ctx.strokeRect(11,11,w-22,h-22);
    if (marquee) {
      ctx.font = `800 66px ${SIGN_FONT}`;
      ctx.fillStyle = '#f2eee3'; ctx.fillText('NEON',41,100);
      ctx.fillStyle = '#a6cbbb'; ctx.fillText('DASH',274,100);
      return;
    }
    ctx.fillStyle = '#20332d'; ctx.fillRect(20,20,w-40,h-40);
    ctx.strokeStyle = '#4a655a'; ctx.lineWidth = 2;
    for (let i = 40; i < h; i += 25) {
      ctx.beginPath(); ctx.moveTo(20,i); ctx.lineTo(w-20,i); ctx.stroke();
    }
    for (let i = 40; i < w; i += 29) {
      ctx.beginPath(); ctx.moveTo(i,20); ctx.lineTo(i,h-20); ctx.stroke();
    }
    ctx.save(); ctx.translate(260,139); ctx.rotate(Math.PI/4);
    ctx.shadowBlur = 16; ctx.shadowColor = '#a6ceb9'; ctx.fillStyle = '#a9d8bf'; ctx.fillRect(-38,-38,76,76);
    ctx.fillStyle = '#eef6e8'; ctx.fillRect(-20,-20,40,40); ctx.restore();
    ctx.font = '700 25px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#f0f0df';
    ctx.fillText('HIT THE LIGHTS',260,244);
    ctx.font = '600 16px monospace'; ctx.fillStyle = '#b9cabe'; ctx.fillText('HIGH SCORE CHALLENGE',260,276);
  });
}

function relayArt(marquee) {
  return surface(520,marquee ? 158 : 330,(ctx,w,h) => {
    const shade=ctx.createLinearGradient(0,0,w,h);
    shade.addColorStop(0,'#443d30'); shade.addColorStop(1,'#241e20');
    ctx.fillStyle=shade; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#b29570'; ctx.lineWidth=3; ctx.strokeRect(11,11,w-22,h-22);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if (marquee) {
      ctx.font='800 56px '+SIGN_FONT;
      ctx.fillStyle='#f2ead6'; ctx.fillText('SIGNAL RELAY',w/2,h/2);
      return;
    }
    const pads=[['◆','#b8cc9f'],['●','#dec28c'],['▲','#a4c5d3'],['■','#d9a9ac']];
    pads.forEach(([shape,color],i) => {
      const x=142+i%2*124, y=39+Math.floor(i/2)*92;
      ctx.fillStyle='#332e2b'; ctx.fillRect(x,y,112,80);
      ctx.strokeStyle=color; ctx.strokeRect(x+2,y+2,108,76);
      ctx.fillStyle=color; ctx.font='700 45px '+SIGN_FONT; ctx.fillText(shape,x+56,y+40);
    });
    ctx.fillStyle='#f0e4c8'; ctx.font='700 22px monospace'; ctx.fillText('WATCH  /  REPEAT',w/2,257);
    ctx.fillStyle='#bfab8f'; ctx.font='600 15px monospace'; ctx.fillText('MEMORY CHALLENGE',w/2,287);
  });
}

function displayArt() {
  return surface(560, 320, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#6e8b91'); sky.addColorStop(.7, '#c1cec2'); sky.addColorStop(1, '#d7d1b6');
    ctx.fillStyle = sky; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#e3b98d'; ctx.beginPath(); ctx.arc(349,111,63,0,Math.PI*2); ctx.fill();
    for (const [color, points] of [
      ['#7f9a8d',[[0,231],[82,123],[138,182],[225,87],[295,180],[378,122],[490,194],[560,121]]],
      ['#56796e',[[0,264],[61,208],[137,246],[221,161],[304,254],[376,191],[456,248],[560,189]]],
      ['#385651',[[0,286],[107,260],[194,284],[268,231],[327,273],[440,249],[560,269]]]
    ]) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(...points[0]);
      points.slice(1).forEach(p => ctx.lineTo(...p)); ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.fill();
    }
    controller(ctx, 212, 52, 135, '#f1eee1', true);
  });
}

function harvestArt() {
  return surface(800,396,(ctx,w,h) => {
    const shade=ctx.createLinearGradient(0,h,w,0);
    shade.addColorStop(0,'#442c29'); shade.addColorStop(1,'#86563e');
    ctx.fillStyle=shade; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#d1a979'; ctx.lineWidth=3; ctx.strokeRect(16,16,w-32,h-32);
    ctx.fillStyle='#dfb585'; ctx.fillRect(43,63,48,5);
    ctx.font=`700 44px ${SIGN_FONT}`;
    ctx.fillText('NOVEMBER',43,135);
    ctx.fillStyle='#f8e8cd'; ctx.font=`800 101px ${SIGN_FONT}`;
    ctx.fillText('HARVEST',40,245,487);
    ctx.font=`700 26px ${SIGN_FONT}`;
    ctx.fillText('HOLIDAY AT THE GAME STORE',44,307,460);

    ctx.save(); ctx.translate(642,209); ctx.rotate(.24); ctx.scale(123,123);
    ctx.fillStyle='#e4ac72'; ctx.beginPath(); ctx.moveTo(...MAPLE_LEAF[0]);
    MAPLE_LEAF.slice(1).forEach(([x,y])=>ctx.lineTo(x,y));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#8c543d'; ctx.lineWidth=.021; ctx.beginPath();
    ctx.moveTo(0,.57); ctx.lineTo(0,-.82);
    ctx.moveTo(-.50,.04); ctx.lineTo(0,.22); ctx.lineTo(.52,.02);
    ctx.moveTo(-.32,-.47); ctx.lineTo(0,-.15); ctx.lineTo(.30,-.49); ctx.stroke();
    ctx.restore();
  });
}

function releaseArt({ headline, detail, accent }) {
  const { title, genre } = GAMES[LATEST_RELEASE];
  const words = title.toUpperCase().split(' ');
  const split = Math.ceil(words.length / 2);
  const lines = [words.slice(0,split).join(' '),words.slice(split).join(' ')].filter(Boolean);
  return surface(POSTER_PRINT.w,POSTER_PRINT.h,(ctx,w,h) => {
    const shade=ctx.createLinearGradient(0,h,w,0);
    shade.addColorStop(0,'#112235'); shade.addColorStop(1,'#294b64');
    ctx.fillStyle=shade; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#7894a6'; ctx.lineWidth=2; ctx.strokeRect(22,22,w-44,h-44);
    const cover=POSTER_COVER;
    ctx.fillStyle='#091824'; ctx.fillRect(cover.left-7,cover.top-7,cover.w+14,cover.h+14);
    ctx.fillStyle='#9bb8ca'; ctx.fillRect(408,58,3,h-116);

    const left=451, width=537;
    ctx.fillStyle='#ebd2a8'; ctx.fillRect(left,76,38,5);
    ctx.font=`700 32px ${SIGN_FONT}`;
    ctx.fillText('LATEST RELEASE',left,123,width);
    ctx.font=`800 101px ${SIGN_FONT}`;
    ctx.fillStyle='#f6efe4';
    lines.forEach((line,i)=>ctx.fillText(line,left,230+i*99,width));
    ctx.font=`700 31px ${SIGN_FONT}`;
    ctx.fillStyle='#c4d9e5'; ctx.fillText(genre.toUpperCase(),left,381,width);

    ctx.fillStyle=accent;
    ctx.fillRect(left,413,width,76);
    ctx.fillStyle='#172938'; ctx.font=`800 43px ${SIGN_FONT}`;
    ctx.fillText(headline,left+18,465,width-36);
    ctx.fillStyle='#f6efe4'; ctx.font=`700 24px ${SIGN_FONT}`;
    ctx.fillText(detail,left,542,width);
  });
}

function roomSignArt() {
  return surface(768, 300, (ctx,w) => {
    const labels = ['GAME LIBRARY','ARCADE','CHECKOUT'];
    labels.forEach((label,i) => {
      const y=i*100;
      ctx.fillStyle='#343e37'; ctx.fillRect(0,y,w,100);
      ctx.fillStyle='#a9baaa'; ctx.fillRect(26,y+31,5,38);
      ctx.font=`700 52px ${SIGN_FONT}`; ctx.textBaseline='middle';
      ctx.fillStyle='#f4f0e5'; ctx.fillText(label,66,y+51,w-165);
      ctx.fillStyle='#bfc8b6'; ctx.font='600 30px monospace'; ctx.fillText('0'+(i+1),681,y+51);
    });
  });
}

function doorMat() {
  return surface(480, 208, (ctx, w, h) => {
    ctx.fillStyle = '#30372f'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#454c40'; ctx.fillRect(10,10,w-20,h-20);
    ctx.strokeStyle = '#777e68'; ctx.lineWidth = 2; ctx.strokeRect(17,17,w-34,h-34);
    controller(ctx, 174, 12, 135, '#d8d7c5');
    ctx.font = '700 24px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#e2dfcd';
    ctx.fillText('PLAYER ONE',240,166);
  });
}

function materialTexture() {
  return surface(128, 128, (ctx, w, h) => {
    const rand = seeded(32);
    const base = ctx.createLinearGradient(0,0,w,h);
    base.addColorStop(0,'#f3f2eb'); base.addColorStop(1,'#cdd0c6');
    ctx.fillStyle = base; ctx.fillRect(0,0,w,h);
    const map = ctx.getImageData(0,0,w,h);
    for (let i = 0; i < map.data.length; i += 4) {
      const v = (rand() - .49) * 19;
      for (let k = 0; k < 3; k++) map.data[i+k] += v;
    }
    ctx.putImageData(map,0,0);
    ctx.fillStyle = '#ffffff38'; ctx.fillRect(0,0,w,2); ctx.fillRect(0,0,2,h);
    ctx.fillStyle = '#2e332b45'; ctx.fillRect(0,h-2,w,2); ctx.fillRect(w-2,0,2,h);
  });
}

function radial(color) {
  return surface(96,96,(ctx) => {
    const fill = ctx.createRadialGradient(48,48,4,48,48,46);
    fill.addColorStop(0,color); fill.addColorStop(1,'transparent');
    ctx.fillStyle = fill; ctx.fillRect(0,0,96,96);
  });
}

function clip(points, distance) {
  const result = [];
  for (let i=0; i<points.length; i++) {
    const a=points[i], b=points[(i+1)%points.length];
    const d1=distance(a), d2=distance(b);
    if (d1 >= 0) result.push(a);
    if ((d1 < 0) !== (d2 < 0)) result.push([mix(a[0],b[0],d1/(d1-d2)),mix(a[1],b[1],d1/(d1-d2))]);
  }
  return result;
}

function floorTiles(mesh) {
  const outer = ['#747686','#7a788a','#666b80','#77778a','#6c7285','#83808e','#6c7082','#7e7d8c'].map(c=>m(c,0,1,.24));
  const inner = ['#b1a18c','#a39483','#b0a391','#bdac96','#aa9b8d','#9e9284'].map(c=>m(c,0,1,.27));
  const runner = [m('#6c484d',0,1,.24),m('#795157',0,1,.24)];
  const width = .715, depth = .718, gap = .017;
  const bands = [[DECK.back+.02, STORE.taperEnd], [STORE.taperEnd, STORE.taperStart], [STORE.taperStart, DECK.front-.02]];
  const edge = z => widthAt(z, DECK.frontHalf-.02, DECK.rearHalf-.02);
  for (let zi=Math.floor((DECK.back+8.55)/depth); -8.55+zi*depth<DECK.front; zi++) {
    const tileBack = -8.55+zi*depth+gap/2, tileFront = tileBack+depth-gap;
    for (const [far,near] of bands) {
      const back = Math.max(far,tileBack), front = Math.min(near,tileFront);
      if (back >= front) continue;
      for (let xi=Math.floor((8.53-DECK.rearHalf)/width); -8.53+xi*width<DECK.rearHalf; xi++) {
        const l=-8.53+xi*width+gap/2, r=l+width-gap;
        let pts = [[l,front],[r,front],[r,back],[l,back]];
        for (const s of [-1,1]) {
          pts = clip(pts, ([x,z]) => edge(z) - s*x);
          pts = clip(pts, ([x,z]) => DECK.front + porchCornerX - s*x - z);
        }
        if (pts.length < 3) continue;
        const center = Math.abs((r+l)/2);
        const indoors = back < -.14 && center < storeHalfWidth((back+front)/2);
        const base = indoors ? pick(inner) : pick(outer);
        const mat = indoors && center < 1.12 && back > -16.75 ? runner[Math.abs(zi+xi)%2] : base;
        const uv = ([x,z])=>[(x-l)/width,(tileFront-z)/depth];
        for (let i=1; i<pts.length-1; i++) {
          const p = [pts[0],pts[i],pts[i+1]];
          mesh.triangle(...p.map(([x,z])=>[x,0,z]),mat,p.map(uv));
        }
      }
    }
  }
}

function city(mesh) {
  const rows = [[-43,1.3,.65],[-32,1,.78]];
  for (const [z, size, dim] of rows) {
    for (let x=-40; x<42;) {
      const w=1.3+random()*3.3, h=.8+random()*7.2;
      const base=pick(['#242b3e','#303548','#303344','#30374c','#39384a']);
      mesh.box(x,-2.2+h/2,z+random()*2,w,h,size*2.2,m(base,dim));
      const front=z+3.13;
      if (random() < .46) mesh.box(x+.2,-2.2+h+.22,z+.2,.06,.48,.08,m('#36374c',.64));
      for (let yy=-1.1; yy<h-2.6; yy+=.55) {
        for (let xx=x-w/2+.3; xx<x+w/2-.17; xx+=.45) {
          if (random()>.68) {
            const mat=pick([m('#79778b',.62),m('#b2967f',.65),m('#bb946f',.72)]);
            mesh.front(xx,yy,front,.095,.15,mat);
          }
        }
      }
      x+=w*.84+.55;
    }
  }
}

function beam(mesh, a, b, radius, mat) {
  mesh.rod(a,b,radius,radius,4,mat);
}

function oakSlats(mesh,x,y,z,width,height,spacing) {
  const count=Math.floor(width/spacing);
  for (let i=0;i<count;i++) {
    mesh.box(x+(i-(count-1)/2)*spacing,y,z,spacing*.68,height,.045,i%4===0 ? M.walnut : M.oak);
  }
}

function platform(mesh) {
  const { frontHalf, rearHalf, front, back } = DECK;
  const pts=[[-frontHalf,STORE.taperStart],[-frontHalf,porchCornerZ],[-porchCornerX,front],
    [porchCornerX,front],[frontHalf,porchCornerZ],[frontHalf,STORE.taperStart]];
  const grout=m('#53564f');
  mesh.polygonXZ(pts.map(([x,z])=>[x*.986,z*.989]),-.36,m('#373d38'),-.61);
  mesh.polygonXZ(pts,-.06,m('#5d6159'),-.37);
  mesh.polygonXZ(pts.map(([x,z])=>[x*.998,z*.998]),-.021,grout,-.14);
  const rear = [[-rearHalf,back],[-rearHalf,STORE.taperEnd],[-frontHalf,STORE.taperStart+.012],
    [frontHalf,STORE.taperStart+.012],[rearHalf,STORE.taperEnd],[rearHalf,back]];
  mesh.polygonXZ(rear,-.022,grout,-.38);
  for (let i=0; i<5; i++) {
    const [x,z]=pts[i], [x2,z2]=pts[i+1];
    beam(mesh,[x*.994,-.027,z*.995],[x2*.994,-.027,z2*.995],.025,M.stone);
  }
  const rails=Array.from({length:6},(_,i)=>mix(-.13,porchRailFront,i/5));
  for (const s of [-1,1]) {
    const x=s*porchRailX;
    for (const z of rails) {
      mesh.block(x,.05,z,.25,.10,.24,.022,M.steel);
      mesh.block(x,.54,z,.105,1.02,.115,.015,M.steel);
      if (z===rails[0] || z===rails.at(-1)) {
        mesh.block(x,1.055,z,.224,.102,.227,.018,M.dark);
        mesh.block(x,1.17,z,.196,.18,.197,.024,M.lamp);
        mesh.block(x,1.269,z,.236,.044,.237,.012,M.trim);
      } else {
        mesh.block(x,1.045,z,.15,.054,.16,.012,M.trim);
      }
    }
    for (let i=1; i<rails.length; i++) {
      const l=rails[i]-rails[i-1], z=(rails[i]+rails[i-1])/2;
      mesh.box(x,.93,z,.06,.058,l,M.chrome);
      mesh.box(x,.62,z,.045,.035,l,M.trim);
      mesh.box(x,.34,z,.043,.038,l,M.trim);
    }
  }
}

function storeShell(mesh, cladding, upper) {
  const { entryHalf, rearHalf, taperStart, taperEnd, back } = STORE;
  const wall = [[entryHalf,.01],[entryHalf,taperStart],[rearHalf,taperEnd],[rearHalf,back]];
  for (const s of [-1,1]) {
    for (let i=1; i<wall.length; i++) {
      const [a,z1] = wall[i-1], [b,z2] = wall[i];
      const dx = s*(a-b), dz = z1-z2;
      const length = Math.hypot(dx,dz)+.13;
      const height = i===1 ? 3.76 : 4.25;
      mesh.inFrame(s*(a+b)/2,0,(z1+z2)/2,Math.atan2(dx,dz),part=>{
        part.box(0,height/2,0,.38,height,length,i===1 ? cladding : M.plaster);
        part.box(-s*.201,.20,0,.048,.26,length,M.steel);
        if (i===1) return;
        part.box(-s*.218,3.885,0,.075,.13,length,M.walnut);
        part.box(-s*.263,3.875,0,.026,.033,length,M.oak);
        for (const z of [-length*.35,length*.35]) {
          part.block(-s*.224,2.025,z,.115,3.94,.164,.024,M.walnut);
          part.box(-s*.289,2.04,z,.025,3.58,.078,M.oak);
        }
      });
    }
  }
  mesh.box(0,2.13,back,rearHalf*2+.36,4.26,.31,M.plaster);
  const roof=[[-rearHalf-.29,back-.25],[-rearHalf-.29,taperEnd],[-entryHalf-.29,taperStart+.04],
    [entryHalf+.29,taperStart+.04],[rearHalf+.29,taperEnd],[rearHalf+.29,back-.25]];
  mesh.polygonXZ(roof,4.53,upper,4.22);
  mesh.polygonXZ([...roof].reverse(),4.218,m('#74756a'));
  mesh.box(0,3.735,taperStart/2,entryHalf*2-.12,.148,-taperStart+.10,M.trim);
}

function storefront(mesh, glass, posters) {
  const cladding = m('#565d55',0,1,.37);
  const upper = m('#363d39',0,1,.4);
  const frame = m('#222a26',0,1,.52);
  storeShell(mesh,cladding,upper);
  for (const s of [-1,1]) {
    mesh.box(s*3.9,.265,.015,4.73,.53,.47,cladding);
    mesh.box(s*3.9,.555,.095,4.73,.106,.46,frame);
    mesh.box(s*3.9,.071,.238,4.75,.127,.095,M.trim);
    for (const y of [.17,.36]) mesh.box(s*3.94,y,.256,4.65,.023,.024,M.steel);
    mesh.block(s*6.05,1.97,.095,.78,3.99,.81,.1,M.dark);
    mesh.block(s*6.05,2.04,.503,.56,3.61,.05,.023,M.walnut);
    oakSlats(mesh,s*6.05,2.04,.541,.53,3.37,.086);
    mesh.block(s*6.05,.22,.16,.86,.42,.89,.055,M.steel);
    mesh.box(s*1.63,1.92,.17,.132,3.84,.29,frame);
    mesh.box(s*5.66,2.04,.19,.102,2.92,.20,frame);
    mesh.box(s*3.65,3.524,.133,4.10,.115,.245,frame);
    mesh.box(s*3.65,.68,.136,4.16,.094,.25,frame);
    mesh.box(s*3.65,3.638,.244,3.84,.026,.046,M.lamp);
    mesh.box(s*3.65,3.70,.179,4.11,.21,.27,frame);
    glass.front(s*3.66,2.105,.165,3.96,2.82,m('#839994',.67,.09,.69));
    const l=s*3.66-1.93, r=s*3.66+1.93;
    glass.quad([l+.05,3.47,.172],[l+.48,3.47,.172],[r-.02,.71,.172],[r-.35,.71,.172],m('#d2d9cc',1,.052));
    glass.quad([l+.44,3.47,.173],[l+.61,3.47,.173],[r-.24,.71,.173],[r-.39,.71,.173],m('#d6dfd8',1,.045));
    mesh.box(s*4.24,3.707,.58,.55,.087,.39,M.lamp);
    mesh.box(s*4.24,3.772,.58,.68,.085,.45,M.steel);
  }
  mesh.box(0,3.50,.13,3.26,.119,.30,frame);
  mesh.box(0,3.10,.14,3.26,.10,.28,frame);
  mesh.box(0,.035,.19,3.24,.064,.30,M.chrome);
  glass.front(0,3.303,.166,3.10,.31,m('#8f9f94',.72,.14,.65));
  mesh.box(0,3.775,.395,.52,.08,.39,M.lamp);
  mesh.box(0,3.838,.395,.71,.081,.44,M.dark);
  const roof=[[-6.86,STORE.taperStart-.23],[-7.03,.48],[-6.52,.97],[6.52,.97],[7.03,.48],[6.86,STORE.taperStart-.23]];
  mesh.polygonXZ(roof,4.48,upper,3.81);
  mesh.polygonXZ(roof.map(([x,z])=>[x*1.012,z]),3.935,M.dark,3.79);
  mesh.polygonXZ(roof.map(([x,z])=>[x*.984,z*.83]),4.66,cladding,4.46);
  mesh.block(0,4.718,-3.16,10.13,.24,6.33,.09,upper);
  mesh.block(0,4.846,-3.23,7.52,.205,4.88,.08,M.dark);
  for (let i=1; i<4; i++) {
    const [x,z]=roof[i], [x2,z2]=roof[i+1];
    beam(mesh,[x,4.366,z+.026],[x2,4.366,z2+.026],.031,neon);
    beam(mesh,[x,4.111,z+.026],[x2,4.111,z2+.026],.018,aisleLight);
  }
  mesh.block(0,4.94,.79,9.35,1.27,.61,.07,M.dark);
  posters.front(0,4.94,1.101,9.18,1.12,M.white);
  for (const y of [4.34,5.54]) mesh.box(0,y,1.111,9.22,.027,.027,neon);
}

function door(s) {
  const mesh=new Mesh(), glass=new Mesh();
  const width=1.55, h=3.07, x=s*.793;
  const frame=m('#272f2b',0,1,.61);
  for (const xx of [x-width/2+.047,x+width/2-.047]) {
    mesh.box(xx,1.54,.153,.089,h,.137,frame);
    mesh.box(xx,1.54,.228,.024,h,.021,M.trim);
  }
  for (const y of [.081,3.037]) mesh.box(x,y,.154,width,.12,.137,frame);
  mesh.box(x,.148,.229,width-.12,.018,.025,M.chrome);
  mesh.block(s*.245,1.43,.296,.079,.68,.117,.019,M.chrome);
  mesh.box(s*.245,1.43,.362,.03,.54,.018,m('#c4c7ba',0,1,.75));
  glass.front(x,1.559,.191,width-.125,h-.187,m('#8e9d97',.72,.10,.67));
  glass.quad([x-.66,2.77,.196],[x-.58,2.85,.196],[x+.67,1.66,.196],[x+.67,1.51,.196],m('#d9dfd4',1,.06));
  return [mesh,glass];
}

function planter(mesh, x, z, seed) {
  const rand=seeded(seed);
  mesh.block(x,.075,z,1.54,.15,1.32,.05,M.steel);
  mesh.block(x,.143,z,1.56,.058,1.34,.023,M.trim);
  mesh.layers([[x,.164,z,1.45,1.24,.048],[x,.656,z,1.57,1.34,.064],[x,.705,z,1.52,1.29,.054]],M.stone);
  mesh.block(x,.689,z,1.60,.089,1.37,.035,M.ceramic);
  mesh.ground(x,.737,z,1.41,1.18,m('#514337'));
  const foliage=['#935b3f','#a97b48','#b58c56','#596649','#9c784a','#ca9c5e'];
  for (let i=0; i<16; i++) {
    const t=i*2.399, dir=[Math.cos(t),Math.sin(t)];
    const r=.36+rand()*.70, tall=.25+rand()*.83, spread=.09+rand()*.16;
    const root=[x+dir[0]*.09,.741,z+dir[1]*.09];
    const ridge=[x+dir[0]*r*.58,.74+tall*.77,z+dir[1]*r*.58];
    const tip=[x+dir[0]*r,.73+tall,z+dir[1]*r];
    const sideA=[ridge[0]-dir[1]*spread,ridge[1]-.10,ridge[2]+dir[0]*spread];
    const sideB=[ridge[0]+dir[1]*spread,ridge[1]-.13,ridge[2]-dir[0]*spread];
    mesh.triangle(root,ridge,sideA,m(foliage[i%foliage.length]));
    mesh.triangle(sideA,ridge,tip,m(foliage[(i+2)%foliage.length]));
    mesh.triangle(root,sideB,ridge,m(foliage[(i+4)%foliage.length]));
    mesh.triangle(ridge,sideB,tip,m(foliage[(i+5)%foliage.length]));
  }
}

function pumpkin(mesh,x,y,z,r,color) {
  const skin=m(color,.12,1,.23), stem=m('#615039',.10);
  const rings=[[0,.40],[.13,.76],[.38,1],[.68,.98],[.88,.69],[.97,.33]];
  const sides=30;
  const point=(i,[height,width]) => {
    const angle=i*Math.PI*2/sides;
    const rim=r*width*(.91+.09*Math.cos(angle*10));
    return [x+Math.cos(angle)*rim,y+height*r*1.40,z+Math.sin(angle)*rim];
  };
  const crown=[x,y+1.28*r,z];
  for (let i=0;i<sides;i++) {
    for (let j=1;j<rings.length;j++) {
      mesh.quad(point(i,rings[j-1]),point(i,rings[j]),point(i+1,rings[j]),point(i+1,rings[j-1]),skin);
    }
    mesh.triangle(crown,point(i+1,rings.at(-1)),point(i,rings.at(-1)),skin);
  }
  mesh.rod(crown,[x-r*.16,y+r*1.70,z+r*.075],r*.15,r*.10,5,stem);
}

function harvestPorch(mesh) {
  const cord=m('#594835',.16), socket=m('#674e36',.12);
  const bulbs=[m('#ffcf88',1.07),m('#ffe4b3',1.06)];
  const leaves=['#756847','#8b7046','#b27d48','#bb8154'].map(color=>m(color,.12));
  const berry=m('#bd704b',.23), ribbon=m('#bc925d',.24);
  for (const side of [-1,1]) {
    const lightPoint=t=>[side*(1.76+t*3.82),3.66-.21*Math.sin(t*Math.PI),.76];
    for (let i=0;i<16;i++) {
      const point=lightPoint(i/15);
      if (i) beam(mesh,lightPoint((i-1)/15),point,.011,cord);
      const [x,y,z]=point;
      mesh.box(x,y-.026,z,.046,.058,.049,socket);
      mesh.ellipsoid(x,y-.076,z,.046,.061,.046,8,4,bulbs[i%2],true);
    }
    const x=side*6.05,y=2.56,z=.645;
    for (let i=0;i<20;i++) {
      const a=i*Math.PI/10, cos=Math.cos(a), sin=Math.sin(a);
      mesh.ellipsoid(x+cos*.34,y+sin*.34,z,.119,.099,.072,7,4,leaves[i%4],true);
      if (i%4===0) mesh.ellipsoid(x+cos*.37,y+sin*.37,z+.065,.042,.041,.041,6,4,berry,true);
    }
    const knot=[x,y-.30,z+.09];
    mesh.triangle(knot,[x-.23,y-.21,z+.074],[x-.19,y-.40,z+.10],ribbon);
    mesh.triangle(knot,[x+.19,y-.40,z+.10],[x+.23,y-.21,z+.074],ribbon);
    mesh.block(x,y-.30,z+.09,.09,.085,.046,.014,ribbon);
  }
  PUMPKINS.forEach(props=>pumpkin(mesh,...props));

  const rand=seeded(28641);
  const fallen=['#ad673e','#ca8b49','#a77148','#c59859','#855345'].map(color=>m(color,.15));
  const patches=[[-6.64,2.59,1.55,1.72,22],[6.86,2.64,1.48,1.65,22],[-4.02,5.94,2.15,1.06,25],
    [4.28,5.68,2.21,1.33,25],[0,3.80,2.90,1.62,16]];
  for (const [cx,cz,spreadX,spreadZ,count] of patches) {
    for (let i=0;i<count;i++) {
      const x=cx+(rand()+rand()-1)*spreadX, z=cz+(rand()+rand()-1)*spreadZ;
      const angle=rand()*Math.PI*2, size=.08+rand()*.115;
      const cos=Math.cos(angle)*size, sin=Math.sin(angle)*size;
      const points=MAPLE_LEAF.map(([a,b])=>[x+a*cos-b*sin,.008,z+a*sin+b*cos]);
      const ink=fallen[Math.floor(rand()*fallen.length)];
      points.forEach((point,i)=>mesh.triangle([x,.023,z],points[(i+1)%points.length],point,ink));
    }
  }
}

function bench(mesh, x, z) {
  const wood=M.oak, end=m('#be996e',0,1,.25);
  for (const s of [-1,1]) {
    const xx=x+s*1.13;
    mesh.block(xx,.26,z+.26,.13,.52,.16,.015,M.dark);
    mesh.rod([xx,.036,z-.32],[xx,1.04,z-.43],.072,.058,4,M.steel);
    mesh.box(xx,.502,z,.149,.16,.746,M.dark);
  }
  for (let i=0; i<5; i++) {
    const zz=z-.27+i*.134;
    mesh.block(x,.557,zz,2.49,.074,.121,.014,i%2 ? end : wood);
  }
  for (let i=0; i<3; i++) {
    const y=.73+i*.13;
    mesh.block(x,y,z-.375-i*.025,2.49,.11,.074,.014,i===1 ? end : wood);
    for (const s of [-1,1]) mesh.front(x+s*1.09,y,z-.33-i*.025,.04,.042,M.chrome);
  }
}

const caseInk = m('#f8f6ef', .67);
const casePrint = GAMES.map((_,i) => ['front','back','spine'].map(face => coverUV(i,face)));
const rarityEntries = Object.entries(RARITIES);
const rarityPrint = Object.fromEntries(rarityEntries.map(([tier],row) => {
  const top=1-(row+.025)/rarityEntries.length, bottom=1-(row+.975)/rarityEntries.length;
  return [tier,[[.01,bottom],[.99,bottom],[.99,top],[.01,top]]];
}));

function rarityArt() {
  const height=48;
  return surface(128,height*rarityEntries.length,(ctx,w) => {
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=`800 31px ${SIGN_FONT}`;
    for (const [row,[,tier]] of rarityEntries.entries()) {
      const y=row*height;
      ctx.fillStyle='#26322b'; ctx.fillRect(0,y,w,height);
      ctx.fillStyle=tier.color; ctx.fillRect(3,y+3,w-6,height-6);
      ctx.fillStyle='#26322b'; ctx.fillText(tier.mark,w/2,y+height/2+1);
    }
  });
}

function planStock() {
  const order=GAMES.map((_,i)=>i), shuffle=seeded(6211);
  for (let i=order.length-1;i>1;i--) {
    const other=1+Math.floor(shuffle()*i);
    [order[i],order[other]]=[order[other],order[i]];
  }
  const sideRacks=SHELVES.slice(0,-2);
  const capacities=[
    ...sideRacks.map(([, , , w])=>Math.floor((w-.10)/.55)*SHELF_ROWS),
    ...GAME_TABLES.map(([, , w])=>Math.floor((w-.15)/.55)*2)
  ];
  const extras=GAMES.map((game,i)=>i === LATEST_RELEASE ? 0 : RARITIES[game.rarity].copies-1);
  const displays=new Array(capacities.length);
  const byCapacity=capacities.map((size,index)=>({size,index})).sort((a,b)=>b.size-a.size);
  for (const {size,index} of byCapacity) {
    const titles=order.filter(game=>extras[game]>0).sort((a,b)=>extras[b]-extras[a]).slice(0,size);
    for (const game of titles) extras[game]--;
    const offset=index*5%Math.max(1,titles.length);
    displays[index]=titles.slice(offset).concat(titles.slice(0,offset));
  }
  const middle=order.length/2;
  const shelves=[...displays.slice(0,sideRacks.length),order.slice(0,middle),order.slice(middle)];
  const tables=displays.slice(sideRacks.length);
  const copies=new Uint8Array(GAMES.length);
  for (const display of [...shelves,...tables]) for (const game of display) copies[game]++;
  return {shelves,tables,copies};
}

function gameCase(geo, cases, x, y, z, yaw, w, h, d, index) {
  const cover=cases.covers[Math.floor(index/coversPerAtlas)], tags=cases.tags;
  geo.caseSlot = cover.caseSlot = tags.caseSlot = cases.titles.length;
  cases.titles.push(index);
  geo.inFrame(x,y,z,yaw,part => part.block(0,0,0,w,h,d,.009,M.black));
  const [front,back,spine] = casePrint[index];
  const width = w - .018, height = h - .020;
  cover.inFrame(x,y,z,yaw,art => {
    art.front(0,0,d/2+.002,width,height,caseInk,front);
    art.inFrame(0,0,0,Math.PI,part => part.front(0,0,d/2+.002,width,height,caseInk,back));
    for (const turn of [-Math.PI/2, Math.PI/2]) {
      art.inFrame(0,0,0,turn,part => part.front(0,0,w/2+.002,d-.018,height,caseInk,spine));
    }
  });
  const badgeWidth=.110, badgeHeight=.041, badgeZ=d/2+.004;
  const badgeX=(width-badgeWidth)/2-.008, badgeY=(height-badgeHeight)/2-.008;
  const print=rarityPrint[GAMES[index].rarity];
  tags.inFrame(x,y,z,yaw,tag => {
    tag.front(badgeX,badgeY,badgeZ,badgeWidth,badgeHeight,M.white,print);
    tag.inFrame(0,0,0,Math.PI,part => part.front(badgeX,badgeY,badgeZ,badgeWidth,badgeHeight,M.white,print));
  });
  geo.caseSlot = cover.caseSlot = tags.caseSlot = 0;
}

function shelf(geo, cases, x, z, yaw, w, stock) {
  geo.inFrame(x,0,z,yaw, mesh=>{
    mesh.box(0,1.40,-.165,w,2.78,.119,M.walnut);
    for (const sign of [-1,1]) mesh.box(sign*(w/2-.045),1.39,.08,.084,2.76,.56,M.steel);
    mesh.box(0,.155,.067,w,.29,.58,M.dark);
    for (let i=0; i<=SHELF_ROWS; i++) {
      const y=.39+i*(2.37/SHELF_ROWS);
      mesh.block(0,y,.067,w,.075,.565,.019,M.oak);
      if (i===SHELF_ROWS || i===0) mesh.front(0,y,.356,w-.11,.018,M.copper);
    }
  });
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const count = Math.ceil(stock.length/SHELF_ROWS);
  for (let row=0; row<SHELF_ROWS; row++) {
    const y=.39+row*(2.37/SHELF_ROWS)+.246;
    for (let i=0; i<count; i++) {
      const index=stock[row*count+i];
      if (index===undefined) continue;
      const xx=(i-(count-1)/2)*.455+(random()-.5)*.027;
      const zz=.14+random()*.06;
      gameCase(geo,cases,x+c*xx+s*zz,y,z-s*xx+c*zz,yaw,.275,.42,.082,index);
    }
  }
}

function headset(mesh,x,y,z,color) {
  for (let i=0; i<14; i++) {
    const a=Math.PI*i/14,b=Math.PI*(i+1)/14;
    const p=t=>[x+.156*Math.cos(t),y+.064+.228*Math.sin(t),z];
    mesh.rod(p(a),p(b),.028,.028,5,color);
  }
  for (const s of [-1,1]) {
    mesh.ellipsoid(x+s*.146,y+.035,z,.052,.112,.080,9,6,M.black);
    mesh.ellipsoid(x+s*.173,y+.035,z,.025,.089,.065,9,6,color);
  }
  mesh.box(x,y-.145,z-.025,.055,.23,.062,M.dark);
  mesh.block(x,y-.257,z,.37,.049,.26,.021,M.black);
}

function gameTable(geo,cases,x,z,w,stock) {
  geo.block(x,.092,z,w-.15,.18,1.03,.04,M.dark);
  geo.block(x,.463,z,w,.69,1.04,.06,M.oak);
  geo.block(x,.821,z,w+.06,.115,1.13,.047,M.stone);
  geo.box(x,.729,z,w-.16,.035,1.06,M.walnut);
  geo.block(x,.97,z,w-.15,.195,.16,.037,M.steel);
  const middle=Math.ceil(stock.length/2);
  for (const [side,titles] of [[1,stock.slice(0,middle)],[-1,stock.slice(middle)]]) {
    const yaw=side>0 ? 0 : Math.PI;
    titles.forEach((index,i) => {
      const xx=(i-(titles.length-1)/2)*.49;
      gameCase(geo,cases,x+side*xx,1.061,z+side*.224,yaw,.261,.363,.084,index);
    });
  }
}

function roomSign(geo,labels,index,x,y,z,w) {
  geo.block(x,y,z-.06,w,.435,.118,.027,M.dark);
  const top=1-(index+.012)/3, bottom=1-(index+.988)/3;
  labels.front(x,y,z+.002,w-.05,.38,M.white,[[0,bottom],[1,bottom],[1,top],[0,top]]);
}

function interior(geo, cases, display, harvest, logos, labels, stock) {
  for (const z of [-1.6,-3.65,-5.55,-7.75,-10.05,-12.72,-15.17,-18.00]) {
    const y=z < STORE.taperStart ? 4.12 : 3.56;
    const span=storeHalfWidth(z)-.25;
    geo.box(0,y+.085,z,span*2,.115,.074,M.trim);
    if (z < STORE.taperStart) {
      for (const x of [-1.18,1.18]) geo.box(x,y-.055,z,.045,.032,1.80,aisleLight);
    }
    const fixtures=z<STORE.taperStart ? [-.76,-.4,0,.4,.76] : [-.56,0,.56];
    for (const offset of fixtures) {
      const x=offset*span;
      geo.box(x,y,z,.86,.084,.30,M.dark);
      geo.box(x,y-.05,z,.72,.035,.182,M.lamp);
    }
  }
  for (const s of [-1,1]) {
    geo.box(s*5.78,3.38,STORE.taperStart/2,.102,.064,-STORE.taperStart-.27,M.oak);
    geo.box(s*5.78,3.46,STORE.taperStart/2,.16,.080,-STORE.taperStart-.27,M.walnut);
    geo.block(s*5.89,1.55,-2.04,.115,3.10,.133,.018,M.walnut);
    geo.box(s*5.817,1.59,-2.04,.030,2.86,.077,M.oak);
  }
  SHELVES.forEach(([x,z,turn,w],i)=>shelf(geo,cases,x,z,turn*Math.PI/2,w,stock.shelves[i]));
  GAME_TABLES.forEach(([x,z,w],i)=>gameTable(geo,cases,x,z,w,stock.tables[i]));

  const back = STORE.back+.155;
  const arcadeCenter=(CABINET.x+SIGNAL_CABINET.x)/2;
  geo.block(arcadeCenter,1.93,back+.045,5.86,3.57,.088,.044,M.sage);
  for (const s of [-1,1]) {
    const x=arcadeCenter+s*2.84;
    oakSlats(geo,x-s*.28,1.91,back+.107,.67,3.49,.11);
  }
  geo.box(arcadeCenter,3.69,back+.091,5.68,.037,.045,M.walnut);
  roomSign(geo,labels,0,-5.45,3.39,back+.135,3.40);
  roomSign(geo,labels,1,arcadeCenter,3.40,back+.135,2.69);
  const poster=RELEASE_POSTER;
  geo.block(poster.x,poster.y,poster.z-.068,poster.w+.13,poster.h+.13,.13,.03,M.steel);
  roomSign(geo,labels,2,poster.x,3.94,back+.105,2.56);

  const { x:dx,z:dz,w:dw,d:dd }=DEMO;
  geo.block(dx,.49,dz,dw,.94,dd,.059,M.oak);
  geo.block(dx,.977,dz,dw+.08,.117,dd+.08,.041,M.stone);
  geo.box(dx,.87,dz+dd/2+.017,dw-.12,.034,.031,M.walnut);
  geo.box(dx,.87,dz-dd/2-.017,dw-.12,.034,.031,M.walnut);
  for (const offset of [-.72,.65]) {
    geo.box(dx+offset,1.068,dz-.09,.35,.069,.31,M.steel);
    geo.box(dx+offset,1.219,dz-.13,.07,.259,.072,M.dark);
    geo.block(dx+offset,1.497,dz-.16,1.03,.596,.113,.037,M.black);
    display.front(dx+offset,1.497,dz-.101,.956,.522,m('#ececdf',.83));
    geo.block(dx+offset,1.062,dz+.26,.56,.050,.184,.014,M.dark);
    for (let i=0;i<8;i++) geo.box(dx+offset-.216+i*.061,1.092,dz+.26,.036,.019,.057,i%3 ? M.trim : M.ceramic);
  }

  const { x,z,w,d }=CHECKOUT, edge=z+d/2;
  geo.block(x,.566,z,w,1.12,d,.064,M.walnut);
  geo.block(x,1.126,z,w+.11,.12,d+.10,.048,M.ceramic);
  oakSlats(geo,x,.578,edge+.012,w-.15,.87,.13);
  geo.box(x,.14,edge+.018,w-.24,.16,.041,M.dark);
  geo.box(x,.99,edge+.022,w-.18,.055,.046,neon);
  geo.box(x-.57,1.25,z-.10,.42,.042,.30,M.black);
  geo.box(x-.57,1.40,z-.13,.08,.29,.078,M.steel);
  geo.block(x-.57,1.62,z-.18,.63,.43,.094,.026,M.dark);
  geo.front(x-.57,1.62,z-.131,.55,.36,m('#607c72',.74));
  geo.block(x+.73,1.223,z+.13,.43,.14,.31,.035,M.stone);
  geo.front(x+.73,1.23,z+.289,.14,.037,M.sage);
  geo.block(-3.92,.51,-1.22,2.85,1.02,.83,.043,M.oak);
  geo.block(-3.92,1.00,-1.22,2.99,.109,.94,.045,M.ceramic);
  geo.box(-3.92,.952,-.739,2.74,.032,.031,M.walnut);
  for (const [x,color] of [[-4.69,M.sage],[-3.89,m('#b18465')]]) {
    geo.block(x,1.353,-1.21,.64,.62,.29,.043,color);
    logos.front(x,1.373,-1.061,.45,.33,m('#eee8d9',.66));
    geo.box(x,1.099,-1.057,.50,.022,.011,M.ceramic);
  }
  headset(geo,-3.14,1.274,-1.17,M.steel);
  headset(geo,-2.72,1.274,-1.17,M.ceramic);
  geo.block(4.46,.62,-1.31,2.07,1.24,.67,.059,M.oak);
  geo.block(4.46,1.25,-1.31,2.17,.085,.74,.025,M.stone);
  geo.box(4.46,1.195,-.94,2.04,.03,.03,M.walnut);
  for (let i=0; i<5; i++) {
    const x=3.68+i*.388;
    geo.block(x,1.464,-1.25,.30,.343,.26,.030,i%2 ? M.steel : M.sage);
    geo.ellipsoid(x,1.48,-1.112,.070,.076,.015,10,5,M.black);
    geo.front(x,1.36,-1.107,.13,.018,M.ceramic);
  }
  geo.box(4.45,1.91,-1.42,2.31,.082,.43,M.oak);
  geo.box(4.45,1.875,-1.20,2.14,.032,.038,M.walnut);
  geo.box(4.78,2.00,-1.43,.67,.14,.31,M.dark);
  for (let row=0; row<3; row++) for(let i=0; i<10; i++) {
    geo.box(4.49+i*.063,2.077,-1.35-row*.075,.043,.016,.043,[M.steel,M.sage,M.ceramic][row]);
  }
  geo.block(4.46,2.66,-1.48,2.04,1.08,.125,.043,M.black);
  harvest.front(4.46,2.66,-1.415,1.91,.942,M.white);
  geo.front(4.46,2.184,-1.409,.104,.021,M.sage);
}

function arcade(geo, marquee, screen, x, z, relay = false) {
  const body=m(relay ? '#4b4036' : '#333f37'), inset=m(relay ? '#302726' : '#222c27');
  const accent=relay ? M.copper : M.arcade;
  const p=[[.04,-.39],[.04,.36],[1.04,.47],[1.27,.53],[1.40,.25],[1.96,.15],[2.12,.26],[2.48,.25],[2.50,-.29],[2.39,-.40]];
  const l=x-.61,r=x+.61;
  for (let i=0; i<p.length; i++) {
    const [y,d]=p[i], [y2,d2]=p[(i+1)%p.length];
    geo.quad([l,y,z+d],[r,y,z+d],[r,y2,z+d2],[l,y2,z+d2],body);
    for (const s of [-1,1]) {
      const xx=x+s*.614;
      beam(geo,[xx,y,z+d],[xx,y2,z+d2],.017,y>1.37 && y2>1.37 ? accent : M.trim);
    }
  }
  for (const s of [-1,1]) {
    const xx=x+s*.61;
    const pts=p.map(([y,d])=>[xx,y,z+d]);
    for(let i=1;i<pts.length-1;i++) {
      const a=pts[0],b=pts[i],c=pts[i+1];
      if(s>0) geo.triangle(a,b,c,body);
      else geo.triangle(a,c,b,body);
    }
  }
  geo.block(x,2.298,z+.242,1.13,.365,.091,.027,M.black);
  marquee.front(x,2.30,z+.291,1.08,.324,M.white);
  geo.block(x,1.682,z+.188,1.102,.705,.083,.022,M.black);
  screen.front(x,1.68,z+.233,1.002,.624,M.white);
  geo.block(x,1.165,z+.335,1.14,.128,.48,.037,inset);
  geo.front(x,1.152,z+.581,1.04,.025,M.copper);
  geo.rod([x-.27,1.228,z+.387],[x-.27,1.37,z+.387],.036,.029,8,M.chrome);
  geo.ellipsoid(x-.27,1.396,z+.387,.076,.068,.076,10,6,M.copper);
  for(const [xx,d,color] of [[.11,.42,accent],[.29,.36,M.ceramic],[.38,.46,M.copper]]) {
    geo.rod([x+xx,1.217,z+d],[x+xx,1.266,z+d],.049,.047,9,color);
  }
  geo.block(x,.591,z+.400,.94,.662,.085,.038,inset);
  geo.front(x,.72,z+.446,.58,.032,M.sage);
  geo.front(x,.617,z+.447,.35,.022,M.copper);
  geo.box(x,.21,z+.402,.96,.062,.051,M.trim);
  geo.box(x,.057,z,1.25,.091,.86,M.dark);
}

function avatar(renderer, palette) {
  const torso=new Mesh(), leftLeg=new Mesh(), rightLeg=new Mesh(), leftArm=new Mesh(), rightArm=new Mesh();
  const coat=m(palette.coat), hood=m(palette.hood), denim=m('#2f3737'), seam=m('#4b5451');
  const accent=m(palette.accent), lining=m('#aab4a3'), skin=m(palette.skin), lightSkin=m(palette.lightSkin);
  const hair=m(palette.hair), auburn=m(palette.hairLight,0,1,.08), copper=m(palette.hairLight), sole=m('#dfdacb');
  torso.layers([
    [0,.80,0,.43,.33,.065],[0,.87,0,.50,.38,.07],[0,1.15,0,.54,.406,.085],
    [0,1.42,-.005,.57,.39,.094],[0,1.54,-.025,.44,.34,.073],[0,1.57,-.03,.31,.29,.063]
  ],coat);
  torso.block(0,.819,0,.482,.079,.36,.026,lining);
  torso.block(0,.757,0,.46,.083,.343,.027,denim);
  torso.block(0,1.585,-.029,.22,.22,.217,.041,skin);
  torso.layers([
    [0,1.403,.174,.18,.16,.048],[0,1.48,.145,.33,.23,.062],[0,1.56,.091,.489,.29,.074],
    [0,1.633,.07,.42,.24,.061]
  ],hood);
  torso.quad([-.229,1.58,.229],[-.101,1.477,.257],[.101,1.477,.257],[.229,1.58,.229],lining);
  torso.triangle([-.18,1.58,.232],[0,1.495,.259],[.18,1.58,.232],m('#778d80'));
  torso.front(-.219,1.011,.184,.036,.232,hood);
  torso.front(.219,1.011,.184,.036,.232,hood);
  torso.ellipsoid(0,1.79,-.026,.244,.262,.224,10,7,skin,true);
  torso.ellipsoid(0,1.928,.011,.265,.207,.238,10,6,hair,true);
  torso.ellipsoid(0,1.811,.121,.235,.210,.149,9,6,hair,true);
  const spikes=[
    [[-.23,1.90,.035],[-.302,2.057,.062],[-.13,2.032,.177],[-.113,1.935,.225]],
    [[-.19,2.011,.001],[-.131,2.202,.029],[.036,2.057,.176],[.042,1.979,.226]],
    [[-.056,2.026,-.06],[.063,2.224,-.05],[.188,2.073,.098],[.156,1.972,.209]],
    [[.065,2.04,-.06],[.276,2.116,-.006],[.247,2.001,.14],[.142,1.949,.228]],
    [[.12,1.951,.03],[.30,2.019,.02],[.244,1.882,.179],[.108,1.868,.239]],
    [[-.23,1.929,-.085],[-.312,1.965,-.166],[-.175,2.045,-.188],[-.115,1.99,-.241]]
  ];
  for (const [a,b,c,d] of spikes) {
    torso.triangle(a,b,c,auburn);
    torso.triangle(b,d,c,copper);
    torso.triangle(a,d,b,hair);
  }
  for (const s of [-1,1]) {
    torso.ellipsoid(s*.235,1.766,-.016,.057,.085,.061,7,5,lightSkin);
    torso.ellipsoid(s*.083,1.816,-.224,.043,.023,.023,8,4,sole);
    torso.ellipsoid(s*.079,1.814,-.244,.018,.019,.013,8,5,M.dark);
    torso.rod([s*.046,1.853,-.238],[s*.123,1.865,-.215],.011,.012,5,auburn);
  }
  torso.ellipsoid(0,1.772,-.237,.040,.040,.044,7,4,lightSkin);
  torso.box(0,1.699,-.226,.070,.015,.014,m('#744842'));
  for (const [s,leg,arm] of [[-1,leftLeg,leftArm],[1,rightLeg,rightArm]]) {
    leg.layers([
      [0,-.58,.012,.173,.205,.043],[0,-.54,.005,.218,.227,.048],[0,-.26,.010,.255,.253,.051],
      [s*.016,-.04,0,.254,.255,.049],[0,.033,0,.231,.235,.041]
    ],denim);
    leg.block(s*.091,-.275,.022,.122,.259,.207,.028,seam);
    leg.block(0,-.562,0,.209,.097,.214,.023,M.black);
    leg.block(0,-.624,-.023,.198,.101,.232,.029,lining);
    leg.block(0,-.717,-.086,.250,.153,.398,.057,coat);
    leg.block(0,-.772,-.087,.263,.054,.410,.028,sole);
    leg.block(0,-.711,-.232,.213,.086,.097,.027,m('#647b6e'));
    leg.box(0,-.699,.109,.191,.044,.023,accent);
    leg.box(0,-.663,-.142,.185,.038,.093,M.stone);
    arm.layers([
      [s*.048,-.447,.003,.124,.137,.031],[s*.051,-.39,0,.16,.166,.045],
      [s*.031,-.192,.007,.195,.207,.053],[0,-.011,0,.206,.211,.046],[0,.052,0,.144,.159,.035]
    ],coat);
    arm.block(s*.049,-.382,.004,.164,.061,.171,.022,accent);
    arm.block(s*.049,-.431,.003,.133,.055,.151,.016,hood);
    arm.ellipsoid(s*.048,-.500,-.001,.064,.091,.054,8,5,skin);
    arm.ellipsoid(s*.005,-.477,-.031,.033,.049,.029,7,5,lightSkin);
  }
  const back=new Mesh(renderer.texture(surface(160,110,(ctx)=>controller(ctx,20,-1,120,'#b4c9bb',true))));
  back.front(0,1.195,.209,.328,.239,m('#dce0d4',.35));
  return Object.fromEntries(Object.entries({torso,back,leftLeg,rightLeg,leftArm,rightArm}).map(([k,mesh])=>[k,renderer.upload(mesh)]));
}

export function createWorld(renderer, coverAtlases) {
  const mesh=new Mesh(), glass=new Mesh(), distant=new Mesh();
  const tile=new Mesh(renderer.texture(materialTexture()));
  const sign=new Mesh(renderer.texture(storeSign()));
  const cases=coverAtlases.map(atlas => new Mesh(renderer.texture(atlas)));
  const rarityTags=new Mesh(renderer.texture(rarityArt())), stock=planStock();
  const caseGames=[-1];
  const display=new Mesh(renderer.texture(displayArt()));
  const harvest=new Mesh(renderer.texture(harvestArt()));
  const poster=RELEASE_POSTER;
  const releasePrints={
    available: { headline:'WHILE SUPPLIES LAST', detail:'1 COPY LEFT   /   TAP THE COVER', accent:'#ebd2a8' },
    basket: { headline:'IN YOUR BASKET', detail:'PAY AT CHECKOUT', accent:'#bcd1c2' },
    sold: { headline:'SOLD OUT', detail:'IN YOUR COLLECTION', accent:'#c4d1d5' }
  };
  const releasePosters=Object.fromEntries(Object.entries(releasePrints).map(([state,info]) => {
    const print=new Mesh(renderer.texture(releaseArt(info)));
    print.front(poster.x,poster.y,poster.z,poster.w,poster.h,M.white);
    return [state,renderer.upload(print)];
  }));
  const labels=new Mesh(renderer.texture(roomSignArt()));
  const marquee=new Mesh(renderer.texture(arcadeArt(true)));
  const screen=new Mesh(renderer.texture(arcadeArt(false)));
  const relayMarquee=new Mesh(renderer.texture(relayArt(true)));
  const relayScreen=new Mesh(renderer.texture(relayArt(false)));
  const logo=new Mesh(renderer.texture(surface(200,155,ctx=>controller(ctx,19,1,162,'#e4e5d7',true))));
  const mat=new Mesh(renderer.texture(doorMat()));
  const shadowTex=renderer.texture(radial('#171b15d6'));
  const shadow=new Mesh(shadowTex), avatarShadow=new Mesh(shadowTex);
  const guide=new Mesh();
  const obstacles=[
    rectangle(-4.13,.08,5.14,.65,4.48),rectangle(4.13,.08,5.14,.65,4.48),
    rectangle(-3.70,1.37,1.53,1.32,1.63),rectangle(3.54,1.37,1.53,1.32,1.63),
    ...PORCH_BENCHES.map(([x,z])=>rectangle(x,z-.06,2.51,.86,1.06)),
    ...PUMPKINS.filter(([,y])=>y===0).map(([x,,z,r])=>rectangle(x,z,r*1.90,r*1.90,r*1.72)),
    rectangle(-3.92,-1.22,2.99,.96,1.74),rectangle(4.46,-1.31,2.28,.92,3.20),
    ...SHELVES.map(([x,z,turn,w])=>rectangle(x,z,turn ? .74 : w,turn ? w : .74,2.80)),
    ...GAME_TABLES.map(([x,z,w])=>rectangle(x,z,w+.06,1.13,1.22)),
    rectangle(DEMO.x,DEMO.z,DEMO.w+.08,DEMO.d+.08,1.80),
    rectangle(CHECKOUT.x,CHECKOUT.z,CHECKOUT.w+.11,CHECKOUT.d+.10,1.85),
    ...[CABINET,SIGNAL_CABINET].map(({x,z})=>rectangle(x,z,1.27,1.16,2.50))
  ];
  city(distant);
  platform(mesh);
  floorTiles(tile);
  storefront(mesh,glass,sign);
  planter(mesh,-3.70,1.37,12);
  planter(mesh,3.54,1.37,24);
  harvestPorch(mesh);
  for (const [x,z] of PORCH_BENCHES) {
    bench(mesh,x,z);
    shadow.ground(x,.011,z,3.40,1.36,M.white);
  }
  interior(mesh,{covers:cases,tags:rarityTags,titles:caseGames},display,harvest,logo,labels,stock);
  const cover=POSTER_COVER;
  const coverX=poster.x+poster.w*((cover.left+cover.w/2)/POSTER_PRINT.w-.5);
  const coverY=poster.y+poster.h*(.5-(cover.top+cover.h/2)/POSTER_PRINT.h);
  const posterSlot=caseGames.length, posterCover=cases[Math.floor(LATEST_RELEASE/coversPerAtlas)];
  posterCover.caseSlot=posterSlot;
  posterCover.front(coverX,coverY,poster.z+.008,
    poster.w*cover.w/POSTER_PRINT.w,poster.h*cover.h/POSTER_PRINT.h,M.white,coverUV(LATEST_RELEASE,'front'));
  posterCover.caseSlot=0;
  arcade(mesh,marquee,screen,CABINET.x,CABINET.z);
  arcade(mesh,relayMarquee,relayScreen,SIGNAL_CABINET.x,SIGNAL_CABINET.z,true);
  mat.ground(0,.012,1.01,2.79,1.16,m('#f0eee4',.32));
  shadow.ground(-3.70,.009,1.39,2.34,1.93,M.white);
  shadow.ground(3.54,.009,1.39,2.34,1.93,M.white);
  for (const [x,y,z,r] of PUMPKINS) {
    if (y===0) shadow.ground(x,.007,z,r*2.75,r*2.30,M.white);
  }
  shadow.ground(-3.92,.010,-1.22,3.76,1.32,M.white);
  for (const [x,z,w] of GAME_TABLES) shadow.ground(x,.010,z,w+.85,1.73,M.white);
  shadow.ground(DEMO.x,.010,DEMO.z,DEMO.w+.8,DEMO.d+.49,M.white);
  shadow.ground(CHECKOUT.x,.010,CHECKOUT.z,CHECKOUT.w+.8,CHECKOUT.d+.59,M.white);
  avatarShadow.ground(0,.018,0,1.01,.75,M.white);
  const marker=m('#567560',.24);
  const brassMarker=m('#92724e',.24);
  for (const [station,color] of [[CABINET,marker],[SIGNAL_CABINET,brassMarker],[CHECKOUT,brassMarker]]) {
    const p=(a,r)=>[station.x+Math.cos(a)*r,.020,station.approachZ+Math.sin(a)*r*.69];
    for (let i=0;i<32;i++) {
      if (i%8===0) continue;
      const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
      guide.quad(p(a,.60),p(b,.60),p(b,.555),p(a,.555),color);
    }
  }
  for (let z=-1.12; z>CABINET.approachZ+.75; z-=1.42) {
    const x=CABINET.x * z/CABINET.approachZ;
    guide.quad([x-.15,.014,z+.13],[x,.014,z-.02],[x,.014,z-.09],[x-.15,.014,z+.06],marker);
    guide.quad([x,.014,z-.02],[x+.15,.014,z+.13],[x+.15,.014,z+.06],[x,.014,z-.09],marker);
  }
  renderer.lights([
    [[-4.4,3.65,.95],'#ffd6a4',5.5,1.23],[[4.55,3.65,.97],'#ffe0b6',5.7,1.22],
    [[0,3.68,1.19],'#ff9b86',6.9,1.16],[[0,3.31,-2.90],'#fff1db',7.0,1.16],
    [[-4.48,3.20,-3.3],'#fff0d6',6.0,1.13],[[4.0,3.23,-4.7],'#fff1db',6.3,1.14],
    [[CABINET.x,2.49,CABINET.z+.54],'#b4d8c5',4.6,.78],[[0,2.34,6.00],'#a9b8ff',8.0,.81],
    [[-porchRailX,1.42,porchRailFront-.13],'#ffd6a2',4.8,.94],[[porchRailX,1.42,porchRailFront-.13],'#ffd6a2',4.8,.94],
    [[-3.53,3.23,-.53],'#ffebd3',5.05,1.12],[[4.3,3.21,-.60],'#ffedd3',5.05,1.13],
    [[0,3.77,-7.30],'#fff0d9',6.4,1.20],[[0,3.85,-11.24],'#fff1d9',6.2,1.16],
    [[-6.74,3.73,-9.21],'#fff0d9',6.05,1.23],[[-7.31,3.56,-16.09],'#ffedd2',6.1,1.20],
    [[6.15,3.76,-8.23],'#fff1da',6.0,1.15],[[6.16,3.63,-16.44],'#ffcdb3',6.38,1.30],
    [[0,4.72,2.05],'#ff6558',8.3,1.18],[[SIGNAL_CABINET.x,2.62,SIGNAL_CABINET.z+.75],'#9d9aff',4.9,.9]
  ]);
  const upload=meshes=>meshes.map(part=>renderer.upload(part));
  return {
    opaque:upload([distant,mesh,tile,sign,...cases,display,harvest,labels,marquee,screen,relayMarquee,relayScreen,logo,mat,guide]),
    releasePosters,
    transparent:upload([glass]), decals:upload([shadow,rarityTags]),
    doors:[upload(door(-1)),upload(door(1))],
    avatars:new Map([[0,avatar(renderer,looks[0])]]), avatarShadow:renderer.upload(avatarShadow), obstacles, cases, caseGames, posterSlot, stockCopies:stock.copies
  };
}

export function drawAvatar(renderer, world, player, phase, stride, time, look = 0) {
  if (!world.avatars.has(look)) world.avatars.set(look,avatar(renderer,looks[look]));
  const idle=Math.sin(time*2.7)*.010;
  const swing=Math.sin(phase) * stride;
  const body=model(player.x,.029+Math.abs(Math.sin(phase))*.044*stride+idle,player.z,player.yaw,.060*stride,1.035);
  const {torso,back,leftLeg,rightLeg,leftArm,rightArm}=world.avatars.get(look);
  renderer.draw(torso,body);
  renderer.draw(back,body);
  renderer.draw(leftLeg,multiply(body,model(-.138,.812,.006,0,swing*.62)));
  renderer.draw(rightLeg,multiply(body,model(.138,.812,.006,0,-swing*.62)));
  renderer.draw(leftArm,multiply(body,model(-.306,1.446,-.018,0,-swing*.71)));
  renderer.draw(rightArm,multiply(body,model(.306,1.446,-.018,0,swing*.71)));
}
