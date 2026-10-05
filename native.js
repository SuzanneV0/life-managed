'use strict';

/* =========================================================
   Life Managed — installed phone app (Capacitor)
   On the website this file does nothing (Native.on is false).
   In the Android/iOS app it hands reminders to the phone's own
   notification scheduler, so they arrive even when the app is
   closed. Everything stays on the device, as on the web.
   ========================================================= */

const Native = (() => {
  const cap = window.Capacitor;
  const on = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  if (!on) return { on: false };

  const LN = cap.registerPlugin('LocalNotifications');
  const MAX_PENDING = 60; // iOS allows 64 pending notifications; keep a little room
  const api = { on: true, permission: 'default', exactAlarm: 'granted', platform: cap.getPlatform() };

  // Notification ids must be 32-bit integers; derive a stable one from the text.
  const idFor = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 1) || 1; };

  const at = (day, offsetDays) => { const d = addDays(parseDay(day), offsetDays); d.setHours(num(state.settings.remindHour, 9), 0, 0, 0); return d.getTime(); };

  /** Every reminder that should be pending right now, soonest first (uses the same data as the app). */
  function planned() {
    const now = Date.now(), out = [];
    const add = (when, item, kind) => { if (when > now + 5000) out.push({ when, item, kind }); };
    for (const item of state.items) {
      if (item.done) continue;
      const remind = num(item.remind);
      if (remind > 0) add(at(item.due, -remind), item, 'ahead');
      add(at(item.due, 0), item, 'due');
      if (!item.autopay) add(at(item.due, 1), item, 'overdue');
    }
    return out.sort((a, b) => a.when - b.when).slice(0, MAX_PENDING);
  }

  function message({ item, kind }) {
    const c = CAT[item.cat];
    const what = c.date.replace(' on', '').toLowerCase(); // "expires", "renews", "due", "term ends"
    if (kind === 'ahead') return { title: `${item.name} ${what} ${fmtDate(item.due)}`, body: `${dueText(item)}. Tap to see what’s coming up.` };
    if (kind === 'due') return { title: `${item.name}: ${what === 'due' ? 'due' : what} today`, body: item.autopay ? 'It renews automatically today.' : `Mark it ${c.verb.toLowerCase()} in Life Managed when it’s done.` };
    return { title: `${item.name} is overdue`, body: `Was ${what} ${fmtDate(item.due)}. Mark it ${c.verb.toLowerCase()} once it’s taken care of.` };
  }

  async function reschedule() {
    await cancelAll();
    if (api.permission !== 'granted' || !state.settings.notifications) return;
    const notifications = planned().map(p => ({
      id: idFor(`${p.item.id}|${p.kind}|${p.when}`),
      ...message(p),
      schedule: { at: new Date(p.when), allowWhileIdle: true },
      channelId: 'reminders',
    }));
    if (notifications.length) await LN.schedule({ notifications });
  }

  async function cancelAll() {
    try {
      const { notifications } = await LN.getPending();
      if (notifications.length) await LN.cancel({ notifications: notifications.map(n => ({ id: n.id })) });
    } catch (e) { /* nothing pending */ }
  }

  // Many saves can happen in a row; reschedule once they settle.
  let timer = null;
  api.queueReschedule = () => { clearTimeout(timer); timer = setTimeout(() => reschedule().catch(() => {}), 800); };

  api.refreshPermission = async () => {
    try {
      const p = await LN.checkPermissions();
      api.permission = p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default';
      if (api.platform === 'android' && LN.checkExactNotificationSetting) {
        api.exactAlarm = (await LN.checkExactNotificationSetting()).exact_alarm;
      }
    } catch (e) { /* keep defaults */ }
    return api.permission;
  };

  api.requestPermission = async () => {
    try { const p = await LN.requestPermissions(); api.permission = p.display === 'granted' ? 'granted' : 'denied'; }
    catch (e) { api.permission = 'denied'; }
    return api.permission;
  };

  /** Android 12+: exact alarms must be allowed in system settings for on-time reminders. */
  api.allowExactAlarms = async () => {
    try { api.exactAlarm = (await LN.changeExactNotificationSetting()).exact_alarm; } catch (e) { /* not supported */ }
    return api.exactAlarm;
  };

  /** Settings → "Send a test": a real system notification in two seconds. */
  api.test = () => LN.schedule({ notifications: [{ id: 1, title: 'Life Managed test', body: 'Reminders are working, even when the app is closed. 🗓️', schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true }, channelId: 'reminders' }] });

  api.start = async () => {
    if (api.platform === 'android') {
      try { await LN.createChannel({ id: 'reminders', name: 'Reminders', description: 'Renewals, bills and subscriptions coming due', importance: 4, visibility: 1, vibration: true }); }
      catch (e) { /* the default channel is used instead */ }
    }
    try { await LN.addListener('localNotificationActionPerformed', () => { location.hash = '#home'; }); }
    catch (e) { /* tapping still opens the app */ }
    await api.refreshPermission();
    render();
    api.queueReschedule();
  };

  // Reminders only change when data changes, but time moves on: top the schedule up regularly.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) api.queueReschedule(); });

  return api;
})();
window.Native = Native; // top-level const isn't a window property; app.js checks window.Native
