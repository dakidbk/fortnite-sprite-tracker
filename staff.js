import { GAMES, LATEST_RELEASE } from './catalog.js?v=store-economy-19';

export const cashier = {x:6.32,z:-16.16,yaw:Math.PI};
export const staffLooks = {
  cashier:{outfit:'glacier',skin:0,hair:1,style:1,gender:1,staff:true},
  manager:{outfit:'violet',skin:1,hair:1,style:3,gender:2,accessory:'studs',staff:true}
};
export const managerChance = .0005;

const $ = id => document.getElementById(id);
const popularPicks = [LATEST_RELEASE,0,10,11,4,20,35,32,41,45];
const patrol = [
  [1.65,-3.10],[-2.15,-3.55],[-6.05,-7.83],[-6.22,-12.45],[-5.50,-16.84],
  [1.70,-15.95],[2.77,-11.31],[5.94,-9.75],[4.72,-5.08]
];

// Use the same walkable bounds as the player to keep staff out of shelves and counters.
export function staffNavigation(canWalk) {
  const step = .35, left = -10.5, back = -19.25;
  const width = 61, depth = 54;
  const xAt = index => left+(index%width)*step;
  const zAt = index => back+Math.floor(index/width)*step;
  const passable = Uint8Array.from({length:width*depth},(_,i)=>Number(canWalk(xAt(i),zAt(i))));
  const neighbors = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  const clear = (a,b) => {
    const steps = Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.14));
    for (let i=0;i<=steps;i++) {
      if (!canWalk(a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps)) return false;
    }
    return true;
  };

  function search(x,z) {
    const start = [x,z];
    let nearest = -1, distance = Infinity;
    for (let i=0;i<passable.length;i++) {
      if (!passable[i]) continue;
      const d = (xAt(i)-x)**2+(zAt(i)-z)**2;
      if (d < distance && clear(start,[xAt(i),zAt(i)])) { nearest=i; distance=d; }
    }
    const parents = new Int16Array(passable.length).fill(-1);
    const queue = nearest < 0 ? [] : [nearest];
    if (nearest >= 0) parents[nearest] = nearest;
    for (let i=0;i<queue.length;i++) {
      const index=queue[i], col=index%width, row=Math.floor(index/width);
      for (const [dx,dz] of neighbors) {
        const next=(row+dz)*width+col+dx;
        if (col+dx < 0 || col+dx >= width || row+dz < 0 || row+dz >= depth || !passable[next] || parents[next] >= 0) continue;
        if (dx && dz && (!passable[index+dx] || !passable[index+dz*width])) continue;
        if (!clear([xAt(index),zAt(index)],[xAt(next),zAt(next)])) continue;
        parents[next]=index;
        queue.push(next);
      }
    }
    return {
      closest(x,z,radius) {
        let result, best = radius**2;
        for (const index of queue) {
          const px=xAt(index), pz=zAt(index);
          const d=(px-x)**2+(pz-z)**2;
          if (d < best) { best=d; result=index; }
        }
        return result;
      },
      path(end) {
        if (end === undefined) return [];
        const points = [];
        for (let index=end;;index=parents[index]) {
          points.push([xAt(index),zAt(index)]);
          if (index === nearest) break;
        }
        points.reverse();
        const route = [];
        let anchor=start;
        for (let i=0;i<points.length;) {
          let next=points.length-1;
          while (next > i && !clear(anchor,points[next])) next--;
          anchor=points[next];
          route.push(anchor);
          i=next+1;
        }
        return route;
      }
    };
  }
  return {search};
}

export function createStaff({getPlayer,getProfile,canWalk,clearMovement,openCase,announce}) {
  const dialog=$('manager-dialog'), message=$('manager-message'), follow=$('manager-follow');
  const tag=$('manager-tag'), marker=$('manager-case-marker');
  const manager={x:patrol[0][0],z:patrol[0][1],yaw:Math.PI,phase:0,stride:0};
  let navigation, cases, path=[], nextPatrol=1, pause=9, recommendation=0, offer, guide;
  const getGap=()=>Math.hypot(manager.x-getPlayer().x,manager.z-getPlayer().z);

  function recommendationTitle() {
    const available=popularPicks.filter(index=>!getProfile().owned.includes(index));
    const picks=available.length ? available : popularPicks;
    return GAMES[picks[recommendation++%picks.length]].title;
  }

  function findOffer() {
    const {owned,basket}=getProfile();
    const unavailable=new Set([...owned,...basket]);
    if (unavailable.size >= GAMES.length || Math.random() >= managerChance) return;
    const area=navigation.search(manager.x,manager.z);
    const titles=new Map();
    for (const [slot,item] of cases.entries()) {
      if (!item || unavailable.has(item.index) || titles.has(item.index)) continue;
      const end=area.closest(item.x+Math.sin(item.yaw)*.83,item.z+Math.cos(item.yaw)*.83,.68);
      if (end !== undefined) titles.set(item.index,{slot,item,end});
    }
    const choices=[...titles.values()];
    if (!choices.length) return;
    const choice=choices[Math.floor(Math.random()*choices.length)];
    return choice && {slot:choice.slot,item:choice.item,path:area.path(choice.end)};
  }

  function open() {
    if (dialog.open || !navigation) return;
    clearMovement();
    const {x,z}=getPlayer();
    manager.yaw=Math.atan2(manager.x-x,manager.z-z);
    offer=guide || findOffer();
    message.textContent=offer ? 'I have a game you haven’t collected. Want me to show you where it is?'
      : 'Hi! Looking for something to play?';
    follow.hidden=!offer;
    follow.textContent=guide ? 'Keep following' : 'Show me';
    dialog.showModal();
    $('manager-popular').focus();
  }

  $('manager-popular').addEventListener('click',()=>{
    message.textContent='People have been asking for '+recommendationTitle()+' lately.';
  });
  follow.addEventListener('click',()=>{
    if (!offer) return;
    if (!guide) {
      guide={...offer,arrived:false,far:0};
      path=guide.path;
    }
    dialog.close();
    announce(guide.arrived ? 'The case is marked on the shelf.' : 'Follow Maya through the aisles.');
  });
  $('manager-close').addEventListener('click',()=>dialog.close());
  $('manager-case-marker').addEventListener('click',()=>{
    if (guide?.arrived && getGap()<3) openCase(guide.slot);
  });

  function tick(dt) {
    if (!navigation || dialog.open) return;
    if (guide) {
      const {owned,basket}=getProfile();
      guide.far=getGap()>8 ? guide.far+dt : 0;
      if (guide.far > 15 || owned.includes(guide.item.index) || basket.includes(guide.item.index)) {
        guide=undefined;
        path=[];
      } else if (getGap()>3.8 || guide.arrived) {
        manager.stride=0;
        return;
      }
    }
    if (!path.length) {
      manager.stride=0;
      if (guide) {
        guide.arrived=true;
        manager.yaw=Math.atan2(manager.x-guide.item.x,manager.z-guide.item.z);
        announce('Maya found '+GAMES[guide.item.index].title+'.');
        return;
      }
      pause-=dt;
      if (pause>0) return;
      const area=navigation.search(manager.x,manager.z);
      path=area.path(area.closest(...patrol[nextPatrol],.65));
      nextPatrol=(nextPatrol+1)%patrol.length;
      pause=2.7;
      return;
    }
    const [x,z]=path[0], dx=x-manager.x, dz=z-manager.z;
    const distance=Math.hypot(dx,dz), stride=Math.min(distance,1.9*dt);
    if (distance > .001) {
      manager.x+=dx*stride/distance;
      manager.z+=dz*stride/distance;
      const desired=Math.atan2(-dx,-dz), turn=desired-manager.yaw;
      manager.yaw+=Math.atan2(Math.sin(turn),Math.cos(turn))*Math.min(1,dt*10);
    }
    manager.stride=.66;
    manager.phase+=dt*11;
    if (distance-stride<.002) path.shift();
  }

  function projectOverlay(node,position,projectPoint,hidden=false) {
    if (!position || hidden) { node.hidden=true; return; }
    const [x,y,w]=projectPoint(position);
    node.hidden=!(w>.3 && x>.04 && x<.96 && y>.09 && y<.91);
    if (node.hidden) return;
    node.style.left=x*100+'%';
    node.style.top=y*100+'%';
  }

  return {
    manager, open, tick,
    get isOpen(){return dialog.open;},
    setup(casePositions) { cases=casePositions; navigation=staffNavigation(canWalk); },
    nearby() { return getGap()<1.75; },
    guidedCase() { return getGap()<2.75 && guide?.arrived ? guide : null; },
    draw(projectPoint,head,hidden) {
      projectOverlay(tag,head,projectPoint,hidden || getGap()>6);
      const item=guide?.arrived && guide.item;
      projectOverlay(marker,item && [item.x,item.y+.20,item.z],projectPoint,hidden || getGap()>3);
    }
  };
}
