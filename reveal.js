import { GAMES, RARITIES } from './catalog.js';

export function createReveal({ paintCover, playSound, focusGame }) {
  const $ = id => document.getElementById(id);
  const dialog = $('reveal-dialog'), art = $('reveal-cover');
  const display = art.parentElement, sparks = $('reveal-sparks');
  const next = $('reveal-next');
  const particles = Array.from({length:16},(_,i) => {
    const spark = document.createElement('i');
    spark.style.setProperty('--angle',(i*137.5%360)+'deg');
    spark.style.setProperty('--distance',(55+i%5*17)+'px');
    spark.style.setProperty('--delay',(i%6*22)+'ms');
    return spark;
  });
  let games = [], current = 0, frame = 0;

  function render() {
    const index = games[current];
    const {title,rarity} = GAMES[index];
    const tier = RARITIES[rarity];
    dialog.style.setProperty('--reveal-color',tier.color);
    $('reveal-rarity').textContent = tier.label;
    $('reveal-name').textContent = title;
    $('reveal-title').textContent = games.length === 1 ? 'New game discovered' : 'New game '+(current+1)+' of '+games.length;
    $('reveal-next-label').textContent = current+1 < games.length ? 'Next game' : 'Back to the store';
    paintCover(art,index,'front');
    display.classList.remove('revealing');
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        display.classList.add('revealing');
        playSound(rarity);
      });
    });
  }

  function close() { dialog.close(); }
  next.addEventListener('click',() => {
    current++;
    if (current < games.length) render();
    else close();
  });
  $('reveal-close').addEventListener('click',close);
  dialog.addEventListener('close',() => {
    if (dialog.open) return;
    cancelAnimationFrame(frame);
    display.classList.remove('revealing');
    games = [];
    focusGame();
  });
  sparks.append(...particles);

  return {
    get open() { return dialog.open; },
    show(purchased) {
      if (!purchased.length) return;
      games = purchased;
      current = 0;
      render();
      dialog.showModal();
      next.focus({preventScroll:true});
    }
  };
}
