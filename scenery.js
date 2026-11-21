import { material as m, seeded } from './webgl.js?v=visual-28';

const bark=m('#68503c',0,1,.12,1), brass=m('#b79969',0,1,.64,5);
const dark=m('#303a35',0,1,.40,5), ivory=m('#f5dcb3',.91);

// Shared, deterministic landscaping for the store street and personal lots.
export function autumnTree(mesh,x,z,height,style=0,ground=-.22) {
  const random=seeded(Math.round((x+130)*57+(z+180)*89+style*31));
  const palettes=[['#bd8246','#d39b53','#9a603c'],['#a96645','#c58450','#874d39'],['#b19a54','#c6ac62','#827a48'],['#a96b55','#c38962','#82504c']];
  const inks=palettes[Math.abs(style)%palettes.length].map(hex=>m(hex,.06,1,.08));
  const crown=ground+height*.68;
  mesh.rod([x,ground,z],[x+.06,crown+.20,z],.17,.055,9,bark);
  for(let i=0;i<7;i++) {
    const a=i*2.399, radius=i===6 ? .12 : height*(.13+random()*.035);
    const bx=x+Math.cos(a)*radius,bz=z+Math.sin(a)*radius;
    const y=crown+(i===6 ? height*.20 : (random()-.38)*height*.20);
    if(i<5) mesh.rod([x,crown-height*.22,z],[bx,y,bz],.070,.019,6,bark);
    mesh.ellipsoid(bx,y,bz,height*.22,height*(.22+random()*.06),height*.22,11,7,inks[i%3]);
  }
  // Small clusters break up the silhouette without expensive leaf transparency.
  for(let i=0;i<5;i++) {
    const a=i*1.256+.47;
    mesh.ellipsoid(x+Math.cos(a)*height*.28,crown+height*.02,z+Math.sin(a)*height*.28,height*.105,height*.13,height*.11,8,5,inks[(i+1)%3]);
  }
}

export function shrub(mesh,x,y,z,width=.55,ink='#5b7251') {
  const green=m(ink,.035,1,.08);
  for(const [a,b,s] of [[-.22,0,.37],[.16,.08,.36],[.02,-.15,.33]]) {
    mesh.ellipsoid(x+a*width,y+.30*width,z+b*width,s*width,.36*width,s*width,10,6,green);
  }
}

export function hangingPlant(mesh,x,y,z) {
  const pot=m('#bd9571',0,1,.19,2), leaf=m('#647b51',0,1,.09);
  mesh.rod([x,y,z],[x,y+.25,z],.18,.24,12,pot);
  for(let i=0;i<3;i++) {
    const a=i*2.094;
    mesh.rod([x+Math.cos(a)*.20,y+.24,z+Math.sin(a)*.20],[x,y+.72,z],.007,.007,4,brass);
  }
  for(let i=0;i<9;i++) {
    const a=i*2.4, h=.10+(i%3)*.13;
    const end=[x+Math.cos(a)*.32,y-h,z+Math.sin(a)*.32];
    mesh.rod([x,y+.23,z],end,.009,.005,4,leaf);
    mesh.ellipsoid(...end,.085,.14,.07,8,5,leaf);
  }
}

export function pendant(mesh,x,z,ceiling=3.72) {
  mesh.rod([x,ceiling,z],[x,3.01,z],.011,.011,5,dark);
  mesh.rod([x,3.02,z],[x,2.80,z],.15,.39,18,brass);
  mesh.rod([x,2.796,z],[x,2.811,z],.33,.33,18,ivory);
  mesh.rod([x,2.778,z],[x,2.79,z],.11,.11,12,m('#fff0d2',1.04));
}

export function galleryArt(ctx,w,h) {
  const random=seeded(1742);
  const themes=[['#dfbf92','#b66e50','#486a62'],['#b7c4b3','#647c78','#304e4c'],['#c7b2a2','#9a7180','#4e5c6a']];
  const panel=w/3;
  for(let i=0;i<3;i++) {
    const x=i*panel,[paper,sun,mountain]=themes[i];
    ctx.save();ctx.beginPath();ctx.rect(x,0,panel,h);ctx.clip();
    ctx.fillStyle=paper;ctx.fillRect(x,0,panel,h);
    ctx.fillStyle=sun;ctx.beginPath();ctx.arc(x+panel*(.27+i*.18),h*.29,h*.16,0,Math.PI*2);ctx.fill();
    for(let row=0;row<3;row++) {
      ctx.fillStyle=[sun,mountain,'#263f3b'][row];ctx.globalAlpha=.64+row*.13;
      ctx.beginPath();ctx.moveTo(x,h);
      for(let j=0;j<=8;j++) ctx.lineTo(x+j*panel/8,h*(.48+row*.16)+(random()-.5)*h*.27);
      ctx.lineTo(x+panel,h);ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=.12;ctx.fillStyle='#fff6e2';
    for(let j=0;j<900;j++)ctx.fillRect(x+random()*panel,random()*h,1.5,1.5);
    ctx.restore();
  }
}

// Geometry-only falloff shadows for furniture on each editable floor.
export function contactShadow(mesh,x,y,z,w,d) {
  const rings=[0,.34,.67,1];
  const alphas=[.20,.16,.065,0];
  for(let j=0;j<3;j++) for(let i=0;i<16;i++) {
    const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
    const p=(angle,r)=>[x+Math.cos(angle)*w*.65*r,y,z+Math.sin(angle)*d*.65*r];
    const points=[p(a,rings[j]),p(b,rings[j]),p(b,rings[j+1]),p(a,rings[j+1])];
    const indices=[0,1,2,0,2,3];
    for(const n of indices)mesh.vert(points[n],[0,1,0],m('#17211e',1,n<2?alphas[j]:alphas[j+1]),[0,0]);
  }
}
