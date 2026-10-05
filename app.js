'use strict';

/* =========================================================
   Life Managed
   Tracks renewals, bills, contracts and subscriptions, plus
   weekly/monthly spending budgets with rewards for progress.
   Everything is stored only on this device (localStorage).
   ========================================================= */

const STORE_KEY = 'lifemanaged.v1';
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = (v, fallback = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback; };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = n => CAD.format(n || 0);

/* ---------- What can be tracked ---------- */

const CATS = [
  { id: 'documents', label: 'Documents', one: 'document', emoji: '🪪', date: 'Expires on', verb: 'Renewed', repeat: '5y', remind: 60,
    templates: [['Driver’s licence', '5y', 60], ['Passport', '10y', 180], ['Health card', '5y', 60], ['Licence plate renewal', 'yearly', 30], ['PR card', '5y', 180], ['NEXUS card', '5y', 90]] },
  { id: 'memberships', label: 'Memberships', one: 'membership', emoji: '🛒', date: 'Renews on', verb: 'Renewed', repeat: 'yearly', remind: 14,
    templates: [['Costco', 'yearly', 14], ['Walmart+', 'monthly', 3], ['Voilà delivery pass', 'monthly', 3], ['Gym', 'monthly', 3], ['Amazon Prime', 'yearly', 14]] },
  { id: 'bills', label: 'Bills', one: 'bill', emoji: '🧾', date: 'Due on', verb: 'Paid', repeat: 'monthly', remind: 3,
    templates: [['Hydro', 'monthly', 3], ['Gas', 'monthly', 3], ['Water', 'quarterly', 7], ['Internet', 'monthly', 3], ['Credit card', 'monthly', 5], ['Rent', 'monthly', 3], ['Property tax', 'quarterly', 14]] },
  { id: 'contracts', label: 'Contracts', one: 'contract', emoji: '📝', date: 'Term ends on', verb: 'Renewed', repeat: 'none', remind: 90,
    templates: [['Phone plan', 'none', 60], ['Mortgage term', 'none', 120], ['Car lease', 'none', 90], ['Internet contract', 'none', 60]] },
  { id: 'insurance', label: 'Insurance', one: 'policy', emoji: '🛡️', date: 'Renews on', verb: 'Renewed', repeat: 'yearly', remind: 30,
    templates: [['Car insurance', 'yearly', 30], ['Home insurance', 'yearly', 30], ['Tenant insurance', 'yearly', 30], ['Life insurance', 'yearly', 30], ['Pet insurance', 'monthly', 3]] },
  { id: 'apps', label: 'App subscriptions', one: 'subscription', emoji: '📱', date: 'Renews on', verb: 'Paid', repeat: 'monthly', remind: 3,
    templates: [['iCloud+', 'monthly', 3], ['Google One', 'monthly', 3], ['Microsoft 365', 'yearly', 14], ['Duolingo', 'yearly', 14]] },
  { id: 'streaming', label: 'Streaming', one: 'service', emoji: '📺', date: 'Renews on', verb: 'Paid', repeat: 'monthly', remind: 3,
    templates: [['Netflix', 'monthly', 3], ['Disney+', 'monthly', 3], ['Crave', 'monthly', 3], ['Spotify', 'monthly', 3], ['Apple TV+', 'monthly', 3], ['YouTube Premium', 'monthly', 3]] },
];
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));

const REPEATS = {
  none: { label: 'Doesn’t repeat', months: 0 },
  weekly: { label: 'Every week', days: 7 },
  biweekly: { label: 'Every 2 weeks', days: 14 },
  monthly: { label: 'Every month', months: 1 },
  quarterly: { label: 'Every 3 months', months: 3 },
  yearly: { label: 'Every year', months: 12 },
  '2y': { label: 'Every 2 years', months: 24 },
  '5y': { label: 'Every 5 years', months: 60 },
  '10y': { label: 'Every 10 years', months: 120 },
};
const REMIND_OPTIONS = [[0, 'On the day'], [1, '1 day before'], [3, '3 days before'], [7, '1 week before'], [14, '2 weeks before'], [30, '1 month before'], [60, '2 months before'], [90, '3 months before'], [120, '4 months before'], [180, '6 months before']];

const BUDGET_PRESETS = [
  { name: 'Coffee & tea', emoji: '☕', period: 'weekly', limit: 25 },
  { name: 'Groceries', emoji: '🛒', period: 'weekly', limit: 150 },
  { name: 'Fun', emoji: '🎉', period: 'monthly', limit: 200 },
  { name: 'Eating out', emoji: '🍔', period: 'monthly', limit: 150 },
  { name: 'Shopping', emoji: '🛍️', period: 'monthly', limit: 100 },
];

const STICKERS = [
  ['🦊', 'Clever Fox'], ['🐢', 'Steady Turtle'], ['🦉', 'Wise Owl'], ['🐝', 'Busy Bee'], ['🦄', 'Unicorn'], ['🐙', 'Octo-Organizer'],
  ['🌵', 'Cool Cactus'], ['🌻', 'Sunflower'], ['🍀', 'Lucky Clover'], ['🌈', 'Rainbow'], ['⭐', 'Gold Star'], ['🚀', 'Rocket'],
  ['🎈', 'Balloon'], ['🧁', 'Cupcake'], ['🍩', 'Donut'], ['🍓', 'Strawberry'], ['🥑', 'Avocado'], ['🐧', 'Penguin'],
  ['🦋', 'Butterfly'], ['🐳', 'Whale'], ['🦔', 'Hedgehog'], ['🐼', 'Panda'], ['🦁', 'Lion'], ['🐸', 'Frog'],
  ['🍄', 'Mushroom'], ['🌙', 'Moon'], ['🔥', 'On Fire'], ['💎', 'Gem'], ['🎯', 'Bullseye'], ['🏅', 'Medal'],
  ['👑', 'Crown'], ['🪴', 'Houseplant'], ['🦦', 'Otter'], ['🐨', 'Koala'], ['🍁', 'Maple Leaf'], ['🧭', 'Compass'],
];
const CHEERS = ['Nice work!', 'On it!', 'Look at you go!', 'So organized!', 'Crushed it!', 'Way to go!'];

/* ---------- Dates ---------- */

const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const isValidDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseDay(s));
function addMonths(d, months, anchorDay) {
  const y = d.getFullYear(), m = d.getMonth() + months;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(anchorDay || d.getDate(), lastDay));
}
function fmtDate(s, { weekday = false } = {}) {
  const d = parseDay(s);
  return d.toLocaleDateString('en-CA', { weekday: weekday ? 'short' : undefined, month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/* ---------- State ---------- */

function freshState() {
  return {
    version: 1,
    items: [],
    budgets: [],
    spends: [],
    rewards: { log: [], claimed: {} },
    settings: { remindHour: 9, notifications: false },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshState();
    return normalize(JSON.parse(raw));
  } catch (e) {
    return freshState();
  }
}

/** Fill in anything missing, so older saves and imported backups always work. */
function normalize(s) {
  const base = freshState();
  if (!s || typeof s !== 'object') return base;
  return {
    version: 1,
    items: Array.isArray(s.items) ? s.items.filter(i => i && i.id && CAT[i.cat] && isValidDay(i.due)) : [],
    budgets: Array.isArray(s.budgets) ? s.budgets.filter(b => b && b.id && num(b.limit) > 0) : [],
    spends: Array.isArray(s.spends) ? s.spends.filter(x => x && x.id && x.budgetId && isValidDay(x.date)) : [],
    rewards: { log: Array.isArray(s.rewards?.log) ? s.rewards.log : [], claimed: s.rewards?.claimed && typeof s.rewards.claimed === 'object' ? s.rewards.claimed : {} },
    settings: { ...base.settings, ...(s.settings || {}) },
  };
}

let state = loadState();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Couldn’t save on this device. Is storage full or blocked?'); }
  if (window.Native && Native.on) Native.queueReschedule();
}

/* ---------- Tracked items ---------- */

const daysLeft = item => daysBetween(today(), parseDay(item.due));

function itemStatus(item) {
  if (item.done) return 'done';
  const d = daysLeft(item);
  if (d < 0) return 'overdue';
  if (d <= num(item.remind)) return 'soon';
  return 'ok';
}

function dueText(item) {
  if (item.done) return `Finished ${fmtDate(item.doneAt || item.due)}`;
  const d = daysLeft(item);
  if (d < 0) return `${plural(-d, 'day')} overdue`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 60) return `In ${d} days`;
  if (d < 730) return `In ${Math.round(d / 30.4)} months`;
  return `In ${Math.round(d / 365)} years`;
}

/** The date after `due` for a repeating item, or null if it doesn't repeat. */
function nextDue(item, due = item.due) {
  const r = REPEATS[item.repeat] || REPEATS.none;
  const d = parseDay(due);
  if (r.days) return dayKey(addDays(d, r.days));
  if (r.months) return dayKey(addMonths(d, r.months, item.anchor));
  return null;
}

/** Roughly what a repeating item costs per month, for totals. */
function monthlyCost(item) {
  if (item.done || !item.amount) return 0;
  const r = REPEATS[item.repeat] || REPEATS.none;
  if (r.days) return item.amount * (365 / 12) / r.days;
  if (r.months) return item.amount / r.months;
  return 0;
}

/** Auto-pay items roll over to their next date on their own once the due date passes. */
function rollAutopay() {
  const t = dayKey(today());
  let changed = false;
  for (const item of state.items) {
    if (!item.autopay || item.done || item.repeat === 'none') continue;
    let guard = 0;
    while (item.due < t && guard++ < 500) {
      const next = nextDue(item);
      if (!next) break;
      item.history = [...(item.history || []), { due: item.due, at: item.due, auto: true }].slice(-12);
      item.due = next;
      changed = true;
    }
  }
  if (changed) save();
}

function markDone(id) {
  const item = state.items.find(i => i.id === id);
  if (!item || item.done) return;
  const before = JSON.parse(JSON.stringify(item));
  const d = daysLeft(item);
  const t = dayKey(today());
  item.history = [...(item.history || []), { due: item.due, at: t }].slice(-12);
  const next = nextDue(item);
  let msg;
  if (next) {
    // Paying an old bill late moves it to the next upcoming cycle, not one that's already past.
    let due = next, guard = 0;
    while (due < t && guard++ < 500) due = nextDue(item, due);
    item.due = due;
    msg = `Next: ${fmtDate(due)}`;
  } else {
    item.done = true;
    item.doneAt = t;
    msg = 'Moved to Finished';
  }
  save();
  const undo = () => {
    Object.assign(item, before);
    if (!before.done) { delete item.done; delete item.doneAt; }
    if (stickerId) state.rewards.log = state.rewards.log.filter(r => r.id !== stickerId);
    save(); render(); toast('Undone');
  };
  let stickerId = null;
  if (d >= 0) {
    const s = awardSticker(`${CAT[item.cat].verb} ${item.name} ${d === 0 ? 'right on time' : 'ahead of time'}`);
    stickerId = s.id;
    render();
    celebrate(s, `${CAT[item.cat].verb} ${item.name} on time. ${msg}.`, undo);
  } else {
    render();
    confetti(30);
    toast(`${CAT[item.cat].verb}: ${item.name}. Better late than never! ${msg}.`, undo);
  }
}

/* ---------- Budgets ---------- */

function periodOf(budget, date = today()) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  if (budget.period === 'weekly') {
    const start = addDays(d, -((d.getDay() + 6) % 7)); // weeks start on Monday
    return { start, end: addDays(start, 6), key: `w${dayKey(start)}`, days: 7, name: 'week' };
  }
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start, end, key: `m${dayKey(start).slice(0, 7)}`, days: end.getDate(), name: 'month' };
}

function spendsIn(budget, p) {
  const a = dayKey(p.start), b = dayKey(p.end);
  return state.spends.filter(s => s.budgetId === budget.id && s.date >= a && s.date <= b);
}
const total = list => list.reduce((sum, s) => sum + num(s.amount), 0);

function budgetSummary(budget) {
  const p = periodOf(budget);
  const list = spendsIn(budget, p).sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  const spent = total(list);
  const elapsed = daysBetween(p.start, today()) + 1;
  const pace = budget.limit * elapsed / p.days;
  const level = spent > budget.limit ? 'over' : spent > pace ? 'warn' : 'ok';
  return { p, list, spent, left: budget.limit - spent, pace, paceFrac: elapsed / p.days, level, daysLeft: p.days - elapsed };
}

/** Consecutive finished periods (before this one) that stayed within budget. */
function streak(budget) {
  let n = 0, p = periodOf(budget);
  const created = budget.created || '0000-00-00';
  for (let i = 0; i < 104; i++) {
    p = periodOf(budget, addDays(p.start, -1));
    if (dayKey(p.end) < created) break;
    if (!state.spends.some(s => s.budgetId === budget.id && s.date <= dayKey(p.end))) break; // not in use yet
    if (total(spendsIn(budget, p)) > budget.limit) break;
    n++;
  }
  return n;
}

function logSpend(budgetId, amount, note) {
  const budget = state.budgets.find(b => b.id === budgetId);
  if (!budget || !(amount > 0)) return;
  state.spends.push({ id: uid(), budgetId, amount: Math.round(amount * 100) / 100, date: dayKey(today()), note: note.trim().slice(0, 80) });
  save();
  const s = budgetSummary(budget);
  const claimKey = `spend|${budget.id}|${dayKey(today())}`;
  if (s.level === 'ok' && !state.rewards.claimed[claimKey]) {
    // Staying on pace is progress: reward it, once per budget per day.
    state.rewards.claimed[claimKey] = 1;
    const sticker = awardSticker(`Stayed on track with ${budget.name}`);
    save(); render();
    celebrate(sticker, `${money(s.left)} left for ${budget.name} this ${s.p.name}, and you’re on pace.`);
  } else {
    render();
    if (s.level === 'over') toast(`Logged. ${money(-s.left)} over this ${s.p.name}. Next ${s.p.name} is a fresh start.`);
    else toast(`Logged. ${money(s.left)} left this ${s.p.name}.`);
  }
}

/** When a week or month ends within budget, celebrate it once. */
function checkFinishedPeriods() {
  for (const budget of state.budgets) {
    const last = periodOf(budget, addDays(periodOf(budget).start, -1));
    const key = `period|${budget.id}|${last.key}`;
    if (state.rewards.claimed[key]) continue;
    if ((budget.created || '') > dayKey(last.end)) continue;
    state.rewards.claimed[key] = 1;
    // Only count it if they were already logging spending by then; an unused budget isn't "under budget".
    const inUse = state.spends.some(s => s.budgetId === budget.id && s.date <= dayKey(last.end));
    const spent = total(spendsIn(budget, last));
    if (inUse && spent <= budget.limit) {
      const sticker = awardSticker(`Finished a ${last.name} under budget: ${budget.name}`);
      save();
      return celebrate(sticker, `Last ${last.name} you spent ${money(spent)} of ${money(budget.limit)} on ${budget.name}. You saved ${money(budget.limit - spent)}!`);
    }
  }
  save();
}

/* ---------- Rewards ---------- */

function awardSticker(reason) {
  const owned = new Set(state.rewards.log.map(r => r.art));
  const fresh = STICKERS.filter(s => !owned.has(s[0]));
  const pool = fresh.length ? fresh : STICKERS;
  const [art, name] = pool[Math.floor(Math.random() * pool.length)];
  const entry = { id: uid(), art, name, reason, at: new Date().toISOString(), isNew: !owned.has(art) };
  state.rewards.log.push(entry);
  save();
  return entry;
}

function celebrate(sticker, detail, undo) {
  confetti(80);
  const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)];
  openDialog(`
    <form method="dialog" class="reward">
      <span class="art" aria-hidden="true">${sticker.art}</span>
      <h2 id="dialog-title">${esc(cheer)}</h2>
      <p>${esc(detail)}</p>
      <p><strong>${sticker.isNew ? 'New sticker' : 'Another sticker'}: ${esc(sticker.name)}</strong></p>
      <div class="chips" style="justify-content:center">
        <button class="btn" value="ok" autofocus>Yay!</button>
        <a class="btn ghost" href="#rewards" data-action="close-dialog">See my stickers</a>
        ${undo ? '<button type="button" class="link-btn" data-action="undo">Undo</button>' : ''}
      </div>
    </form>`);
  pendingUndo = undo || null;
}

/* ---------- Little UI helpers ---------- */

let pendingUndo = null;
let toastTimer = null;
function toast(text, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(text)}</span>${undo ? '<button type="button" data-action="undo">Undo</button>' : ''}`;
  pendingUndo = undo || null;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 6000 : 3500);
}

function confetti(count = 60) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('#confetti');
  const colours = ['#F2A33A', '#1F6F6B', '#5FC2BA', '#E4572E', '#7FD49A', '#FFD166', '#9B8CFF'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colours[i % colours.length];
    p.style.setProperty('--dx', `${(Math.random() - .5) * 40}vw`);
    p.style.setProperty('--rot', `${(Math.random() - .5) * 1440}deg`);
    p.style.setProperty('--dur', `${1.3 + Math.random() * 1.2}s`);
    p.style.animationDelay = `${Math.random() * .25}s`;
    box.appendChild(p);
  }
  setTimeout(() => { box.innerHTML = ''; }, 2900);
}

function openDialog(html) {
  const dlg = $('#dialog');
  dlg.innerHTML = html;
  if (!dlg.open) dlg.showModal();
  const first = dlg.querySelector('[autofocus]') || dlg.querySelector('input, select, button');
  if (first && first.focus) first.focus();
}
function closeDialog() { const dlg = $('#dialog'); if (dlg.open) dlg.close(); }

const options = (pairs, selected) => pairs.map(([v, label]) => `<option value="${esc(v)}"${String(v) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`).join('');

/* ---------- Views ---------- */

const activeItems = () => state.items.filter(i => !i.done).sort((a, b) => a.due.localeCompare(b.due));

function itemRow(item) {
  const c = CAT[item.cat], st = itemStatus(item);
  const pill = st === 'overdue' ? `<span class="pill overdue">${esc(dueText(item))}</span>`
    : st === 'soon' ? `<span class="pill soon">${esc(dueText(item))}</span>`
    : st === 'done' ? `<span class="pill good">Finished</span>`
    : `<span>${esc(dueText(item))}</span>`;
  const extra = [
    item.done ? '' : `<span>${esc(c.date.replace(' on', ''))} ${esc(fmtDate(item.due))}</span>`,
    item.amount ? `<span>${money(item.amount)}${item.repeat !== 'none' ? ' · ' + esc(REPEATS[item.repeat].label.toLowerCase()) : ''}</span>` : '',
    item.autopay ? '<span>Auto-pay</span>' : '',
  ].join('');
  return `
    <div class="item ${st}${item.done ? ' is-done' : ''}" data-action="edit-item" data-id="${esc(item.id)}" role="button" tabindex="0" aria-label="Edit ${esc(item.name)}">
      <span class="emoji" aria-hidden="true">${c.emoji}</span>
      <div>
        <div class="name">${esc(item.name)}</div>
        <div class="meta">${pill}${extra}</div>
      </div>
      <div class="actions">
        ${item.done ? '' : `<button class="btn small ${st === 'ok' ? 'ghost' : ''}" type="button" data-action="done-item" data-id="${esc(item.id)}">✓ ${esc(c.verb)}</button>`}
      </div>
    </div>`;
}

function budgetMini(b) {
  const s = budgetSummary(b);
  const pct = Math.min(100, s.spent / b.limit * 100);
  return `
    <a class="card" href="#budgets" style="text-decoration:none;color:inherit">
      <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px">
        <strong>${esc(b.emoji)} ${esc(b.name)}</strong>
        <span class="muted">${s.left >= 0 ? `${money(s.left)} left` : `${money(-s.left)} over`}</span>
      </div>
      <div class="bar"><div class="fill ${s.level}" style="width:${pct}%"></div><div class="pace" style="left:${Math.min(100, s.paceFrac * 100)}%"></div></div>
    </a>`;
}

function catChooser() {
  return `<div class="chips" style="justify-content:center">${CATS.map(c => `<button class="chip" type="button" data-action="add-cat" data-cat="${c.id}">${c.emoji} ${esc(c.label)}</button>`).join('')}</div>`;
}

function viewHome() {
  const items = activeItems();
  const now = today();
  const head = `
    <div class="page-head">
      <div><h1>Upcoming</h1><p class="muted">${esc(now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }))}</p></div>
    </div>`;

  if (!items.length && !state.budgets.length && !state.items.length) {
    return head + `
      <div class="card empty">
        <div class="big" aria-hidden="true">🗓️</div>
        <h2>Never miss a deadline again</h2>
        <p class="muted">Add the things you need to renew, pay or cancel on time. Life Managed reminds you before they’re due. Everything stays on this device.</p>
        <p><strong>What would you like to track first?</strong></p>
        ${catChooser()}
        <p style="margin-top:18px"><button class="link-btn" type="button" data-action="add-budget">Or set a spending budget →</button></p>
      </div>`;
  }

  const attention = items.filter(i => itemStatus(i) !== 'ok');
  const later = items.filter(i => itemStatus(i) === 'ok' && daysLeft(i) <= 120).slice(0, 8);
  const overdue = attention.filter(i => itemStatus(i) === 'overdue').length;
  const next30 = items.filter(i => { const d = daysLeft(i); return d >= 0 && d <= 30; }).length;
  const perMonth = items.reduce((sum, i) => sum + monthlyCost(i), 0);

  return head + `
    <div class="stats">
      <div class="stat ${overdue ? 'bad' : ''}"><b>${overdue}</b><span>Overdue</span></div>
      <div class="stat ${next30 ? 'warn' : ''}"><b>${next30}</b><span>Due in 30 days</span></div>
      <div class="stat"><b>${money(perMonth).replace(/\.\d\d$/, '')}</b><span>Recurring / month</span></div>
    </div>

    <div class="section"><h2>Needs attention</h2></div>
    ${attention.length ? attention.map(itemRow).join('') : `<div class="card muted">Nothing needs your attention right now. 🎉</div>`}

    <div class="section"><h2>Coming up</h2><a href="#all">See everything</a></div>
    ${later.length ? later.map(itemRow).join('') : `<div class="card muted">Nothing else in the next 4 months.</div>`}

    <div class="section"><h2>Budgets</h2>${state.budgets.length ? '<a href="#budgets">Log spending</a>' : ''}</div>
    ${state.budgets.length
      ? `<div class="mini-budgets">${state.budgets.map(budgetMini).join('')}</div>`
      : `<div class="card"><p class="muted" style="margin-bottom:10px">Set a weekly or monthly budget, like coffee or groceries, and earn stickers for staying on track.</p><button class="btn" type="button" data-action="add-budget">Set a budget</button></div>`}`;
}

let filter = 'all';
function viewAll() {
  const active = state.items.filter(i => !i.done);
  const finished = state.items.filter(i => i.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  const counts = Object.fromEntries(CATS.map(c => [c.id, active.filter(i => i.cat === c.id).length]));
  const chips = `<div class="chips" role="group" aria-label="Filter by type">
    <button class="chip" type="button" data-action="filter" data-cat="all" aria-pressed="${filter === 'all'}">All (${active.length})</button>
    ${CATS.map(c => `<button class="chip" type="button" data-action="filter" data-cat="${c.id}" aria-pressed="${filter === c.id}">${c.emoji} ${esc(c.label)} (${counts[c.id]})</button>`).join('')}
  </div>`;

  const groups = CATS.filter(c => filter === 'all' || filter === c.id).map(c => {
    const list = active.filter(i => i.cat === c.id).sort((a, b) => a.due.localeCompare(b.due));
    if (!list.length && filter === 'all') return '';
    const monthly = list.reduce((sum, i) => sum + monthlyCost(i), 0);
    return `
      <div class="cat-head"><span aria-hidden="true" style="font-size:1.3rem">${c.emoji}</span><h2>${esc(c.label)}</h2>
        ${monthly ? `<span class="muted">≈ ${money(monthly)}/month</span>` : ''}
        <button class="link-btn" type="button" data-action="add-cat" data-cat="${c.id}" style="margin-left:auto">+ Add</button></div>
      ${list.length ? list.map(itemRow).join('') : `<div class="card muted">No ${esc(c.label.toLowerCase())} yet.</div>`}`;
  }).join('');

  const shownFinished = finished.filter(i => filter === 'all' || i.cat === filter);
  return `
    <div class="page-head"><div><h1>Everything</h1><p class="muted">All the renewals, bills and subscriptions you track.</p></div></div>
    ${chips}
    ${active.length || filter !== 'all' ? groups : `<div class="card empty" style="margin-top:16px"><p class="muted">You’re not tracking anything yet. What would you like to add?</p>${catChooser()}</div>`}
    ${shownFinished.length ? `<details style="margin-top:24px"><summary><strong>Finished (${shownFinished.length})</strong></summary><div style="margin-top:10px">${shownFinished.map(itemRow).join('')}</div></details>` : ''}`;
}

function viewBudgets() {
  const head = `
    <div class="page-head">
      <div><h1>Budgets</h1><p class="muted">Log what you spend. Stay on pace to earn stickers.</p></div>
      ${state.budgets.length ? '<button class="btn" type="button" data-action="add-budget">＋ New budget</button>' : ''}
    </div>`;
  if (!state.budgets.length) {
    return head + `
      <div class="card empty">
        <div class="big" aria-hidden="true">💰</div>
        <h2>Set your first budget</h2>
        <p class="muted">Pick one to start. You can change the amount.</p>
        <div class="chips" style="justify-content:center">
          ${BUDGET_PRESETS.map((p, i) => `<button class="chip" type="button" data-action="add-budget" data-preset="${i}">${p.emoji} ${esc(p.name)}</button>`).join('')}
          <button class="chip" type="button" data-action="add-budget">✏️ Something else</button>
        </div>
      </div>`;
  }
  return head + `<div class="stack">${state.budgets.map(b => {
    const s = budgetSummary(b), st = streak(b);
    const pct = Math.min(100, s.spent / b.limit * 100);
    const paceNote = s.level === 'over' ? `<span class="pill overdue">Over budget</span>`
      : s.level === 'warn' ? `<span class="pill soon">Ahead of pace</span>`
      : `<span class="pill good">On track</span>`;
    return `
      <section class="card budget" aria-label="${esc(b.name)} budget">
        <div class="top">
          <span class="emoji" aria-hidden="true">${esc(b.emoji)}</span>
          <div class="grow">
            <h3>${esc(b.name)}</h3>
            <span class="muted" style="font-size:.85rem">${money(b.limit)} per ${s.p.name} · ${s.daysLeft ? `${plural(s.daysLeft, 'day')} left` : `last day of the ${s.p.name}`}</span>
          </div>
          ${paceNote}
          <button class="link-btn" type="button" data-action="edit-budget" data-id="${esc(b.id)}" aria-label="Edit ${esc(b.name)}">Edit</button>
        </div>
        <div class="numbers"><span><strong>${money(s.spent)}</strong> spent</span><span>${s.left >= 0 ? `<strong>${money(s.left)}</strong> left` : `<strong style="color:var(--coral)">${money(-s.left)}</strong> over`}</span></div>
        <div class="bar" role="img" aria-label="${Math.round(pct)}% of budget spent"><div class="fill ${s.level}" style="width:${pct}%"></div><div class="pace" style="left:${Math.min(100, s.paceFrac * 100)}%"></div></div>
        <div class="bar-legend">The line shows where you’d be if you spread it evenly. ${st ? `<span class="streak">🔥 ${plural(st, b.period === 'weekly' ? 'week' : 'month')} in a row under budget</span>` : ''}</div>
        <form class="spend-form" data-form="spend" data-id="${esc(b.id)}">
          <input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="$0.00" aria-label="Amount spent" required>
          <input name="note" type="text" maxlength="80" placeholder="What for?" aria-label="What for">
          <button class="btn" type="submit">Add</button>
        </form>
        ${s.list.length ? `<ul class="spends">${s.list.slice(0, 8).map(x => `
          <li><span class="muted">${esc(fmtDate(x.date))}</span><span class="grow">${esc(x.note || '')}</span><strong>${money(x.amount)}</strong>
          <button class="x" type="button" data-action="delete-spend" data-id="${esc(x.id)}" aria-label="Remove ${money(x.amount)}">✕</button></li>`).join('')}</ul>` : ''}
      </section>`;
  }).join('')}</div>`;
}

function viewRewards() {
  const log = state.rewards.log;
  const counts = {};
  for (const r of log) counts[r.art] = (counts[r.art] || 0) + 1;
  const collected = Object.keys(counts).length;
  const best = state.budgets.reduce((m, b) => Math.max(m, streak(b)), 0);
  return `
    <div class="page-head"><div><h1>Rewards</h1><p class="muted">Pay on time, renew early and stay on budget to fill your sticker shelf.</p></div></div>
    <div class="stats">
      <div class="stat"><b>${log.length}</b><span>Stickers earned</span></div>
      <div class="stat"><b>${collected}/${STICKERS.length}</b><span>Collected</span></div>
      <div class="stat"><b>${best}</b><span>Best budget streak</span></div>
    </div>
    <div class="section"><h2>Sticker shelf</h2></div>
    <div class="shelf">
      ${[...STICKERS].sort((a, b) => !counts[a[0]] - !counts[b[0]]).map(([art, name]) => counts[art]
        ? `<div class="sticker"><span class="art" aria-hidden="true">${art}</span><span class="label">${esc(name)}</span>${counts[art] > 1 ? `<span class="count">×${counts[art]}</span>` : ''}</div>`
        : `<div class="sticker locked" aria-label="Not collected yet"><span class="art" aria-hidden="true">${art}</span><span class="label">???</span></div>`).join('')}
    </div>
    <div class="section"><h2>Recent wins</h2></div>
    ${log.length ? `<ul class="log card">${log.slice(-15).reverse().map(r => `<li><span class="art" aria-hidden="true">${r.art}</span><span>${esc(r.reason)}<br><span class="muted" style="font-size:.8rem">${esc(new Date(r.at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }))}</span></span></li>`).join('')}</ul>`
      : `<div class="card muted">Your first sticker is one on-time payment away.</div>`}`;
}

function viewSettings() {
  const hours = Array.from({ length: 24 }, (_, h) => [h, new Date(2000, 0, 1, h).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })]);
  const native = window.Native && Native.on;
  const notifBlock = native
    ? (Native.permission === 'granted'
      ? `<label class="check"><input type="checkbox" data-action="toggle-notifs" ${state.settings.notifications ? 'checked' : ''}> Send me reminders</label>
         <p style="margin-top:10px"><button class="btn ghost small" type="button" data-action="test-notif">Send a test</button></p>`
      : `<p>Allow notifications so reminders reach you even when the app is closed.</p>
         <button class="btn" type="button" data-action="enable-notifs">Turn on reminders</button>
         ${Native.permission === 'denied' ? '<p class="hint">Notifications are blocked. Turn them on for Life Managed in your phone’s Settings.</p>' : ''}`)
    : `<p class="note">On the website, Life Managed shows what’s due whenever you open it. To get reminders as notifications, even when the app is closed, install the Life Managed app for iPhone or Android.</p>`;
  return `
    <div class="page-head"><div><h1>Settings</h1></div></div>
    <div class="stack">
      <section class="card">
        <h2>Reminders</h2>
        ${notifBlock}
        <div class="field" style="margin-top:14px;max-width:260px">
          <label for="remind-hour">Remind me at</label>
          <select id="remind-hour" data-action="remind-hour">${options(hours, state.settings.remindHour)}</select>
        </div>
      </section>
      <section class="card">
        <h2>Backup</h2>
        <p class="muted">Your information is only on this device. Save a backup file now and then, and use it to move to a new phone or computer.</p>
        <div class="chips">
          <button class="btn" type="button" data-action="export">Save a backup</button>
          <label class="btn ghost" style="margin:0">Restore from backup<input type="file" accept="application/json,.json" data-action="import" hidden></label>
        </div>
      </section>
      <section class="card">
        <h2>Privacy</h2>
        <p class="muted" style="margin:0">No account, no ads, no tracking. What you add to Life Managed is saved only on this device and never sent anywhere.</p>
      </section>
      <section class="card danger-zone">
        <h2>Start over</h2>
        <p class="muted">Delete everything you’ve added, including budgets and stickers. This can’t be undone.</p>
        <button class="btn danger" type="button" data-action="wipe">Delete all my data</button>
      </section>
    </div>`;
}

const VIEWS = { home: viewHome, all: viewAll, budgets: viewBudgets, rewards: viewRewards, settings: viewSettings };
const route = () => { const r = location.hash.replace('#', ''); return VIEWS[r] ? r : 'home'; };

function render() {
  const r = route();
  $('#view').innerHTML = VIEWS[r]();
  document.querySelectorAll('[data-tab]').forEach(a => {
    const on = a.dataset.tab === r;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('.fab').setAttribute('aria-label', r === 'budgets' ? 'Add a budget' : 'Add something to track');
  $('.fab').hidden = r === 'settings' || r === 'rewards';
}

/* ---------- Dialogs ---------- */

function itemDialog(item, catId) {
  const isNew = !item;
  const c = CAT[item?.cat || catId || 'bills'];
  const it = item || { name: '', cat: c.id, due: '', repeat: c.repeat, remind: c.remind, amount: '', autopay: false, notes: '' };
  openDialog(`
    <form data-form="item" data-id="${esc(item?.id || '')}">
      <div class="d-head"><h2 id="dialog-title">${isNew ? 'Add something to track' : 'Edit'}</h2><button type="button" class="close" data-action="close-dialog" aria-label="Close">×</button></div>
      <div class="d-body">
        <div class="field">
          <label for="f-cat">Type</label>
          <select id="f-cat" name="cat" data-action="item-cat">${options(CATS.map(x => [x.id, `${x.emoji} ${x.label}`]), it.cat)}</select>
        </div>
        ${isNew ? `<div class="templates"><div class="hint" style="margin-bottom:6px">Quick picks</div><div class="chips" id="templates">${templateChips(c)}</div></div>` : ''}
        <div class="field">
          <label for="f-name">Name</label>
          <input id="f-name" name="name" required maxlength="80" value="${esc(it.name)}" placeholder="e.g. ${esc(c.templates[0][0])}" ${isNew ? '' : 'autofocus'}>
        </div>
        <div class="row">
          <div class="field">
            <label for="f-due" id="f-due-label">${esc(c.date)}</label>
            <input id="f-due" name="due" type="date" required value="${esc(it.due)}">
          </div>
          <div class="field">
            <label for="f-repeat">Repeats</label>
            <select id="f-repeat" name="repeat">${options(Object.entries(REPEATS).map(([k, v]) => [k, v.label]), it.repeat)}</select>
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label for="f-remind">Remind me</label>
            <select id="f-remind" name="remind">${options(REMIND_OPTIONS, it.remind)}</select>
          </div>
          <div class="field">
            <label for="f-amount">Cost (optional)</label>
            <input id="f-amount" name="amount" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(it.amount ?? '')}" placeholder="$0.00">
          </div>
        </div>
        <div class="field">
          <label class="check"><input type="checkbox" name="autopay" ${it.autopay ? 'checked' : ''}> Pays or renews automatically</label>
          <div class="hint">It moves to the next date on its own. You still get a reminder first, in case you want to cancel.</div>
        </div>
        <div class="field">
          <label for="f-notes">Notes (optional)</label>
          <textarea id="f-notes" name="notes" maxlength="500" placeholder="Where to renew, account hints… (no passwords)">${esc(it.notes || '')}</textarea>
        </div>
        ${!isNew && item.history?.length ? `<p class="hint">Last ${esc(CAT[item.cat].verb.toLowerCase())}: ${esc(fmtDate(item.history[item.history.length - 1].at))}</p>` : ''}
      </div>
      <div class="d-foot">
        ${isNew ? '' : `<button type="button" class="btn danger left" data-action="delete-item" data-id="${esc(item.id)}">Delete</button>`}
        <button type="button" class="btn ghost" data-action="close-dialog">Cancel</button>
        <button type="submit" class="btn">${isNew ? 'Add' : 'Save'}</button>
      </div>
    </form>`);
}

function templateChips(c) {
  return c.templates.map(([name], i) => `<button type="button" class="chip" data-action="template" data-cat="${c.id}" data-i="${i}">${esc(name)}</button>`).join('');
}

function budgetDialog(budget, preset) {
  const isNew = !budget;
  const b = budget || preset || { name: '', emoji: '💵', period: 'weekly', limit: '' };
  openDialog(`
    <form data-form="budget" data-id="${esc(budget?.id || '')}">
      <div class="d-head"><h2 id="dialog-title">${isNew ? 'New budget' : 'Edit budget'}</h2><button type="button" class="close" data-action="close-dialog" aria-label="Close">×</button></div>
      <div class="d-body">
        <div class="row" style="grid-template-columns:90px 1fr">
          <div class="field"><label for="b-emoji">Icon</label><input id="b-emoji" name="emoji" maxlength="4" value="${esc(b.emoji)}"></div>
          <div class="field"><label for="b-name">Name</label><input id="b-name" name="name" required maxlength="40" value="${esc(b.name)}" placeholder="e.g. Coffee & tea" autofocus></div>
        </div>
        <div class="row">
          <div class="field"><label for="b-limit">Budget</label><input id="b-limit" name="limit" type="number" inputmode="decimal" min="1" step="0.01" required value="${esc(b.limit)}" placeholder="$0.00"></div>
          <div class="field"><label for="b-period">Every</label><select id="b-period" name="period">${options([['weekly', 'Week (Mon–Sun)'], ['monthly', 'Month']], b.period)}</select></div>
        </div>
      </div>
      <div class="d-foot">
        ${isNew ? '' : `<button type="button" class="btn danger left" data-action="delete-budget" data-id="${esc(budget.id)}">Delete</button>`}
        <button type="button" class="btn ghost" data-action="close-dialog">Cancel</button>
        <button type="submit" class="btn">${isNew ? 'Create' : 'Save'}</button>
      </div>
    </form>`);
}

/* ---------- Backup ---------- */

async function exportBackup() {
  const json = JSON.stringify({ app: 'life-managed', exportedAt: new Date().toISOString(), ...state }, null, 2);
  const name = `life-managed-backup-${dayKey(today())}.json`;
  const file = new File([json], name, { type: 'application/json' });
  // Phones: share sheet (save to Files, Drive, email to yourself…). Computers: a download.
  if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file], title: 'Life Managed backup' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup saved');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.app !== 'life-managed') throw new Error('not ours');
      const next = normalize(data);
      if (!confirm(`Replace what’s on this device with this backup? It has ${plural(next.items.length, 'item')} and ${plural(next.budgets.length, 'budget')}.`)) return;
      state = next; save(); render(); toast('Backup restored');
    } catch (e) {
      toast('That file isn’t a Life Managed backup.');
    }
  };
  reader.readAsText(file);
}

/* ---------- Events ---------- */

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id, cat } = el.dataset;
  switch (action) {
    case 'add':
      if (route() === 'budgets') budgetDialog();
      else itemDialog(null, filter !== 'all' && route() === 'all' ? filter : undefined);
      break;
    case 'add-cat': itemDialog(null, cat); break;
    case 'edit-item': { const item = state.items.find(i => i.id === id); if (item) itemDialog(item); break; }
    case 'done-item': e.stopPropagation(); markDone(id); break;
    case 'delete-item': {
      const idx = state.items.findIndex(i => i.id === id);
      if (idx < 0) break;
      const [removed] = state.items.splice(idx, 1);
      save(); closeDialog(); render();
      toast(`Deleted ${removed.name}`, () => { state.items.splice(idx, 0, removed); save(); render(); });
      break;
    }
    case 'template': {
      const [name, repeat, remind] = CAT[cat].templates[+el.dataset.i];
      const form = el.closest('form');
      const el2 = form.elements; el2.name.value = name; el2.repeat.value = repeat; el2.remind.value = String(remind);
      form.querySelectorAll('#templates .chip').forEach(ch => ch.setAttribute('aria-pressed', String(ch === el)));
      form.elements.due.focus();
      break;
    }
    case 'add-budget': budgetDialog(null, el.dataset.preset != null ? BUDGET_PRESETS[+el.dataset.preset] : null); break;
    case 'edit-budget': { const b = state.budgets.find(x => x.id === id); if (b) budgetDialog(b); break; }
    case 'delete-budget': {
      const b = state.budgets.find(x => x.id === id);
      if (!b || !confirm(`Delete the ${b.name} budget and its spending history?`)) break;
      state.budgets = state.budgets.filter(x => x.id !== id);
      state.spends = state.spends.filter(s => s.budgetId !== id);
      save(); closeDialog(); render(); toast(`Deleted ${b.name}`);
      break;
    }
    case 'delete-spend': {
      const idx = state.spends.findIndex(s => s.id === id);
      if (idx < 0) break;
      const [removed] = state.spends.splice(idx, 1);
      save(); render();
      toast(`Removed ${money(removed.amount)}`, () => { state.spends.splice(idx, 0, removed); save(); render(); });
      break;
    }
    case 'filter': filter = cat; render(); break;
    case 'close-dialog': closeDialog(); break;
    case 'undo': if (pendingUndo) { const u = pendingUndo; pendingUndo = null; closeDialog(); $('#toast').classList.remove('show'); u(); } break;
    case 'export': exportBackup(); break;
    case 'wipe':
      if (confirm('Delete everything in Life Managed on this device? This can’t be undone.')) {
        state = freshState(); save(); location.hash = '#home'; render(); toast('Everything was deleted');
      }
      break;
    case 'enable-notifs':
      Native.requestPermission().then(p => {
        state.settings.notifications = p === 'granted'; save(); render();
        if (p === 'granted' && Native.platform === 'android' && Native.exactAlarm !== 'granted') Native.allowExactAlarms();
      });
      break;
    case 'test-notif': Native.test().then(() => toast('A test reminder is on its way'), () => toast('Couldn’t send a test')); break;
  }
});

// Rows are role="button": Enter/Space opens them like a click.
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.item[data-action]')) { e.preventDefault(); e.target.click(); }
});

document.addEventListener('change', e => {
  const el = e.target;
  switch (el.dataset.action) {
    case 'item-cat': {
      const c = CAT[el.value], form = el.form;
      const chips = form.querySelector('#templates');
      if (chips) chips.innerHTML = templateChips(c);
      form.querySelector('#f-due-label').textContent = c.date;
      form.elements.name.placeholder = `e.g. ${c.templates[0][0]}`;
      if (!form.dataset.id) { form.elements.repeat.value = c.repeat; form.elements.remind.value = String(c.remind); }
      break;
    }
    case 'remind-hour': state.settings.remindHour = +el.value; save(); toast('Reminder time saved'); break;
    case 'toggle-notifs': state.settings.notifications = el.checked; save(); break;
    case 'import': if (el.files[0]) importBackup(el.files[0]); el.value = ''; break;
  }
});

document.addEventListener('submit', e => {
  const form = e.target;
  if (form.dataset.form === 'item') {
    e.preventDefault();
    const f = new FormData(form);
    const due = f.get('due');
    if (!isValidDay(due)) { toast('Please pick a date'); return; }
    const data = {
      name: String(f.get('name')).trim().slice(0, 80),
      cat: CAT[f.get('cat')] ? f.get('cat') : 'bills',
      due,
      anchor: parseDay(due).getDate(),
      repeat: REPEATS[f.get('repeat')] ? f.get('repeat') : 'none',
      remind: num(f.get('remind'), 0),
      amount: f.get('amount') === '' ? null : Math.max(0, num(f.get('amount'))),
      autopay: f.get('autopay') === 'on',
      notes: String(f.get('notes') || '').trim().slice(0, 500),
    };
    const existing = state.items.find(i => i.id === form.dataset.id);
    if (existing) {
      Object.assign(existing, data);
      if (existing.done && daysLeft(existing) >= 0) { delete existing.done; delete existing.doneAt; } // editing a finished item's date brings it back
      save(); closeDialog(); render(); toast('Saved');
    } else {
      state.items.push({ id: uid(), created: dayKey(today()), history: [], ...data });
      save(); closeDialog();
      if (!state.rewards.claimed.firstItem) {
        state.rewards.claimed.firstItem = 1;
        const s = awardSticker('Added your first item');
        render(); celebrate(s, `You’re tracking ${data.name}. We’ll remind you ${data.remind ? `${REMIND_OPTIONS.find(o => o[0] === data.remind)?.[1] || 'before it’s due'}` : 'on the day'}.`);
      } else {
        render(); toast(`Added ${data.name}`);
      }
    }
    rollAutopay();
  } else if (form.dataset.form === 'budget') {
    e.preventDefault();
    const f = new FormData(form);
    const data = {
      name: String(f.get('name')).trim().slice(0, 40),
      emoji: String(f.get('emoji') || '💵').trim().slice(0, 4) || '💵',
      limit: Math.max(1, num(f.get('limit'), 1)),
      period: f.get('period') === 'monthly' ? 'monthly' : 'weekly',
    };
    const existing = state.budgets.find(b => b.id === form.dataset.id);
    if (existing) Object.assign(existing, data);
    else state.budgets.push({ id: uid(), created: dayKey(today()), ...data });
    save(); closeDialog();
    if (route() !== 'budgets') location.hash = '#budgets'; else render();
    toast(existing ? 'Saved' : `${data.name} budget created`);
  } else if (form.dataset.form === 'spend') {
    e.preventDefault();
    const f = new FormData(form);
    logSpend(form.dataset.id, num(f.get('amount')), String(f.get('note') || ''));
  }
});

// Clicking the dark area around a dialog closes it.
$('#dialog').addEventListener('click', e => { if (e.target.id === 'dialog') closeDialog(); });

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  rollAutopay(); render(); checkFinishedPeriods();
});

/* ---------- Start ---------- */

rollAutopay();
render();
checkFinishedPeriods();
if (window.Native && Native.on) Native.start();
else if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
