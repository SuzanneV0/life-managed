# Life Managed phone app (Capacitor)

This folder wraps the Life Managed website (the repository root) as installed Android and iPhone apps, using [Capacitor](https://capacitorjs.com).

**Why:** a website can't send reminders while it's closed. Inside the phone app, `../native.js` hands reminders to the phone's own scheduler (`@capacitor/local-notifications`), so they still arrive when the app is closed or the phone has restarted. Data stays only on the device.

The website is the single source of truth. Never edit `native/www`, `android/app/src/main/assets/public` or `ios/App/App/public`; `npm run sync` copies them from the site.

## What's here

| Path | What it is |
|---|---|
| `capacitor.config.json` | App id `app.lifemanaged`, name, notification icon and colour |
| `android/` | The Android Studio project, with Life Managed icons and splash screens. Cloud backup is off so data never goes to Google Drive. |
| `ios/` | The Xcode project (Swift Package Manager, no CocoaPods needed), with the app icon and splash screen |
| `scripts/copy-web.mjs` | Copies the website into `www/` for bundling |
| `scripts/icon-art.js`, `make-*-icons.js` | Redraw every web icon, app icon, notification icon and splash screen from the logo (`npm run icons`) |

## Build and try it on an Android phone

One-time setup (about 10 GB of downloads):

1. Install **[Android Studio](https://developer.android.com/studio)**. It includes the Java runtime and Android SDK that Capacitor needs.
2. Open Android Studio once and let it finish downloading the SDK.

Every time you want a fresh build:

```bash
cd native
npm install          # first time only
npm run sync:android # copy the website in and update the Android project
npm run open:android # opens the project in Android Studio
```

In Android Studio, plug in your phone with **USB debugging** on (Settings → About phone → tap *Build number* 7 times → Developer options → USB debugging) and press **Run ▶**.

## Build and try it on an iPhone (on the Mac)

One-time setup on the Mac: install **Node.js** (LTS) from [nodejs.org](https://nodejs.org), and make sure **Xcode** is installed and opened once. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode** (this only appears after the iPhone has been connected to Xcode once).

Every time you want a fresh build:

```bash
cd native
npm install          # first time only
npm run sync:ios     # copy the website in and update the Xcode project
npm run open:ios     # opens the project in Xcode
```

In Xcode, click **App** → **Signing & Capabilities** and choose your **Team** (your Apple ID), pick your iPhone at the top, and press **Run ▶**. The first time, trust the developer on the iPhone: **Settings → General → VPN & Device Management**.

With a free Apple ID, the app keeps working on your own iPhone for 7 days before you need to press Run again. A paid Apple Developer account removes that limit and allows TestFlight and the App Store.

## Things to check on a real phone

- **Settings → Turn on reminders**, then **Send a test**, then close the app completely. The test should still arrive.
- **Android 12 and later:** allow alarms when asked, or reminders may arrive a few minutes late.

## Publishing

- **Google Play:** one-time US$25 developer account. Build a signed release bundle in Android Studio (*Build → Generate Signed App Bundle*) and keep the signing key safe.
- **Apple App Store:** US$99/year developer account. In Xcode choose *Product → Archive*, then upload to App Store Connect (TestFlight first).
- The app id `app.lifemanaged` and the name are placeholders while the name is still a working title. Change them before the first upload: after that the app id is permanent.
