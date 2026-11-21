import { clamp, model, viewProjection } from './webgl.js?v=visual-28';
import {
  candidate, categories, existingAt, finishes, floorCount, floorHeight, lotHalf, lotName, lotPlans,
  lotSize, lotStorage, normalizePiece, pieces, placePiece, readLot, sampleTile, starterLot
} from './lot-layout.js?v=property-26';
import { createBuildGrid, createLotGround, makeMarker, makeProperty, propertyPhysics } from './lot-world.js?v=visual-28';

const $ = id => document.getElementById(id);
const keys = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
const minZoom = .72, maxZoom = 4;

export function propertyView(aspect, floor, angle, zoom, x=0, z=0) {
  const distance=Math.max(38.4,32.7/aspect)/zoom, y=floor*floorHeight;
  return {
    eye:[x+Math.sin(angle)*distance*.55,y+distance*.84,z+Math.cos(angle)*distance*.55],
    aim:[x,y+.16,z], fov:.91, aspect
  };
}

export function screenToFloor(view,nx,ny,y) {
  const dir=view.aim.map((coordinate,axis)=>coordinate-view.eye[axis]);
  const length=Math.hypot(...dir);
  const [fx,fy,fz]=dir.map(n=>n/length);
  const horizontal=Math.hypot(fx,fz);
  const rx=-fz/horizontal,rz=fx/horizontal;
  const field=Math.tan(view.fov/2);
  const a=(2*nx-1)*view.aspect*field,b=(1-2*ny)*field;
  const dx=fx+a*rx-b*rz*fy,dy=fy+b*(rz*fx-rx*fz),dz=fz+a*rz+b*rx*fy;
  if (dy>=-.001) return;
  const t=(y-view.eye[1])/dy;
  if (t>0) return [view.eye[0]+dx*t,view.eye[2]+dz*t];
}

export function createLot({canvas,clearMovement,onMode,onExit}) {
  const shell=$('lot-ui'), panel=$('lot-builder'), name=$('lot-name'), status=$('lot-status'), saved=$('lot-saved');
  const templateDialog=$('lot-plans'), planCopy=$('lot-plan-copy');
  const toolRotate=$('lot-rotate'), undo=$('lot-undo'), redo=$('lot-redo'), zoomIn=$('lot-zoom-in'), zoomOut=$('lot-zoom-out');
  let layout;
  try { layout=readLot(localStorage.getItem(lotStorage)); }
  catch { layout=readLot(null); }
  let active=false, building=false, level=0, category=categories[0], selected='timber', finish=pieces[selected].color, rotation=0, mode='place';
  let angle=.36, zoom=1, focusX=0, focusZ=0;
  let cursor, gesture, pinch, meshes, property, marker, markerKey, markerItems, lastView, physics=propertyPhysics(layout.items), dirty=true;
  const pointers=new Map();
  const previous=[], next=[];
  const buttons={};

  function button(parent,label,action,className='lot-tool') {
    const node=document.createElement('button');
    node.type='button';
    node.className=className;
    node.textContent=label;
    node.addEventListener('click',action);
    parent.append(node);
    return node;
  }

  const floorButtons=Array.from({length:floorCount},(_,index)=>button($('lot-floors'),String(index+1),()=>{
    level=index;
    dirty=true;
    cursor=undefined;
    refreshTools();
    guidance();
  }));
  floorButtons.forEach((node,index)=>node.setAttribute('aria-label','Floor '+(index+1)));
  const categoryButtons=categories.map(value=>button($('lot-categories'),value,()=>{
    choose(Object.keys(pieces).find(id=>pieces[id].category===value));
  },'lot-tab'));
  for (const [id,item] of Object.entries(pieces)) {
    const option=button($('lot-pieces'),' ',()=>choose(id),'lot-piece');
    option.textContent='';
    const shape=document.createElement('span'), label=document.createElement('span');
    shape.className='lot-piece-icon lot-icon-'+item.icon;
    shape.setAttribute('aria-hidden','true');
    shape.style.setProperty('--piece-ink',finishes[item.color][1]);
    label.textContent=item.name;
    option.append(shape,label);
    buttons[id]=option;
  }
  const swatches=finishes.map(([label,hex],index)=>{
    const node=button($('lot-colors'),' ',()=>{
      finish=index;
      refreshTools();
    },'lot-color');
    node.style.setProperty('--finish',hex);
    node.title=label;
    node.setAttribute('aria-label',label);
    return node;
  });
  const modes=[
    [$('lot-place'),'place'],[$('lot-paint'),'paint'],[$('lot-erase'),'erase']
  ];
  for (const [node,id] of modes) node.addEventListener('click',()=>{
    mode=id;
    refreshTools();
    guidance();
  });

  function guidance(text) {
    const info=pieces[selected];
    status.textContent=text || (mode==='paint' ? 'Tap a piece to apply the selected finish.'
      : mode==='erase' ? 'Tap a piece to remove it.'
      : info.layer==='edge' ? 'Tap near a tile edge to place '+info.name.toLowerCase()+'.'
      : 'Tap a tile to place '+info.name.toLowerCase()+'.');
  }

  function refreshTools() {
    floorButtons.forEach((node,index)=>node.setAttribute('aria-pressed',String(index===level)));
    categoryButtons.forEach((node,index)=>node.setAttribute('aria-pressed',String(categories[index]===category)));
    for (const [id,node] of Object.entries(buttons)) {
      node.hidden=pieces[id].category!==category;
      node.setAttribute('aria-pressed',String(id===selected && mode==='place'));
    }
    swatches.forEach((node,index)=>node.setAttribute('aria-pressed',String(index===finish)));
    for (const [node,id] of modes) node.setAttribute('aria-pressed',String(id===mode));
    toolRotate.disabled=mode!=='place' || pieces[selected].layer==='decor' || pieces[selected].layer==='floor' || pieces[selected].layer==='roof';
    undo.disabled=!previous.length;
    redo.disabled=!next.length;
    refreshZoom();
    name.value=layout.name;
  }

  function refreshZoom() {
    zoomIn.disabled=zoom>=maxZoom;
    zoomOut.disabled=zoom<=minZoom;
    $('lot-zoom-value').textContent=Math.round(zoom*100)+'%';
  }

  function choose(id) {
    if (selected==='roof' || id==='roof') dirty=true;
    selected=id;
    category=pieces[id].category;
    finish=pieces[id].color;
    rotation=0;
    mode='place';
    refreshTools();
    guidance();
  }

  function persist() {
    try {
      localStorage.setItem(lotStorage,JSON.stringify(layout));
      saved.textContent='Saved on this device';
    } catch {
      saved.textContent='Autosave unavailable';
    }
  }

  function apply(value) {
    if (layout.items!==value.items) {
      physics=propertyPhysics(value.items);
      dirty=true;
    }
    layout=value;
    persist();
    refreshTools();
  }

  function commit(value) {
    if (layout.name===value.name && layout.items===value.items) return;
    previous.push(layout);
    if (previous.length>35) previous.shift();
    next.length=0;
    apply(value);
  }

  function revise(source,destination) {
    if (!source.length) return false;
    destination.push(layout);
    apply(source.pop());
    return true;
  }

  function turnPiece() {
    if (toolRotate.disabled) return;
    rotation=(rotation+1)%4;
    if (pieces[selected].layer==='edge' && cursor) cursor={col:cursor.col,row:cursor.row};
    guidance();
  }

  function changeZoom(factor,from,to=from) {
    const before=from && point(from.x,from.y);
    zoom=clamp(zoom*factor,minZoom,maxZoom);
    const after=to && point(to.x,to.y);
    if (before && after) {
      focusX=clamp(focusX+before[0]-after[0],-lotHalf,lotHalf);
      focusZ=clamp(focusZ+before[1]-after[1],-lotHalf,lotHalf);
    }
    cursor=undefined;
    refreshZoom();
  }

  function fitView() {
    zoom=1;
    focusX=focusZ=0;
    cursor=undefined;
    refreshZoom();
  }

  function centerView() {
    angle=.36;
    fitView();
  }

  function clearGesture() {
    pointers.clear();
    gesture=pinch=undefined;
  }

  function setMode(build) {
    if (!active || building===build) return;
    clearMovement();
    building=build;
    panel.hidden=!build;
    canvas.parentElement.classList.toggle('lot-building',build);
    $('lot-build-mode').setAttribute('aria-pressed',String(build));
    $('lot-walk-mode').setAttribute('aria-pressed',String(!build));
    canvas.tabIndex=build ? 0 : -1;
    cursor=undefined;
    clearGesture();
    dirty=true;
    onMode(build);
    if (build) guidance();
    canvas.focus({preventScroll:true});
  }

  function enter() {
    active=true;
    shell.hidden=false;
    canvas.parentElement.classList.add('lot-open');
    canvas.setAttribute('aria-label','Your lot. Use Build to place pieces and Walk to explore.');
    building=Boolean(layout.items.length);
    setMode(!layout.items.length);
    refreshTools();
    persist();
  }

  function leave() {
    active=building=false;
    shell.hidden=true;
    cursor=undefined;
    clearGesture();
    canvas.tabIndex=-1;
    canvas.parentElement.classList.remove('lot-open','lot-building');
    canvas.setAttribute('aria-label','3D game store. Move with WASD, arrow keys, or the left thumbstick. Drag to look around. Tap or click a game cover to inspect it.');
  }

  function place() {
    if (!cursor) return;
    if (mode!=='place') {
      const old=existingAt(layout.items,level,cursor,selected);
      if (!old) { guidance('Choose a piece on this floor.'); return; }
      if (mode==='paint' && old.color===finish) return;
      const items=mode==='erase' ? layout.items.filter(item=>item!==old)
        : layout.items.map(item=>item===old ? {...item,color:finish} : item);
      commit({...layout,items});
      guidance();
      return;
    }
    const result=placePiece(layout.items,candidate(selected,level,finish,rotation,cursor));
    if (result.error) { guidance(result.error); return; }
    commit({...layout,items:result.items});
    guidance();
  }

  function point(x,y) {
    const rect=canvas.getBoundingClientRect();
    if (!lastView || !rect.width || !rect.height) return;
    const view=propertyView(lastView.aspect,level,angle,zoom,focusX,focusZ);
    return screenToFloor(view,(x-rect.left)/rect.width,(y-rect.top)/rect.height,level*floorHeight+.047);
  }

  const updateCursor=(x,y)=>{
    const location=point(x,y);
    cursor=location && sampleTile(...location);
  };

  function pointerDown(event) {
    if (pointers.size>=2) { event.preventDefault(); return; }
    const {pointerId,clientX,clientY}=event;
    pointers.set(pointerId,{x:clientX,y:clientY});
    if (pointers.size===2) {
      pinch=pinchPosition();
      gesture=cursor=undefined;
    } else {
      gesture={id:pointerId,x:clientX,y:clientY,dragging:false};
      updateCursor(clientX,clientY);
    }
    canvas.setPointerCapture(pointerId);
    event.preventDefault();
  }

  function pinchPosition() {
    const [a,b]=pointers.values();
    return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
  }

  function pointerMove(event) {
    const {pointerId,clientX:x,clientY:y}=event;
    if (pointers.has(pointerId)) pointers.set(pointerId,{x,y});
    if (pointers.size===2) {
      const next=pinchPosition();
      changeZoom(next.distance/pinch.distance,pinch,next);
      pinch=next;
      event.preventDefault();
      return;
    }
    if (!gesture) { if (event.pointerType!=='touch') updateCursor(x,y); return; }
    if (gesture.id!==pointerId || (!gesture.dragging && Math.hypot(x-gesture.x,y-gesture.y)<6)) return;
    gesture.dragging=true;
    const from=point(gesture.x,gesture.y), to=point(x,y);
    if (from && to) {
      focusX=clamp(focusX+from[0]-to[0],-lotHalf,lotHalf);
      focusZ=clamp(focusZ+from[1]-to[1],-lotHalf,lotHalf);
    }
    cursor=undefined;
    gesture.x=x; gesture.y=y;
  }

  function pointerEnd(event) {
    if (!pointers.has(event.pointerId)) return;
    const tap=gesture && event.type==='pointerup' && !gesture.dragging && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<6;
    pointers.delete(event.pointerId);
    pinch=undefined;
    gesture=undefined;
    if (pointers.size) {
      const [id,point]=pointers.entries().next().value;
      gesture={id,...point,dragging:true};
    }
    if (tap) {
      updateCursor(event.clientX,event.clientY);
      place();
    }
  }

  function keydown(event) {
    const {code}=event;
    if ((event.ctrlKey || event.metaKey) && code==='KeyZ') {
      event.preventDefault();
      if (event.shiftKey) revise(next,previous);
      else revise(previous,next);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || (event.target!==canvas && event.target?.matches?.('button'))) return;
    const direction=keys[code];
    if (direction) {
      event.preventDefault();
      const tile=cursor || {col:6,row:6};
      cursor={col:clamp(tile.col+direction[0],0,lotSize-1),row:clamp(tile.row+direction[1],0,lotSize-1)};
    } else if (code==='KeyR') {
      event.preventDefault();
      turnPiece();
    } else if (code==='Enter' || code==='Space') {
      event.preventDefault();
      if (!event.repeat) {
        cursor ||= {col:6,row:6};
        place();
      }
    }
  }

  function draw(renderer,view,drawAvatar) {
    if (meshes?.renderer!==renderer) {
      meshes={renderer,ground:createLotGround(renderer),grid:createBuildGrid(renderer)};
      property=marker=undefined;
      dirty=true;
    }
    if (dirty) {
      for (const mesh of [property?.solid,property?.glass,property?.shadow]) if (mesh) renderer.release(mesh);
      property=makeProperty(renderer,layout.items,building ? level : null,selected==='roof');
      renderer.lights(property.lights);
      dirty=false;
    }
    lastView=building ? view : undefined;
    const matrix=viewProjection(view.eye,view.aim,view.fov,view.aspect);
    renderer.propertyMode=true;
    renderer.begin(matrix,view.eye);
    renderer.draw(meshes.ground);
    if (property.solid) renderer.draw(property.solid);
    if (property.shadow) {
      renderer.blend(true);
      renderer.draw(property.shadow);
      renderer.blend(false);
    }
    if (building) {
      renderer.draw(meshes.grid,model(0,level*floorHeight+.040,0));
      const target=mode==='place' ? candidate(selected,level,finish,rotation,cursor) : existingAt(layout.items,level,cursor,selected);
      const stamp=JSON.stringify([target,cursor,level,mode]);
      if (stamp!==markerKey || markerItems!==layout.items || (!marker && cursor)) {
        const valid=Boolean(target && normalizePiece(target) && (mode!=='place' || !placePiece(layout.items,target).error));
        if (marker) renderer.release(marker);
        marker=makeMarker(renderer,target,valid,level,cursor);
        markerKey=stamp;
        markerItems=layout.items;
      }
      if (marker) renderer.draw(marker);
    } else if (!view.hideAvatar) {
      drawAvatar();
    }
    if (property.glass) {
      renderer.blend(true);
      renderer.draw(property.glass);
    }
    renderer.end();
  }

  $('lot-build-mode').addEventListener('click',()=>setMode(true));
  $('lot-walk-mode').addEventListener('click',()=>setMode(false));
  $('lot-exit').addEventListener('click',onExit);
  toolRotate.addEventListener('click',turnPiece);
  undo.addEventListener('click',()=>revise(previous,next));
  redo.addEventListener('click',()=>revise(next,previous));
  zoomIn.addEventListener('click',()=>changeZoom(1.25));
  zoomOut.addEventListener('click',()=>changeZoom(.8));
  $('lot-fit-view').addEventListener('click',fitView);
  $('lot-turn-view').addEventListener('click',()=>{ angle+=Math.PI/4; cursor=undefined; });
  name.addEventListener('change',()=>commit({...layout,name:lotName(name.value)}));
  name.addEventListener('keydown',event=>{
    if (event.key==='Enter') { event.preventDefault(); canvas.focus(); }
  });
  $('lot-starters').addEventListener('click',()=>{
    clearMovement();
    planCopy.textContent=layout.items.length ? 'A starter plan replaces this layout. Undo restores your work.' : 'Choose a plan to place on your lot.';
    templateDialog.showModal();
    $('lot-plan-close').focus();
  });
  $('lot-plan-close').addEventListener('click',()=>templateDialog.close());
  for (const entry of lotPlans) {
    const node=button($('lot-plan-list'),' ',()=>{
      commit(starterLot(entry.id));
      level=0;
      centerView();
      cursor=undefined;
      templateDialog.close();
      guidance('Edit the plan or switch to Walk to explore it.');
    },'lot-plan');
    node.textContent='';
    const title=document.createElement('strong'), detail=document.createElement('span');
    title.textContent=entry.name;
    detail.textContent=entry.detail;
    node.append(title,detail);
  }

  canvas.addEventListener('pointerleave',()=>{ if (building && !pointers.size) cursor=undefined; });
  canvas.addEventListener('wheel',event=>{
    if (!building || templateDialog.open || !event.deltaY) return;
    event.preventDefault();
    changeZoom(event.deltaY<0 ? 1.14 : 1/1.14,{x:event.clientX,y:event.clientY});
  },{passive:false});

  return {
    enter,leave,draw,pointerDown,pointerMove,pointerEnd,keydown,
    get active(){return active;},
    get building(){return building;},
    get dialogOpen(){return templateDialog.open;},
    get name(){return layout.name;},
    step:(x,z,y)=>physics.step(x,z,y),
    cameraBlocked:(x,y,z)=>physics.cameraBlocked(x,y,z),
    view:aspect=>propertyView(aspect,level,angle,zoom,focusX,focusZ),
    resetView:centerView
  };
}
