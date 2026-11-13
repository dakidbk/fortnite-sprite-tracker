import { GAMES, RARITIES } from './catalog.js';

const $ = id => document.getElementById(id);

export function createDex({getProfile, paintCover, clearMovement, ready}) {
  const dialog = $('dex-dialog'), grid = $('dex-grid'), search = $('dex-search');
  const rarity = $('dex-rarity');
  let selected = null, face = 'front';
  rarity.append(...Object.entries(RARITIES).map(([key,tier]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = tier.label;
    return option;
  }));

  function details() {
    if (selected === null) return;
    const game = GAMES[selected], tier = RARITIES[game.rarity];
    $('dex-entry-title').textContent = game.title;
    $('dex-entry-genre').textContent = game.genre;
    $('dex-entry-description').textContent = game.blurb;
    $('dex-entry-rarity').textContent = tier.label;
    $('dex-entry-rarity').style.color = tier.color;
    $('dex-entry-price').textContent = tier.price+' CR';
    const art = $('dex-entry-art');
    paintCover(art,selected,face);
    art.setAttribute('aria-label',(face === 'front' ? 'Front' : 'Back')+' cover of '+game.title);
    $('dex-front').setAttribute('aria-pressed',String(face === 'front'));
    $('dex-back').setAttribute('aria-pressed',String(face === 'back'));
  }

  function refresh() {
    const {owned} = getProfile();
    const query = search.value.trim().toLowerCase();
    const entries = owned.map(index => ({game:GAMES[index],index})).filter(({game}) =>
      (!query || (game.title+' '+game.genre).toLowerCase().includes(query)) &&
      (!rarity.value || game.rarity === rarity.value));
    $('dex-progress-text').textContent = owned.length+' / '+GAMES.length+' collected';
    $('dex-progress').value = owned.length;
    $('dex-results').textContent = query || rarity.value ? entries.length+' '+(entries.length === 1 ? 'match' : 'matches') : '';
    const empty = $('dex-empty');
    empty.textContent = owned.length ? 'No discoveries match these filters.' : 'Buy your first game at checkout to reveal it here.';
    empty.hidden = !!entries.length;
    $('dex-detail').hidden = !entries.length;
    if (!entries.some(entry => entry.index === selected)) {
      selected = entries[0]?.index ?? null;
      face = 'front';
    }
    grid.replaceChildren(...entries.map(({game,index}) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dex-card';
      button.setAttribute('aria-pressed',String(index === selected));
      const art = document.createElement('span');
      art.className = 'collection-art';
      art.setAttribute('aria-hidden','true');
      paintCover(art,index,'front');
      const label = document.createElement('strong');
      label.textContent = game.title;
      const state = document.createElement('span');
      state.className = 'dex-card-state';
      state.textContent = RARITIES[game.rarity].label;
      button.append(art,label,state);
      button.addEventListener('click',() => {
        selected = index;
        face = 'front';
        for (const card of grid.children) card.setAttribute('aria-pressed',String(card === button));
        details();
      });
      return button;
    }));
    if (entries.length) details();
  }

  function open() {
    if (!ready() || dialog.open) return;
    clearMovement();
    refresh();
    dialog.showModal();
    search.focus({preventScroll:true});
  }

  search.addEventListener('input',refresh);
  rarity.addEventListener('change',refresh);
  $('dex-button').addEventListener('click',open);
  $('dex-close').addEventListener('click',() => dialog.close());
  $('dex-front').addEventListener('click',() => { face='front'; details(); });
  $('dex-back').addEventListener('click',() => { face='back'; details(); });

  return {open,get isOpen() { return dialog.open; },refresh() { if (dialog.open) refresh(); }};
}
