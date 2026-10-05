# Life Managed

*Working title. The project folder is still called Life Organized.*

Organizes everything in your life that needs tracking, so you never miss a deadline:

- **Documents:** driver's licence, passport, health card, licence plate…
- **Memberships:** Costco, Walmart+, Voilà, gym…
- **Bills**, **contracts** (phone plan, mortgage term), **insurance**
- **App subscriptions** and **streaming services**

Plus weekly or monthly **budgets** (coffee & tea, groceries, fun…): log what you actually spend, and staying on track earns a sticker for your shelf.

## How it works

- A plain website (no build step): `index.html`, `styles.css`, `app.js`. It works on phones and computers and can be installed to the home screen.
- **Private by design:** no account and no server. Everything is saved only on the device (`localStorage`). People move devices with **Settings → Save a backup / Restore from backup**.
- **Phone apps:** `native/` wraps the same website as iPhone and Android apps (Capacitor). There, `native.js` schedules reminders as real notifications. See [native/README.md](native/README.md).
- Defaults: Canadian dollars, `en-CA` dates, weeks start Monday.

## Run it locally

```bash
python -m http.server 5194
```

Then open http://localhost:5194.

## Rewards

- Mark something renewed or paid **on time or early**: a sticker.
- Log spending while still **on pace** for the budget (at most once per budget per day): a sticker.
- Finish a week or month **under budget**: a sticker, and the streak grows.
- Paying late still gets confetti, but no sticker.
