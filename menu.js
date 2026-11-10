import { outfits, shopOutfits, skinTones, hairColors, savedLook } from './cosmetics.js?v=wardrobe-4';

const storageKey = 'after-hours-character';
const $ = id => document.getElementById(id);
const money = value => value.toLocaleString('en-US')+' CR';

export function createMenu({read, save, shop, onPlay, toggleSound, toggleFullscreen}) {
  const menu = $('start-menu');
  const home = $('menu-home'), character = $('menu-character'), options = $('menu-options'), store = $('menu-item-shop');
  let look = savedLook(read(storageKey),shop.state.cosmetics);
  let selected = {...look}, item = shopOutfits[0], angle = 0;

  function screen(panel, focus) {
    for (const section of [home,character,options,store]) section.hidden = section !== panel;
    menu.classList.toggle('wardrobe-open',panel === character || panel === store);
    menu.classList.toggle('item-shop-open',panel === store);
    $('menu-hints').hidden = panel !== home;
    menu.setAttribute('aria-labelledby',panel.querySelector('h1,h2').id);
    menu.scrollTop = 0;
    focus.focus({preventScroll:true});
  }

  function choose(label, color, pressed, select) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'look-swatch';
    button.textContent = label;
    button.style.setProperty('--swatch',color);
    button.setAttribute('aria-pressed',String(pressed));
    button.addEventListener('click',() => {
      for (const sibling of button.parentElement.children) sibling.setAttribute('aria-pressed',String(sibling === button));
      select();
    });
    return button;
  }

  function openCreator() {
    selected = {...look};
    angle = 0;
    $('look-outfits').replaceChildren(...Object.entries(outfits).filter(([id,entry]) => !entry.price || shop.state.cosmetics.includes(id))
      .map(([id,entry]) => choose(entry.name,entry.hood,id === selected.outfit,() => { selected.outfit = id; })));
    $('look-skins').replaceChildren(...skinTones.map((tone,index) => choose(tone.name,tone.skin,index === selected.skin,() => { selected.skin = index; })));
    $('look-hair').replaceChildren(...hairColors.map((tone,index) => choose(tone.name,tone.hair,index === selected.hair,() => { selected.hair = index; })));
    screen(character,$('menu-save-look'));
  }

  function refreshShop() {
    const entry = outfits[item];
    const {credits,cosmetics} = shop.state;
    const owned = cosmetics.includes(item);
    const wearing = look.outfit === item;
    $('item-wallet').textContent = money(credits);
    $('item-name').textContent = entry.name;
    $('item-type').textContent = entry.type;
    $('item-price').textContent = owned ? 'OWNED' : money(entry.price);
    for (const tile of $('item-outfits').children) {
      const id = tile.dataset.outfit;
      const selected = id === item;
      tile.setAttribute('aria-pressed',String(selected));
      tile.querySelector('.shop-tile-price').textContent = look.outfit === id ? 'EQUIPPED'
        : cosmetics.includes(id) ? 'OWNED' : money(outfits[id].price);
    }
    const action = $('item-action');
    action.textContent = wearing ? 'Equipped' : owned ? 'Equip outfit' : 'Buy outfit · '+money(entry.price);
    action.disabled = wearing || (!owned && credits < entry.price);
    $('item-status').textContent = !owned && credits < entry.price ? 'Earn '+money(entry.price-credits)+' more in the arcade.' : '';
  }

  function openShop() {
    angle = 0;
    $('item-outfits').replaceChildren(...shopOutfits.map((id,index) => {
      const outfit = outfits[id];
      const tile = $('shop-tile-template').content.firstElementChild.cloneNode(true);
      tile.dataset.outfit = id;
      tile.querySelector('.shop-tile-label').hidden = index !== 0;
      tile.querySelector('.shop-tile-name').textContent = outfit.name;
      tile.style.setProperty('--coat',outfit.coat);
      tile.style.setProperty('--hood',outfit.hood);
      tile.style.setProperty('--trim',outfit.accent);
      tile.style.setProperty('--tile-base',outfit.hood);
      tile.style.setProperty('--tile-glow',outfit.accent+'ad');
      tile.addEventListener('click',() => {
        item = id;
        refreshShop();
      });
      return tile;
    }));
    refreshShop();
    screen(store,$('item-outfits').querySelector('[aria-pressed=true]'));
  }

  function equip(next) {
    look = {...next};
    save(storageKey,JSON.stringify(look));
  }

  $('menu-create').addEventListener('click',openCreator);
  $('menu-shop-button').addEventListener('click',openShop);
  $('menu-options-button').addEventListener('click',() => screen(options,$('menu-sound')));
  $('menu-save-look').addEventListener('click',() => {
    equip(selected);
    screen(home,$('menu-create'));
  });
  $('item-action').addEventListener('click',() => {
    if (shop.state.cosmetics.includes(item)) {
      equip({...look,outfit:item});
      refreshShop();
      $('item-status').textContent = outfits[item].name+' equipped.';
    } else if (shop.buyOutfit(item)) {
      refreshShop();
      $('item-status').textContent = 'Purchased. Equip it here or in Create a Character.';
    } else refreshShop();
  });
  $('menu-character-back').addEventListener('click',() => screen(home,$('menu-create')));
  $('menu-item-back').addEventListener('click',() => screen(home,$('menu-shop-button')));
  $('menu-options-back').addEventListener('click',() => screen(home,$('menu-options-button')));
  $('menu-sound').addEventListener('click',toggleSound);
  $('menu-fullscreen').addEventListener('click',toggleFullscreen);
  $('menu-play').addEventListener('click',() => {
    menu.close();
    onPlay();
  });
  $('preview-left').addEventListener('click',() => { angle -= Math.PI/4; });
  $('preview-right').addEventListener('click',() => { angle += Math.PI/4; });
  menu.addEventListener('keydown',event => {
    if (home.hidden || !['ArrowUp','ArrowDown'].includes(event.key)) return;
    const choices = [...home.querySelectorAll('button')];
    const current = choices.indexOf(document.activeElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    event.preventDefault();
    choices[(current + direction + choices.length) % choices.length].focus();
  });
  menu.addEventListener('cancel',event => {
    event.preventDefault();
    if (!character.hidden) screen(home,$('menu-create'));
    if (!store.hidden) screen(home,$('menu-shop-button'));
    if (!options.hidden) screen(home,$('menu-options-button'));
  });

  return {
    get open() { return menu.open; },
    get look() { return look; },
    get preview() {
      if (!menu.open) return null;
      if (!character.hidden) return {look:selected,angle};
      if (!store.hidden) return {look:{...look,outfit:item},angle};
      return null;
    },
    refreshShop() { if (!store.hidden) refreshShop(); },
    show() { menu.showModal(); $('menu-play').focus(); }
  };
}
