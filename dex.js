import { GAMES, RARITIES } from './catalog.js';

const $ = id => document.getElementById(id);

export function createDex({getProfile, paintCover, clearMovement, ready}) {
  const dialog = $('dex-dialog'), grid = $('dex-grid'), search = $('dex-search');
  const rarity = $('dex-rarity'), ownedFilter = $('dex-ownership');
  let selected = 0, face = 'front';
  rarity.append(...Object.entries(RARITIES).map(([key,tier]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = tier.label;
    return option;
  }));

  function details() {
    const game = GAMES[selected], tier = RARITIES[game.rarity];
    const {owned,basket} = getProfile();
    $('dex-entry-number').textContent = '#'+String(selected+1).padStart(3,'0');
    $('dex-entry-title').textContent = game.title;
    $('dex-entry-genre').textContent = game.genre;
    $('dex-entry-description').textContent = game.blurb;
    $('dex-entry-rarity').textContent = tier.label;
    $('dex-entry-rarity').style.color = tier.color;
    $('dex-entry-price').textContent = tier.price+' CR';
    $('dex-entry-status').textContent = owned.includes(selected) ? 'Collected' : basket.includes(selected) ? 'In your basket' : 'Not collected · Find this case in the store';
    const art = $('dex-entry-art');
    paintCover(art,selected,face);
    art.setAttribute('aria-label',(face === 'front' ? 'Front' : 'Back')+' cover of '+game.title);
    $('dex-front').setAttribute('aria-pressed',String(face === 'front'));
    $('dex-back').setAttribute('aria-pressed',String(face === 'back'));
  }

  function refresh() {
    const owned = new Set(getProfile().owned);
    const query = search.value.trim().toLowerCase();
    const entries = GAMES.map((game,index) => ({game,index})).filter(({game,index}) =>
      (!query || (game.title+' '+game.genre).toLowerCase().includes(query)) &&
      (!rarity.value || game.rarity === rarity.value) &&
      (ownedFilter.value === 'all' || (ownedFilter.value === 'owned') === owned.has(index)));
    $('dex-progress-text').textContent = owned.size+' / '+GAMES.length+' collected';
    $('dex-progress').value = owned.size;
    $('dex-results').textContent = entries.length+' '+(entries.length === 1 ? 'game' : 'games');
    $('dex-empty').hidden = !!entries.length;
    $('dex-detail').hidden = !entries.length;
    if (!entries.some(entry => entry.index === selected)) {
      selected = entries[0]?.index ?? 0;
      face = 'front';
    }
    grid.replaceChildren(...entries.map(({game,index}) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dex-card';
      button.dataset.game = index;
      button.setAttribute('aria-pressed',String(index === selected));
      const art = document.createElement('span');
      art.className = 'collection-art';
      art.setAttribute('aria-hidden','true');
      paintCover(art,index,'front');
      const label = document.createElement('strong');
      label.textContent = game.title;
      const state = document.createElement('span');
      state.className = 'dex-card-state';
      state.textContent = '#'+String(index+1).padStart(3,'0')+' · '+(owned.has(index) ? 'Collected' : 'Missing');
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

  for (const input of [search,rarity,ownedFilter]) input.addEventListener(input === search ? 'input' : 'change',refresh);
  $('dex-button').addEventListener('click',open);
  $('dex-close').addEventListener('click',() => dialog.close());
  $('dex-front').addEventListener('click',() => { face='front'; details(); });
  $('dex-back').addEventListener('click',() => { face='back'; details(); });

  return {open,get isOpen() { return dialog.open; },refresh() { if (dialog.open) refresh(); }};
}
