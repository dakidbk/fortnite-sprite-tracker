import { accessories, outfits, listings, listingQuote, shopBundles, shopItems, shopOutfits, skinTones, hairColors, savedLook } from './cosmetics.js?v=shop-drop-7';

import { createCreatorInbox } from './creator.js?v=creator-inbox-8';

const storageKey = 'after-hours-character';
const $ = id => document.getElementById(id);
const money = value => value.toLocaleString('en-US')+' CR';
const dayLength = 86400000;
const itemIds = id => listings[id].items || [id];
const wearingAll = (look,id) => itemIds(id).every(part => look[shopItems[part].slot] === part);

export function createMenu({read, save, shop, onPlay, toggleSound, toggleFullscreen}) {
  const menu = $('start-menu');
  const home = $('menu-home'), character = $('menu-character'), options = $('menu-options'), store = $('menu-item-shop'), creator = $('menu-creator');
  const inbox = createCreatorInbox(shop);
  let look = savedLook(read(storageKey),shop.state.cosmetics);
  const catalogs = {outfits:shopOutfits,accessories:Object.keys(accessories),bundles:Object.keys(shopBundles)};
  let selected = {...look}, item, category = 'featured', angle = 0, day = 0, clock;
  const featured = date => [
    shopOutfits[date % shopOutfits.length],
    catalogs.accessories[date % catalogs.accessories.length],
    catalogs.bundles[date % catalogs.bundles.length]
  ];

  function screen(panel, focus) {
    for (const section of [home,character,options,store,creator]) section.hidden = section !== panel;
    menu.classList.toggle('wardrobe-open',panel === character || panel === store);
    menu.classList.toggle('item-shop-open',panel === store);
    $('menu-hints').hidden = panel !== home;
    clearInterval(clock);
    if (panel === store) clock = setInterval(updateRotation,1000);
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
    const available = Object.keys(accessories).filter(id => shop.state.cosmetics.includes(id));
    $('look-accessory-group').hidden = !available.length;
    $('look-accessories').replaceChildren(choose('None','#463750',!selected.accessory,() => { selected.accessory = null; }),
      ...available.map(id => choose(accessories[id].name,accessories[id].accent,id === selected.accessory,() => { selected.accessory = id; })));
    screen(character,$('menu-save-look'));
  }

  function updateRotation() {
    const now = Date.now(), today = Math.floor(now/dayLength);
    if (today !== day && category === 'featured') showCategory(category);
    day = today;
    const remaining = Math.ceil(((today+1)*dayLength-now)/1000);
    $('shop-clock').textContent = [Math.floor(remaining/3600),Math.floor(remaining/60)%60,remaining%60]
      .map(value => String(value).padStart(2,'0')).join(':');
  }

  function refreshShop() {
    const entry = listings[item];
    const {credits,cosmetics} = shop.state;
    $('item-wallet').textContent = money(credits);
    $('shop-inventory').textContent = cosmetics.length+' / '+Object.keys(shopItems).length+' OWNED';
    $('shop-empty').hidden = !!entry;
    $('item-detail').hidden = !entry;
    $('item-action').hidden = !entry;
    if (!entry) {
      $('item-contents').hidden = true;
      $('item-status').textContent = '';
      return;
    }
    const quote = listingQuote(item,cosmetics);
    const owned = !quote.missing.length;
    const wearing = wearingAll(look,item);
    $('item-contents').hidden = !entry.items;
    $('item-contents').textContent = entry.items?.map(id => shopItems[id].name).join(' + ') || '';
    $('item-original-price').hidden = !entry.items || owned;
    $('item-original-price').textContent = money(quote.regular);
    $('item-name').textContent = entry.name;
    $('item-type').textContent = entry.type;
    $('item-price').textContent = owned ? 'OWNED' : money(quote.cost);
    for (const tile of $('item-outfits').children) {
      const id = tile.dataset.item;
      const tileQuote = listingQuote(id,cosmetics);
      tile.setAttribute('aria-pressed',String(id === item));
      tile.querySelector('.shop-tile-price').textContent = wearingAll(look,id) ? 'EQUIPPED'
        : !tileQuote.missing.length ? 'OWNED' : money(tileQuote.cost);
    }
    const action = $('item-action');
    const kind = entry.items ? 'bundle' : entry.slot;
    action.textContent = wearing ? 'Equipped' : owned ? 'Equip '+kind : 'Buy '+kind+' · '+money(quote.cost);
    action.disabled = wearing || (!owned && credits < quote.cost);
    $('item-status').textContent = !owned && credits < quote.cost ? 'Earn '+money(quote.cost-credits)+' more in the arcade.' : '';
  }

  function showCategory(next) {
    category = next;
    day = Math.floor(Date.now()/dayLength);
    const ids = category === 'featured' ? featured(day) : category === 'locker' ? shop.state.cosmetics : catalogs[category];
    $('shop-rotation').hidden = category !== 'featured';
    if (!ids.includes(item)) {
      item = ids[0];
      angle = item && itemIds(item).includes('backpack') ? Math.PI : 0;
    }
    for (const tab of $('shop-categories').children) tab.setAttribute('aria-pressed',String(tab.dataset.category === category));
    $('item-outfits').dataset.category = category;
    $('item-outfits').replaceChildren(...ids.map((id,index) => {
      const entry = listings[id];
      const outfit = shopItems[itemIds(id)[0]];
      const tile = $('shop-tile-template').content.firstElementChild.cloneNode(true);
      tile.dataset.item = id;
      const badge = tile.querySelector('.shop-tile-label');
      badge.hidden = !entry.items && (category !== 'featured' || index !== 0);
      badge.textContent = entry.items ? 'BUNDLE · SAVE 20%' : 'FEATURED';
      const artIds = itemIds(id).map(part => shopItems[part].slot === 'outfit' ? 'outfit' : part);
      for (const drawing of tile.querySelectorAll('[data-art]')) {
        if (!artIds.includes(drawing.dataset.art)) drawing.remove();
        else if (entry.items && drawing.dataset.art !== 'outfit') {
          const accessory = shopItems[entry.items[1]];
          drawing.setAttribute('transform','translate(64 45) scale(.46)');
          drawing.style.setProperty('--coat',accessory.coat);
          drawing.style.setProperty('--hood',accessory.hood);
          drawing.style.setProperty('--trim',accessory.accent);
        } else if (entry.items) drawing.setAttribute('transform','translate(-1 7) scale(.80)');
      }
      tile.querySelector('.shop-tile-name').textContent = entry.name;
      tile.style.setProperty('--coat',outfit.coat);
      tile.style.setProperty('--hood',outfit.hood);
      tile.style.setProperty('--trim',outfit.accent);
      tile.style.setProperty('--tile-base',outfit.hood);
      tile.style.setProperty('--tile-glow',outfit.accent+'ad');
      tile.addEventListener('click',() => {
        item = id;
        angle = itemIds(id).includes('backpack') ? Math.PI : 0;
        refreshShop();
      });
      return tile;
    }));
    refreshShop();
  }

  function openShop() {
    showCategory(category);
    angle = item && itemIds(item).includes('backpack') ? Math.PI : 0;
    updateRotation();
    screen(store,$('item-outfits').querySelector('[aria-pressed=true]') || $('shop-categories').querySelector('[aria-pressed=true]'));
  }

  function tryOn(id) {
    const next = {...look};
    if (id) for (const part of itemIds(id)) next[shopItems[part].slot] = part;
    return next;
  }

  function equip(next) {
    look = {...next};
    save(storageKey,JSON.stringify(look));
  }

  $('menu-create').addEventListener('click',openCreator);
  $('menu-shop-button').addEventListener('click',openShop);
  for (const tab of $('shop-categories').children) tab.addEventListener('click',() => {
    showCategory(tab.dataset.category);
    angle = item && itemIds(item).includes('backpack') ? Math.PI : 0;
    updateRotation();
  });
  $('menu-options-button').addEventListener('click',() => screen(options,$('menu-sound')));
  $('menu-save-look').addEventListener('click',() => {
    equip(selected);
    screen(home,$('menu-create'));
  });
  $('item-action').addEventListener('click',() => {
    if (!item) return;
    if (!listingQuote(item,shop.state.cosmetics).missing.length) {
      equip(tryOn(item));
      refreshShop();
      $('item-status').textContent = listings[item].name+' equipped.';
    } else if (shop.buyCosmetic(item)) {
      refreshShop();
      $('item-status').textContent = 'Purchased. Equip it here or in Create a Character.';
    } else refreshShop();
  });
  $('menu-character-back').addEventListener('click',() => screen(home,$('menu-create')));
  $('menu-item-back').addEventListener('click',() => screen(home,$('menu-shop-button')));
  $('menu-creator-button').addEventListener('click',() => {
    screen(creator,$('menu-creator-back'));
    inbox.open();
  });
  $('menu-creator-back').addEventListener('click',() => screen(options,$('menu-creator-button')));
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
    else if (!creator.hidden) screen(options,$('menu-creator-button'));
  });

  return {
    get open() { return menu.open; },
    get look() { return look; },
    get preview() {
      if (!menu.open) return null;
      if (!character.hidden) return {look:selected,angle};
      if (!store.hidden) return {look:tryOn(item),angle};
      return null;
    },
    refreshShop() {
      if (!creator.hidden) inbox.render();
      if (store.hidden) return;
      const cards = [...$('item-outfits').children];
      if (category === 'locker' && (cards.length !== shop.state.cosmetics.length ||
        cards.some(card => !shop.state.cosmetics.includes(card.dataset.item)))) showCategory(category);
      else refreshShop();
    },
    show() { menu.showModal(); $('menu-play').focus(); }
  };
}
