import { shopItems } from './cosmetics.js?v=character-11';

const $ = id => document.getElementById(id);
const money = value => value.toLocaleString('en-US')+' CR';
export const creatorIdPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

function parseMessages(data) {
  if (!Array.isArray(data)) throw Error('Invalid creator inbox.');
  const ids = new Set();
  return data.slice(0,100).flatMap(entry => {
    if (!entry || typeof entry.id !== 'string' || !creatorIdPattern.test(entry.id) ||
      ids.has(entry.id) || typeof entry.title !== 'string' || typeof entry.message !== 'string') return [];
    ids.add(entry.id);
    const credits = Number.isSafeInteger(entry.gift?.credits) && entry.gift.credits > 0 ? entry.gift.credits : 0;
    const item = typeof entry.gift?.item === 'string' && Object.hasOwn(shopItems,entry.gift.item) ? entry.gift.item : null;
    return [{id:entry.id,title:entry.title.slice(0,100),message:entry.message.slice(0,1800),credits,item}];
  });
}

export function createCreatorInbox(shop) {
  const list = $('creator-list'), status = $('creator-status');
  let messages = [], version = 0;

  function render() {
    const claimed = shop.state.creatorClaims;
    list.replaceChildren(...messages.map(entry => {
      const card = $('creator-card-template').content.firstElementChild.cloneNode(true);
      card.querySelector('h3').textContent = entry.title;
      card.querySelector('.creator-message').textContent = entry.message;
      const gift = card.querySelector('.creator-gift');
      gift.hidden = !entry.credits && !entry.item;
      if (!gift.hidden) {
        const rewards = [];
        if (entry.credits) rewards.push(money(entry.credits));
        if (entry.item) rewards.push(shopItems[entry.item].name);
        gift.querySelector('.creator-reward').textContent = rewards.join(' + ');
        const button = gift.querySelector('button');
        button.disabled = claimed.includes(entry.id);
        button.textContent = button.disabled ? 'Claimed' : 'Claim gift';
        button.addEventListener('click',async () => {
          button.disabled = true;
          try {
            const received = await shop.claimCreatorGift(entry);
            status.textContent = received ? 'Gift claimed. '+rewards.join(' + ')+' added to your save.' : 'This gift was already claimed.';
          } catch {
            button.disabled = false;
            status.textContent = 'Could not save your gift. Try again.';
          }
        });
      }
      return card;
    }));
  }

  return {
    render,
    async open() {
      const request = ++version;
      status.textContent = 'Checking for creator messages…';
      try {
        const response = await fetch('./creator-messages.json',{cache:'no-cache',signal:AbortSignal.timeout(6000)});
        if (!response.ok) throw Error('Creator inbox unavailable.');
        const data = parseMessages(await response.json());
        if (request !== version) return;
        messages = data;
        render();
        status.textContent = messages.length ? '' : 'No messages yet.';
      } catch {
        if (request !== version) return;
        status.textContent = 'Could not check for messages. Open From Creator to try again.';
      }
    }
  };
}
