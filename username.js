const endpoint = 'https://fwjthjqevmukrovpbvfx.supabase.co/functions/v1/game-rooms';
const tokenKey = 'after-hours-profile-token';
const nameKey = 'after-hours-username';
const format = /^[A-Za-z][A-Za-z0-9_]{2,15}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function profileToken() {
  try {
    const token = localStorage.getItem(tokenKey);
    return uuid.test(token || '') ? token : undefined;
  } catch {
    return undefined;
  }
}

export function profileUsername() {
  try {
    const saved = localStorage.getItem(nameKey);
    return profileToken() && format.test(saved || '') ? saved : '';
  } catch {
    return '';
  }
}

export function createUsernameEditor({prefix='username',onSave}={}) {
  const $ = id => document.getElementById(id);
  const form = $(prefix+'-form'), field = $(prefix+'-field');
  const status = $(prefix+'-status'), submit = $(prefix+'-save');
  const refresh = () => { $('menu-current-name').textContent = profileUsername() || 'Set username'; };
  refresh();

  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const username = field.value.trim();
    if (!format.test(username)) {
      status.textContent = 'Use 3–16 letters, numbers or underscores, starting with a letter.';
      field.focus();
      return;
    }
    submit.disabled = true;
    status.textContent = 'Checking username…';
    try {
      const token = profileToken() || crypto.randomUUID();
      try {
        localStorage.setItem(tokenKey,token);
      } catch {
        throw Error('Enable browser storage to save your username.');
      }
      const response = await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        signal:AbortSignal.timeout(6500),
        body:JSON.stringify({op:'username',username,profileToken:token})
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not save your username. Try again.');
      localStorage.setItem(nameKey,result.username);
      field.value = result.username;
      refresh();
      status.textContent = 'Username saved.';
      onSave?.();
    } catch (error) {
      status.textContent = error.name === 'Error' ? error.message : 'Could not reach the username server. Try again.';
    } finally {
      submit.disabled = false;
    }
  });

  return {
    open() {
      field.value = profileUsername();
      if (!submit.disabled) status.textContent = '';
      field.focus({preventScroll:true});
    }
  };
}
