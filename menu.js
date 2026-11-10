export const looks = [
  {name:'Forest', coat:'#313c37', hood:'#465b51', accent:'#95afa0', skin:'#bf876d', lightSkin:'#d99d81', hair:'#372b26', hairLight:'#805a45'},
  {name:'Ember', coat:'#883b37', hood:'#ac5748', accent:'#f5b884', skin:'#865342', lightSkin:'#aa715a', hair:'#261e25', hairLight:'#51404b'},
  {name:'Glacier', coat:'#354d85', hood:'#476caa', accent:'#a5d7ed', skin:'#d5a186', lightSkin:'#eeb699', hair:'#443248', hairLight:'#896c8e'},
  {name:'Violet', coat:'#614177', hood:'#845c99', accent:'#dab4f5', skin:'#a86b54', lightSkin:'#c68b71', hair:'#201f2b', hairLight:'#4a4863'}
];

const storageKey = 'after-hours-character';

export function createMenu({read, save, onPlay, toggleSound, toggleFullscreen}) {
  const $ = id => document.getElementById(id);
  const menu = $('start-menu');
  const home = $('menu-home'), character = $('menu-character'), options = $('menu-options');
  const stored = read(storageKey);
  let look = looks[Number(stored)] ? Number(stored) : 0;
  let selected = look;

  function screen(panel, focus) {
    for (const item of [home,character,options]) item.hidden = item !== panel;
    menu.setAttribute('aria-labelledby', panel.querySelector('h1,h2').id);
    focus.focus();
  }

  const swatches = looks.map((palette,index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'look-swatch';
    button.textContent = palette.name;
    button.style.setProperty('--swatch',palette.hood);
    button.addEventListener('click',() => preview(index));
    $('look-swatches').append(button);
    return button;
  });

  function preview(index) {
    selected = index;
    const palette = looks[index];
    const art = $('character-preview');
    for (const key of ['coat','hood','accent','skin','hair']) art.style.setProperty('--'+key,palette[key]);
    swatches.forEach((button,i) => button.setAttribute('aria-pressed',String(i === index)));
  }

  $('menu-create').addEventListener('click',() => {
    preview(look);
    screen(character,swatches[look]);
  });
  $('menu-options-button').addEventListener('click',() => screen(options,$('menu-sound')));
  $('menu-save-look').addEventListener('click',() => {
    look = selected;
    save(storageKey,String(look));
    screen(home,$('menu-create'));
  });
  $('menu-character-back').addEventListener('click',() => screen(home,$('menu-create')));
  $('menu-options-back').addEventListener('click',() => screen(home,$('menu-options-button')));
  $('menu-sound').addEventListener('click',toggleSound);
  $('menu-fullscreen').addEventListener('click',toggleFullscreen);
  $('menu-play').addEventListener('click',() => {
    menu.close();
    onPlay();
  });
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
    if (!options.hidden) screen(home,$('menu-options-button'));
  });

  return {
    get open() { return menu.open; },
    get look() { return look; },
    show() { menu.showModal(); $('menu-play').focus(); }
  };
}
