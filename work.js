import { arcadePayLimit, stockDestination, stockRunPay, stockRunState, stockStops } from './economy.js?v=store-economy-19';
import { huntReward } from './hunt.js?v=store-economy-19';
import { shiftReward } from './shift.js?v=store-economy-19';

const $ = id => document.getElementById(id);

export function createWork({shop,ready,clearMovement,announce,openMap,openShift}) {
  const dialog = $('work-dialog'), start = $('work-start'), status = $('work-status');
  let pending = false;

  function refresh() {
    const run = stockRunState(shop.state);
    const stop = stockDestination(run);
    $('work-wallet').textContent = shop.state.credits.toLocaleString('en-US')+' CR';
    $('work-progress').textContent = stop ? run.progress+' / '+stockStops.length+' delivered' : 'No active run';
    $('work-next').textContent = stop ? 'Next delivery · '+stop.label : 'Visit three delivery stops inside the store.';
    start.textContent = stop ? 'Continue run' : 'Start stock run';
    start.disabled = pending;
  }

  function open(atDesk = false) {
    if (dialog.open || !ready()) return;
    clearMovement();
    refresh();
    status.textContent = '';
    $('work-location').hidden = atDesk || stockRunState(shop.state).progress !== null;
    dialog.showModal();
    $('work-close').focus();
  }

  async function deliver() {
    if (pending) return;
    const run = stockRunState(shop.state);
    if (run.progress === null) return;
    pending = true;
    try {
      const result = await shop.deliverStock(run);
      if (result === true) announce('Stock run complete · +'+stockRunPay+' CR');
      else if (result) announce('Stock delivered · Next: '+result.label);
    } catch {
      announce('Could not save your delivery. Try again.');
    } finally {
      pending = false;
      refresh();
    }
  }

  start.addEventListener('click',async () => {
    if (pending) return;
    pending = true;
    refresh();
    try {
      const stop = await shop.startStockRun();
      if (!dialog.open) return;
      dialog.close();
      announce('Next delivery · '+stop.label);
    } catch {
      status.textContent = 'Could not save your stock run. Try again.';
    } finally {
      pending = false;
      refresh();
    }
  });
  $('work-close').addEventListener('click',() => dialog.close());
  $('work-map').addEventListener('click',() => { dialog.close(); openMap(); });
  $('work-shift').addEventListener('click',() => { dialog.close(); openShift(); });
  $('work-stock-pay').textContent = stockRunPay+' CR per run';
  $('work-neon-pay').textContent = 'Up to '+arcadePayLimit.neon+' CR';
  $('work-signal-pay').textContent = 'Up to '+arcadePayLimit.signal+' CR';
  $('work-circuit-pay').textContent = 'Up to '+arcadePayLimit.circuit+' CR';
  $('work-hunt-pay').textContent = huntReward+' CR';
  $('work-shift-pay').textContent = shiftReward+' CR';
  return {open,refresh,deliver,get isOpen(){return dialog.open;}};
}
