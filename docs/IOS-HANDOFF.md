# OHRR app: iPhone build handoff (for the Mac Claude)

> Written 2026-11-08 by the Windows Claude that builds the app. You are the Claude on the Mac. This is everything you need to build and ship the iPhone version of the OHRR app. Please read it top to bottom before you touch anything.
>
> **Your job:** build the iPhone app from the code that is already in the repo, get it onto a test iPhone and into TestFlight, and leave the result and notes where the rest of the team can find them. **Do not** change the app's features or the Android project.

## 1. What the app is

- **OHRR** is the app for Ohio House Rabbit Rescue (a volunteer-run 501(c)(3) rabbit rescue in Ohio). The same React web app that runs at https://ohrr-app.pages.dev is wrapped in a native shell with **Capacitor 8**. The iPhone app is that web app inside an iOS shell. There is no separate iPhone code.
- **App / bundle id:** `org.ohiohouserabbitrescue.app` · **Name:** OHRR · **Minimum iOS:** 15.0
- **Current version: 0.4.15, revision 51 or newer** (the revision number goes up with every web release; Settings → About shows it). The Xcode project already says Version 0.4.15 and Build 48. **Build must go up with every upload to TestFlight**, so use 48 or higher; if 48 has been used, use the next number.
- The sponsor and only stakeholder is **John** (they/them). Plain language in anything you write for them. American English (check, not tick; color, not colour).

## 2. Why the iPhone build is needed

- **Bluetooth label printing** only works in a native iPhone build (Safari has no web Bluetooth). Staff print item labels to a Phomemo PM-249-WF printer: `src/features/scan/printer/`, plugin `@capacitor-community/bluetooth-le`. It is confirmed working in Chrome; the Android app is still being checked on a phone; it has never run on an iPhone, so this is the thing to test hardest.
- Camera scanning of item labels, the phone share sheet (iOS gives Print through it), and the My Bunny phone reminders (local notifications).
- OHRR volunteers and testers will install through **TestFlight**.

## 3. New in this build: in-app updates (read this)

- 0.4.15 adds the plugin `@capgo/capacitor-updater` (already in `package.json`, and already wired into `ios/App/CapApp-SPM/Package.swift`). The installed app checks https://ohrr-app.pages.dev/ota/latest.json and downloads the newest web copy from the live site, so the team does not hand out a new file for every web change. Settings → About → **Check for updates** does it by hand; a blue bar says "A new version of the app is ready."
- It does **not** replace TestFlight: a change to the phone shell itself (a new plugin or permission) still needs a new TestFlight build.
- The oldest iOS build allowed to take the web updates is `minNativeBuildIos` in `package.json` (now **48**). It is compared with the iOS **Build** number (CFBundleVersion). Whoever changes the native shell later must raise it to that build number.
- The plugin's own cloud checks and statistics are switched off in `capacitor.config.ts` (`CapacitorUpdater`): nothing goes to the plugin maker.
- **Please test it on the iPhone** (section 7). It has been tested on an Android emulator only (it found the app a new copy, downloaded it, checked it, switched to it, and stayed on it after a restart).

## 4. Where everything is

**The code:** GitHub repo `https://github.com/ohio-house-rabbit-rescue/ohrr-app`, branch `main`. John will give you access (a sign-in or token for the `ohio-house-rabbit-rescue` GitHub account). Never put a password, token or key file into the repo.

**The shared drive (Google Drive for desktop), shared drive "07-OHRR App".** On the Windows PC it is `G:\Shared drives\07-OHRR App`. On a Mac, Google Drive for desktop usually mounts it at `~/Library/CloudStorage/GoogleDrive-<account>/Shared drives/07-OHRR App`. If you cannot see it, ask John to share the folders below with the Mac's Google account. Ask for, or work from, these folders:

| What | Where (inside `07-OHRR App`) |
|---|---|
| Full build guide for both phones (read sections 2, 4, 7, 9, 10) | `docs/HANDOFF.md` in the repo (and a Word copy: `03 Mobile Builds/OHRR Mobile Build Handoff.docx`) |
| Put finished iPhone files and notes here | `03 Mobile Builds/ios/` (empty until you add something) |
| Android builds, for comparison only | `03 Mobile Builds/android/` |
| Older versions of the install guide for volunteers | `03 Mobile Builds/` (`2026-10-27_Install_the_OHRR_App_v06.docx` is the latest) |
| Store screenshots | `03 Mobile Builds/store-screenshots/` |
| Design and decisions, the running log of what was built | `02 App Design/` (`04-progress-log.md`, `00-WHAT-IS-IN-HERE.md`) |
| Android signing key (not needed for iPhone; do not touch) | `90 Admin/Keys/` |

**In the repo, the iPhone parts:**

| File | What it is |
|---|---|
| `ios/App/App.xcodeproj` | The Xcode project. Capacitor 8 uses Swift Package Manager: there is **no** `.xcworkspace` and **no CocoaPods**. |
| `ios/App/CapApp-SPM/Package.swift` | The list of plugins (10, including the updater). Generated by `npx cap sync`; the committed version is correct. |
| `ios/App/App/Info.plist` | Permission texts (camera, photos, Bluetooth) |
| `capacitor.config.ts` | App id, splash, status bar, updater settings |
| `docs/github/ios-testflight.yml` | A ready GitHub Actions workflow that builds and uploads to TestFlight. It is **not** installed yet: the automated push token lacked the `workflow` scope. To use it, someone with the OHRR GitHub login adds it as `.github/workflows/ios-testflight.yml` (web UI: Add file → Create new file). See `docs/HANDOFF.md` section 4a. |
| `resources/`, `scripts/make-native-assets.py` | Icon and splash sources |

## 5. What you need from John first

1. **Apple Developer Program membership for the organization.** Not in place yet as far as the Windows Claude knows. It needs the nonprofit's D-U-N-S number and someone with authority to sign, and the US nonprofit fee waiver can cover the $99. Until then you can run the app on a plugged-in iPhone with a free personal team, but **TestFlight needs the paid membership**. Details: `docs/HANDOFF.md` section 9.
2. The bundle id `org.ohiohouserabbitrescue.app` registered, and the app created in App Store Connect (iOS, name OHRR, SKU `ohrr-app`).
3. Git access to the repo (above).
4. A test iPhone, ideally with the Phomemo PM-249-WF label printer nearby.

If any of these is missing, build and test on the device with a personal team and a temporary bundle id (`docs/HANDOFF.md` section 4b step 6), and say so in your notes. Switch back to the real id for TestFlight.

## 6. How to build

Follow `docs/HANDOFF.md` section 4b (manual, on the Mac). In short:

```bash
git clone https://github.com/ohio-house-rabbit-rescue/ohrr-app.git
cd ohrr-app
npm install
npm run cap:sync        # builds the web app and copies it into ios/ (and android/)
npm run cap:ios         # opens Xcode
```

- Xcode 16.4 or newer, Node 22 or newer. Wait for Swift Package Manager to finish when Xcode first opens the project.
- Signing & Capabilities: tick Automatically manage signing and choose the OHRR team.
- Archive with **Any iOS Device (arm64)**, then Distribute App → TestFlight & App Store → Upload. Raise the **Build** number for every upload (App target → General → Identity).
- The web build inside `ios/` is not committed, so `npm run cap:sync` must run before every Xcode build.
- **Do not commit** the changes `cap sync` makes to `android/` files unless something real changed; if `git status` shows only path differences in `capacitor.settings.gradle`, `capacitor.build.gradle` or `Package.swift`, revert them with `git checkout`.
- Use `npm run cap:sync` as written. A plain `npm run build` with `OTA_BUILD=1` or on Cloudflare also writes a 10 MB update zip into `dist/`, which must never be copied into the phone app.

## 7. What to test on the iPhone

1. App opens, brand-blue status bar, no white flash, the OHRR splash goes away.
2. Settings → About shows `v0.4.15 · rev 51` (or a newer revision) and a **Check for updates** button. Tap it: it should say "You have the newest version." (A newer web revision will download and offer "Update now": that is the in-app update working. Tell John the result either way.)
3. Staff → Scan an item: camera permission, then it reads a label.
4. Staff → Print labels (or Hop Shop labels) → **Print by Bluetooth**: iOS asks for Bluetooth permission, pairs a printer whose name starts with `PM-`, prints. This is the big one. If it fails, the app has Printer settings with fixes (darker/lighter, plain mode, flip black and white, show every device). Write down exactly what happens.
5. Share sheet: Staff → Share kit → Share, and Print through it.
6. My Bunny → "Remind me on this phone" gives a notification.
7. Sign in with a staff account, open Sell, open Today's sales. Do **not** ring up a real sale: it goes on the rescue's record.

More checks: `docs/HANDOFF.md` section 7.

## 8. Rules for this project

- American English in anything you write. Plain language for John: say what happened, what you saw, what is left.
- Do not enter or ask for John's passwords. Never put keys (`.p8`, certificates, tokens) in the repo or in a Drive folder others can read; ask John where OHRR wants them stored (the Android key lives in `90 Admin/Keys/` with a README).
- Do not change app features, copy or colors. If you find a bug, write it down for the Windows Claude with the steps to repeat it.
- No real money moves in the app. Sell only records sales. Online auction and silent auction are switched off. Do not try to turn anything on.

## 9. When you finish, leave these

Put them in `03 Mobile Builds/ios/` on the shared drive, and write the full path in your message to John:

1. `README.txt` there: version, build number, date, which commit (`git rev-parse --short HEAD`), whether it went to TestFlight, and the TestFlight invite link or steps for testers.
2. A short test report (a `.md` file named like `2026-11-08_iOS_test_report.md`): each item in section 7 marked works / does not / not tried, with what you saw. Include a photo or screenshot of a printed label if you got one.
3. If you changed anything in the repo (version numbers, signing, a new file), commit it to `main` with a clear message and say what changed. Keep changes inside `ios/` and `package.json` (`minNativeBuildIos`) only.
4. Anything blocked on OHRR, in plain words (for example "needs the Apple membership").

## 10. Later (not now)

- Google Play for Android testers: the team plans a Play Console account and testing track later. Not your job.
- Making the iPhone app public on the App Store (`docs/HANDOFF.md` section 9, including the privacy policy URL and removing `noindex`). Not yet.
