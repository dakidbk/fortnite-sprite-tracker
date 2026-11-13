import { GAMES, LATEST_RELEASE, RARITIES } from './catalog.js';
import { listingQuote, listings, shopItems } from './cosmetics.js?v=character-11';

import { creatorIdPattern } from './creator.js?v=creator-inbox-8';

import { shiftState, shiftComplete, shiftReward } from './shift.js?v=shift-14';

const PROFILE_KEY = 'after-hours-collection-v1';
const STARTING_CREDITS = 120;
const $ = id => document.getElementById(id);
const price = index => RARITIES[GAMES[index].rarity].price;
const credits = value => value.toLocaleString('en-US') + ' CR';
const basketCost = basket => basket.reduce((sum,index) => sum + price(index),0);

function gameIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(index => Number.isInteger(index) && index >= 0 && index < GAMES.length))];
}

function removeFromBasket(profile, index) {
  if (!profile.basket.includes(index)) return profile;
  const caseSlots = { ...profile.caseSlots };
  delete caseSlots[index];
  return { ...profile, caseSlots, basket: profile.basket.filter(id => id !== index) };
}

function loadProfile(fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (!saved || typeof saved !== 'object') return fallback;
    const owned = gameIds(saved.owned);
    const basket = gameIds(saved.basket).filter(index => !owned.includes(index));
    const caseSlots = {};
    for (const index of [...owned,...basket]) {
      const slot = saved.caseSlots?.[index];
      if (Number.isSafeInteger(slot) && slot > 0) caseSlots[index] = slot;
    }
    return {
      credits: Number.isSafeInteger(saved.credits) && saved.credits >= 0 ? saved.credits : STARTING_CREDITS,
      owned,
      shift:saved.shift,
      creatorClaims: Array.isArray(saved.creatorClaims) ? [...new Set(saved.creatorClaims.filter(id => typeof id === 'string' && creatorIdPattern.test(id)))] : [],
      cosmetics: Object.keys(shopItems).filter(id => Array.isArray(saved.cosmetics) && saved.cosmetics.includes(id)),
      basket,
      caseSlots,
      arcadeEarned: saved.arcadeEarned === true,
      signalBest: Number.isInteger(saved.signalBest) ? Math.max(0, Math.min(8, saved.signalBest)) : 0
    };
  } catch {
    return fallback;
  }
}

export function createShop({ beforeOpen, onChange, paintCover, announce, onPurchase }) {
  const checkout = $('checkout-dialog'), collection = $('collection-dialog');
  let profile = loadProfile({ credits: STARTING_CREDITS, owned: [], cosmetics: [], creatorClaims: [], basket: [], caseSlots: {}, arcadeEarned: false, signalBest: 0 });
  let inspected = null;

  function renderWallet() {
    $('wallet-credits').textContent = credits(profile.credits);
    $('wallet-count').textContent = profile.basket.length
      ? profile.basket.length + ' in basket'
      : profile.owned.length + '/' + GAMES.length + ' collected';
    $('collection-button').setAttribute('aria-label','Open collection. ' + profile.credits + ' credits. ' + profile.owned.length + ' of ' + GAMES.length + ' games.');
  }

  function renderCase() {
    if (!inspected) return;
    const { index, copies } = inspected;
    const bought = profile.owned.includes(index);
    const added = profile.basket.includes(index);
    const remaining = copies - Number(bought || added);
    const stockLabel = index === LATEST_RELEASE ? '1 copy left' : remaining + (remaining === 1 ? ' copy in store' : ' copies in store');
    $('case-stock').textContent = remaining > 0 ? stockLabel : added ? 'In your basket' : 'Sold out';
    $('case-price').textContent = credits(price(index));
    const button = $('case-basket');
    button.disabled = bought;
    button.textContent = bought ? 'Collected' : added ? 'Remove from basket' : 'Add to basket';
    button.setAttribute('aria-pressed',String(added));
    $('case-basket-note').textContent = bought
      ? 'In your collection'
      : added ? 'Ready to pay at the checkout counter.' : 'Your wallet has ' + credits(profile.credits) + '.';
  }

  function renderCheckout() {
    const items = profile.basket.map(index => {
      const game = GAMES[index];
      const item = document.createElement('li');
      const name = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = game.title;
      const tier = document.createElement('span');
      tier.textContent = RARITIES[game.rarity].label;
      name.append(title,tier);
      const amount = document.createElement('b');
      amount.textContent = credits(price(index));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'basket-remove';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label','Remove ' + game.title + ' from basket');
      remove.addEventListener('click',() => commit(current => removeFromBasket(current,index)));
      item.append(name,amount,remove);
      return item;
    });
    const total = basketCost(profile.basket);
    const missing = Math.max(0,total - profile.credits);
    $('checkout-items').replaceChildren(...items);
    $('checkout-items').hidden = !items.length;
    $('checkout-empty').hidden = items.length > 0;
    $('checkout-total').textContent = credits(total);
    $('checkout-wallet').textContent = credits(profile.credits);
    $('checkout-status').textContent = missing ? 'Earn ' + credits(missing) + ' more at the arcade to buy this basket.' : '';
    const buy = $('checkout-buy');
    buy.disabled = !items.length || missing > 0;
    buy.textContent = items.length > 1 ? 'Buy ' + items.length + ' games' : 'Buy game';
  }

  function renderCollection() {
    const counts = {};
    for (const index of profile.owned) {
      const tier = GAMES[index].rarity;
      counts[tier] = (counts[tier] || 0) + 1;
    }
    $('collection-summary').textContent = profile.owned.length + ' of ' + GAMES.length + ' games collected';
    const progress = $('collection-progress');
    progress.setAttribute('aria-valuenow',String(profile.owned.length));
    $('collection-fill').style.width = 100 * profile.owned.length / GAMES.length + '%';
    $('collection-rarities').replaceChildren(...Object.entries(RARITIES).map(([key,tier]) => {
      const chip = document.createElement('li');
      chip.className = 'collection-tier';
      chip.style.setProperty('--tier-color',tier.color);
      chip.textContent = tier.label + ' ' + (counts[key] || 0);
      return chip;
    }));
    const cards = profile.owned.map(index => {
      const entry = GAMES[index], tier = RARITIES[entry.rarity];
      const card = document.createElement('li');
      const art = document.createElement('span');
      art.className = 'collection-art';
      art.setAttribute('aria-hidden','true');
      paintCover(art,index,'front');
      const title = document.createElement('strong');
      title.textContent = entry.title;
      const label = document.createElement('span');
      label.className = 'collection-rank';
      label.style.color = tier.color;
      label.textContent = tier.label;
      card.append(art,title,label);
      return card;
    });
    $('collection-grid').replaceChildren(...cards);
    $('collection-grid').hidden = !cards.length;
    $('collection-empty').hidden = cards.length > 0;
  }

  function refresh() {
    renderWallet();
    renderCase();
    if (checkout.open) renderCheckout();
    if (collection.open) renderCollection();
    onChange();
  }

  function commit(change, requireSave = false) {
    const current = loadProfile(profile);
    const next = change(current);
    try { localStorage.setItem(PROFILE_KEY,JSON.stringify(next)); }
    catch (error) { if (requireSave) throw error; }
    profile = next;
    refresh();
  }

  function openCheckout() {
    beforeOpen();
    profile = loadProfile(profile);
    checkout.showModal();
    refresh();
    checkout.scrollTop = 0;
    $('checkout-close').focus();
  }

  function openCollection() {
    beforeOpen();
    profile = loadProfile(profile);
    collection.showModal();
    refresh();
    collection.scrollTop = 0;
    $('collection-close').focus();
  }

  $('case-basket').addEventListener('click',() => {
    if (!inspected) return;
    const { index, slot } = inspected;
    commit(current => {
      if (current.owned.includes(index)) return current;
      if (current.basket.includes(index)) return removeFromBasket(current,index);
      return { ...current, basket: [...current.basket,index], caseSlots: { ...current.caseSlots, [index]: slot } };
    });
  });
  $('checkout-buy').addEventListener('click',() => {
    let purchased = [];
    commit(current => {
      const due = basketCost(current.basket);
      if (!current.basket.length || due > current.credits) return current;
      purchased = current.basket;
      return { ...current, shift:{...shiftState(current),purchase:true}, credits: current.credits - due, owned: [...current.owned,...purchased], basket: [] };
    });
    if (purchased.length) {
      checkout.close();
      onPurchase(purchased);
    }
  });
  $('checkout-close').addEventListener('click',() => checkout.close());
  $('collection-close').addEventListener('click',() => collection.close());
  window.addEventListener('storage',event => {
    if (event.key !== PROFILE_KEY) return;
    profile = loadProfile(profile);
    refresh();
  });
  renderWallet();

  return {
    get state() { return profile; },
    get basketTotal() { return basketCost(profile.basket); },
    get open() { return checkout.open || collection.open; },
    inspect(index, slot, copies) { inspected = { index, slot, copies }; renderCase(); },
    clearInspection() { inspected = null; },
    openCheckout,
    openCollection,
    recordInspection(index) {
      const state = shiftState(profile);
      if (state.inspected.length >= 3 || state.inspected.includes(index)) return;
      commit(current => {
        const shift = shiftState(current);
        return {...current,shift:{...shift,inspected:[...new Set([...shift.inspected,index])].slice(0,3)}};
      });
    },
    async claimShift() {
      const claim = () => {
        let claimed = false;
        commit(current => {
          const shift = shiftState(current);
          if (shift.claimed || !shiftComplete(shift)) return current;
          claimed = true;
          return {...current,credits:Math.min(Number.MAX_SAFE_INTEGER,current.credits+shiftReward),
            shift:{...shift,claimed:true}};
        },true);
        if (claimed) announce('Shift complete · +'+shiftReward+' CR');
        return claimed;
      };
      return navigator.locks ? navigator.locks.request('after-hours-shift-reward',claim) : claim();
    },
    async claimCreatorGift({id,credits,item}) {
      if (!creatorIdPattern.test(id) || (!credits && !item)) return false;
      const claim = () => {
        let claimed = false;
        commit(current => {
          if (current.creatorClaims.includes(id)) return current;
          claimed = true;
          const cosmetics = item && !current.cosmetics.includes(item) ? [...current.cosmetics,item] : current.cosmetics;
          return {...current,cosmetics,credits:Math.min(Number.MAX_SAFE_INTEGER,current.credits+credits),
            creatorClaims:[...current.creatorClaims,id]};
        },true);
        return claimed;
      };
      return navigator.locks ? navigator.locks.request('after-hours-creator-gift',claim) : claim();
    },
    buyCosmetic(id) {
      if (!Object.hasOwn(listings,id)) return false;
      let purchased = false;
      commit(current => {
        const {missing,cost} = listingQuote(id,current.cosmetics);
        if (!missing.length || current.credits < cost) return current;
        purchased = true;
        return {...current,credits:current.credits-cost,cosmetics:[...current.cosmetics,...missing]};
      });
      return purchased;
    },
    recordArcade(mode, score) {
      const reward = mode === 'signal'
        ? score * 11 + (score >= 5 ? 22 : 0)
        : Math.floor(score / 25) + (score >= 800 ? 25 : 0);
      if (reward) commit(current => ({
        ...current,
        credits: Math.min(Number.MAX_SAFE_INTEGER,current.credits + reward),
        arcadeEarned: true,
        shift:{...shiftState(current),arcade:true},
        signalBest: mode === 'signal' ? Math.max(current.signalBest,score) : current.signalBest
      }));
      return reward;
    }
  };
}
