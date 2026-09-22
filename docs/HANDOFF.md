# OHRR Mobile Build Handoff

> Android + iPhone internal test builds of the OHRR app · 2026-09-17, updated 2026-09-22 (0.2.1)

> Same content as **OHRR Mobile Build Handoff.docx** in the Drive folder "07-OHRR App". Regenerate both from one source if you change it (see docs/PROGRESS.md, 2026-09-17).

This document is for whoever builds and installs the OHRR app on phones for internal testing — the Mac owner for iPhone (Xcode / TestFlight) and anyone with Android Studio for Android (Play Console internal testing). It is written to be followed top to bottom without needing the code history. Nothing here is for a public store release yet; the last section lists what that will need.

## 1. What was built

- The OHRR web app (the same React app that runs at https://ohrr-app.pages.dev) is now wrapped in a native shell with Capacitor 8. One codebase: the web build keeps working unchanged, and the same build is copied into the Android and iOS projects.
- App id / bundle id: `org.ohiohouserabbitrescue.app` · App name: OHRR · Version **0.2.1** (Android versionCode 3; iOS build number = the GitHub Actions run number).
- Inside the app (and only there) a few things behave natively: My Bunny “Take a photo” / “Choose from library” use the phone camera and photo picker; care reminders become phone notifications (“Remind me on this phone”, 9:00 AM on the due date); every link to another website — donate, merch, Petfinder, vet websites, the OHRR website — opens in the phone’s browser; the status bar is brand blue and there is a brand-blue splash screen with the OHRR mark; Android’s back button walks back through the app.
- On the web nothing changed: file inputs, calendar (.ics) downloads and plain links stay as they were.
- **0.2.1 (2026-09-22) — tester feedback round 1.** Bunny Help on Home asks a question, bigger icons, a Back button on every screen, booking times that fill themselves from a weekly schedule, and the Hop Shop manager with photos, codes, suppliers and a reorder list. Needs `PASTE-THIS-INTO-SUPABASE.sql` (Drive root) run once.
- **0.2.0 (2026-09-21) — the full app for testers.** Everything built since 17 Sept (Scan an item, Inbox, Bookings, Share kit, Post queue, Flyers, Outreach letters, hours + service letters, impact page, breed guide, raffle tickets) is in the build. Inside the app, anything the app paints or prints goes out through the phone’s **share sheet** (the free @capacitor/share + @capacitor/filesystem plugins): Share-kit cards and Post-queue releases, flyers, the tag sheet (“Print or share”), the service-hours letter (“Print / share the letter”), the My Bunny backup. iOS’s share sheet includes **Print** (AirPrint); Android users pick Files/Drive/Messages or send it to whoever prints. The camera scanner uses the WebView camera (Capacitor asks for the permission the first time).
- **Raffle tickets** are ON in this build (`raffle_tickets_enabled`): numbered tickets reserved in the app, paid at the raffle table, drawn from Staff → Raffle tickets. Modify during testing; nothing is charged.
- **Delete my account** is at the bottom of the Staff dashboard (Apple requires it for apps with sign-up).

## 2. Where everything is

| Thing | Where |
|---|---|
| Source code | https://github.com/ohio-house-rabbit-rescue/ohrr-app — branch **main** (the web app auto-deploys from it to Cloudflare Pages) |
| Android project | `android/` in the repo (open it in Android Studio) |
| iPhone project | `ios/App/App.xcodeproj` in the repo (open it in Xcode — Capacitor 8 uses Swift Package Manager, so there is no .xcworkspace and no CocoaPods) |
| Capacitor config | `capacitor.config.ts` (app id, name, splash / status-bar / notification settings) |
| Native code the app uses | `src/native/` (platform.ts, camera.ts, notifications.ts, browser.ts, NativeBridge.tsx) |
| Icon + splash sources | `resources/` (made from public/ohrr-mark.png by `scripts/make-native-assets.py`); generated into android/ and ios/ by `npm run cap:assets` |
| Ready-made Android builds | G:\Shared drives\07-OHRR App\Mobile builds\android\ — **ohrr-0.2.1-vc3-release.aab** (for Play Console) and **ohrr-0.2.1-vc3-debug.apk** (sideload); the 0.2.0 and 0.1.0 files are the earlier builds |
| Android test signing key | G:\Shared drives\07-OHRR App\Mobile builds\keys\ohrr-test.keystore + README.txt (passwords). Never in the repo. |
| iPhone builds | G:\Shared drives\07-OHRR App\Mobile builds\ios\ — empty until the Mac produces one (see section 4) |
| This document | docs/HANDOFF.md in the repo, and G:\Shared drives\07-OHRR App\OHRR Mobile Build Handoff.docx |

### npm scripts

| Command | What it does |
|---|---|
| `npm run build` | Builds the web app into `dist/` (what Cloudflare runs) |
| `npm run cap:sync` | `npm run build` + `npx cap sync` — copies the fresh web build into android/ and ios/ and updates native plugins. Run after ANY web change. |
| `npm run cap:ios` | Opens the iPhone project in Xcode (Mac only) |
| `npm run cap:android` | Opens the Android project in Android Studio |
| `npm run cap:assets` | Regenerates icons + splash from `resources/` (only needed if the mark changes) |
| `node scripts/mybunny-check.ts` | Browser-free checks for My Bunny + the reminder-notification maths (205 checks) |

## 3. Prerequisites

### Mac (iPhone builds)

- macOS with **Xcode 16.4 or newer** from the App Store (Xcode 26 is fine). Open it once and let it install the iOS platform.
- **Node.js 22 or newer** (https://nodejs.org — the LTS installer) and git (Xcode installs git; or https://git-scm.com).
- An **Apple ID signed in to Xcode** (Xcode → Settings → Accounts). Running on your own iPhone works with a free personal team; TestFlight needs the paid Apple Developer Program membership (see section 9).
- An iPhone with a USB cable (or on the same Wi-Fi, once paired) for a device run.
- CocoaPods is **not** required — Capacitor 8 fetches its iOS libraries with Swift Package Manager, built into Xcode.

### Windows or Mac (Android builds)

- **Android Studio** (Ladybug 2024.2 or newer) with the default SDK; in SDK Manager make sure **Android 15 (API 35)** and **Android 16 (API 36)** platforms are installed (compileSdk is 36).
- **JDK 21** — Android Studio bundles one; if building from a terminal set `JAVA_HOME` to it (Capacitor 8 needs 21, not 17).
- Node.js 22+ and git, as above.
- The test keystore from the Drive keys folder (section 5).

## 4a. iPhone without a Mac: GitHub Actions → TestFlight (recommended)

The repo is public, so GitHub’s macOS runners are free. The workflow file is `docs/github/ios-testflight.yml`; it has to live at `.github/workflows/ios-testflight.yml` to run — GitHub refused the automated push of a workflow file (the push token lacks the `workflow` scope), so either the OHRR GitHub login runs `gh auth refresh -h github.com -s workflow` once and the file is pushed, or someone adds it in the GitHub web UI (Add file → Create new file → path `.github/workflows/ios-testflight.yml` → paste). It builds the app and uploads it to TestFlight; signing is automatic through an App Store Connect API key, so nobody handles certificates.

1. OHRR needs an **Apple Developer Program** membership (organisation; nonprofit fee waiver — see section 9). Register the bundle id `org.ohiohouserabbitrescue.app` under Certificates, IDs & Profiles → Identifiers, then create the app in App Store Connect (iOS, name OHRR, SKU ohrr-app).
2. App Store Connect → Users and Access → Integrations → **App Store Connect API** → Team keys → Generate (role App Manager). Download the `.p8` (only offered once) and note the Key ID and Issuer ID.
3. GitHub → ohio-house-rabbit-rescue/ohrr-app → Settings → Secrets and variables → Actions → add `APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_P8` (paste the whole .p8 file).
4. GitHub → Actions → **iOS → TestFlight** → Run workflow. About 20 minutes later the build is in App Store Connect → TestFlight (processing takes another 10–30 min). Add internal testers there (up to 100 people with App Store Connect roles, no review), or an external group (up to 10,000; Apple reviews the first build).
5. Every run uploads a new build number automatically. Re-run the workflow after each change on `main`.

## 4b. iPhone on a Mac (manual alternative)

1. Open Terminal and clone the repo: `git clone https://github.com/ohio-house-rabbit-rescue/ohrr-app.git` then `cd ohrr-app`.
2. Install the JavaScript packages: `npm install`.
3. Build the web app and copy it into the native projects: `npm run cap:sync`. (This must be run before Xcode — the web build inside ios/ is not committed.)
4. Open the project in Xcode: `npm run cap:ios` (or double-click `ios/App/App.xcodeproj`). The first open takes a minute while Swift Package Manager fetches Capacitor and the plugins — wait for the progress bar in the top of the Xcode window to finish.
5. In the left sidebar click the blue **App** project, then the **App** target → **Signing & Capabilities** tab. Tick **Automatically manage signing** and choose your **Team**.
6. If Xcode says the bundle identifier `org.ohiohouserabbitrescue.app` is not available to your team, change **Bundle Identifier** on that same tab to something you own for now (for example `com.yourname.ohrr`). Switch it back to the OHRR one once the OHRR organisation account exists — TestFlight and the store listing must use the final id.
7. Plug in the iPhone, pick it in the device menu at the top (next to “App”), and press **Run** (▶). The first time, on the phone go to Settings → General → VPN & Device Management and trust your developer certificate, then run again.
8. Try the test checklist in section 7 on the phone.
9. **TestFlight (internal testers):** in Xcode pick **Any iOS Device (arm64)** as the destination, then **Product → Archive**. When the Organizer opens, click **Distribute App → TestFlight & App Store → Upload** and accept the defaults (Xcode manages signing; “Upload your app’s symbols” is fine). After Apple processes it (5–30 min) go to https://appstoreconnect.apple.com → the app → **TestFlight** → add testers under **Internal Testing** (up to 100 people with App Store Connect roles, no review needed). They install the TestFlight app and accept the invitation.
10. Every new upload needs a higher **Build** number: App target → **General** → Identity → Build (1 → 2 → 3…). Version can stay 0.2.0 while testing.

## 5. Android: build and share

Two ready-made builds are already in the Drive folder (section 2). To make a new one after a change:

### Option A — Android Studio (point and click)

1. In the repo run `npm install` (first time) and `npm run cap:sync`.
2. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in the four values from `G:\Shared drives\07-OHRR App\Mobile builds\keys\README.txt` (the file is gitignored, so it never goes to GitHub). On a Mac copy `ohrr-test.keystore` somewhere local and point `storeFile` at it.
3. Open the project: `npm run cap:android`. Let Gradle sync finish (bottom status bar).
4. For a quick install on a phone plugged in with USB debugging on: press **Run** (▶).
5. For Play Console: **Build → Generate Signed App Bundle / APK → Android App Bundle → Next**, choose the keystore file, alias `ohrr-test` and the passwords from README.txt, pick **release**, **Create**. The .aab lands in `android/app/release/`.

### Option B — terminal (what produced the files in Drive)

```
npm install
npm run cap:sync
cd android
# Windows:  .\gradlew.bat bundleRelease      Mac/Linux:  ./gradlew bundleRelease
#   -> android/app/build/outputs/bundle/release/app-release.aab   (signed if keystore.properties exists)
# Windows:  .\gradlew.bat assembleDebug      Mac/Linux:  ./gradlew assembleDebug
#   -> android/app/build/outputs/apk/debug/app-debug.apk         (sideload only)
```

If Gradle cannot find the SDK, create `android/local.properties` with one line, e.g. `sdk.dir=C:/Users/you/AppData/Local/Android/Sdk` (Mac: `sdk.dir=/Users/you/Library/Android/sdk`). Android Studio writes this file for you when you open the project.

### Upload to Play Console (internal testing)

1. Go to https://play.google.com/console with the existing Google Play account → **Create app** (name OHRR, App, Free). Fill only what it insists on for now.
2. **Testing → Internal testing → Create new release**. Keep **Play App Signing** on (default) — Google then holds the real signing key and our test keystore becomes the upload key.
3. Upload `ohrr-0.2.0-vc2-release.aab` (or your new .aab). Release name = 0.2.0 (2). **Save → Review release → Start rollout to Internal testing**.
4. **Testers** tab → create an email list of testers (up to 100) → save → copy the **opt-in link** and send it. Testers open it on their phone, accept, and install from the Play Store. Internal testing needs no review and updates appear within minutes.
5. For each later upload raise `versionCode` in `android/app/build.gradle` (1 → 2 → 3…); Play rejects a bundle whose versionCode is not higher than the last.

### The keystore rule

The first bundle uploaded to a Play Console app ties that app to its signing key. If the public release is ever uploaded with this test keystore, every future update must be signed with it — losing it would mean a new app listing and losing every install. So: keep `ohrr-test.keystore` and README.txt in the Drive keys folder forever, never delete or “clean up” that folder, and leave Play App Signing on so Google can reset a lost upload key.

## 6. Making a change and rebuilding both

1. Make the change in the web code (`src/`), test it in the browser with `npm run dev`, commit and push to `main` as usual — the website build updates by itself.
2. Run `npm run cap:sync`. This rebuilds `dist/` and copies it into android/ and ios/.
3. Android: open Android Studio (or run the gradle command) and build again. Raise `versionCode` if it is going to Play.
4. iPhone: open Xcode, raise the Build number, Run or Archive again.
5. The native folders (android/, ios/) are committed, so after `git pull` on another machine the same two commands (`npm install`, `npm run cap:sync`) bring it up to date. Only change files inside android/ or ios/ when you mean to (version numbers, signing, permissions).

## 7. What to test on the phone (test-build checklist)

- App opens on a brand-blue splash with the OHRR mark, then Home; the status bar is blue with white icons.
- My Bunny → Add a bunny → **Take a photo** asks for camera permission and opens the camera; **Choose from library** opens the photo picker; the photo shows shrunk in the form and after saving.
- On a bunny’s page add a reminder, tap **Remind me on this phone** → the first time the phone asks to allow notifications; the button turns into “Reminding on this phone” with the first date. **Mark done** moves it to the next date. Delete or archive stops it. (To see one fire quickly, set Next due to today and change the phone clock past 9 AM, or set it to tomorrow.)
- Tapping a notification opens that bunny’s page.
- Give / Donate, Hop Shop, Petfinder, vet websites and the “OHRR website” links open in the phone’s browser (Chrome Custom Tab / Safari sheet), and closing it returns to the app.
- Phone numbers (`tel:`) and emails (`mailto:`) open the dialer / mail app.
- Android back button goes back a screen; on Home it leaves the app.
- Staff → Sign in works (Supabase is the live backend, same as the website).
- Nothing is uploaded from My Bunny — it stays on the phone (same as the web).
- **0.2.0 additions:** Staff → Scan an item → the camera opens (permission prompt the first time) and reads a printed OHRR tag or a retail barcode; Staff → Share kit → Share opens the share sheet with the image; Staff → Flyers → Share / Print; Staff → Scanned items → Print tags → “Print or share” hands the sheet to the share sheet (iOS: Print); Bookings → Hours → a person → Service letter → “Print / share the letter”; My Bunny → Back up opens the share sheet with the backup file (Restore reads it back); BunFest → Raffle → Get tickets → numbers + QR; Staff → Raffle tickets → Scan that QR → Mark paid; Draw → a winner; the person’s ticket page updates within 15 s.

## 8. Deliberately OFF or not available in these test builds

- **Payments** — nothing is charged anywhere (donations open OHRR’s own page in the browser; raffle tickets and Hop Shop are “pay at the table / counter”). The money process attaches later, by the sponsor’s decision.
- **Live adoptable rabbits (Petfinder)** — the Adopt page shows staff-entered rabbits (Staff → Adoptable rabbits) or, when there are none, the built-in sample rabbits, clearly labelled. Petfinder is not connected, by the sponsor’s decision.
- **Push notifications, in-app purchases, analytics** — none; nothing paid or third-party was added. Reminders are local notifications scheduled on the phone.
- **Easter campaign scheduler** — on hold.
- **QR tags and flyers open the website** when scanned with the phone’s own camera (not the app) — App Links / Universal Links come with the store release.
- The app is portrait-only on phones (it is a phone-shaped design).
- Everything else is ON, including the raffle-ticket test feature (staff can switch it off at /staff/settings).

## 8a. Store forms — the answers (copy these in)

Both consoles ask the same things. Every answer below matches what the code does (see the privacy policy at https://ohrr-website.pages.dev/privacy for the plain-English version).

**Google Play → App content**
- Privacy policy URL: `https://ohrr-website.pages.dev/privacy`
- Ads: **No**, the app contains no ads.
- App access: parts of the app are restricted (the staff area) → provide a test staff login for reviewers (create one via an invite code) — or say "the restricted area is for the charity's staff only; all public features work without sign-in".
- Content rating (IARC): utility/reference app; no violence, sexual content, drugs; **gambling: No** — the app does not let people gamble or pay for raffle tickets; reservations are paid in person. (If the reviewer objects anyway, switch OFF "Raffle tickets inside the phone apps" in Staff → Settings.)
- Target audience: **13 and over** (not designed for children).
- News app: No. COVID-19 contact tracing: No. Government app: No. Financial features: **None**.
- Data safety:
  - Collects data: **Yes**. Types: **Name, Email address, Phone number** (personal info) — user-provided in forms, bookings and raffle reservations; **Photos** (user content) — only when staff photograph a donated item; **Other user-generated content** — what people type into a form.
  - Shared with third parties: **No** (Supabase and Cloudflare are processors, not recipients).
  - Purpose: **App functionality** only. Not used for advertising or analytics. **No tracking.**
  - Optional or required: optional (a person chooses to submit a form or reservation).
  - Encrypted in transit: **Yes** (HTTPS). Users can request deletion: **Yes** (email; staff delete their own account in the app).
  - Not collected: location, device IDs, contacts, health & fitness, financial info, app activity/diagnostics via SDKs (none installed).
- Permissions: CAMERA (My Bunny photos; staff tag/barcode scanning and item photos), POST_NOTIFICATIONS (local care reminders), SCHEDULE_EXACT_ALARM / RECEIVE_BOOT_COMPLETED (so a reminder fires at 9 AM and survives a reboot).

**App Store Connect → App Privacy**
- Data collected: **Contact Info** (Name, Email Address, Phone Number) and **User Content** (Photos or Videos — staff item photos; Other User Content — form text). Linked to the user: No (we do not tie it to an account; staff accounts hold only an email). Used for tracking: **No**. Purpose: App Functionality.
- Everything else: **Data Not Collected**.
- App Review notes: "Public features need no account. The Staff area is for the charity's staff; demo sign-in: <test staff email / password>. Raffle tickets are reserved in the app and paid for in person at the charity's event — no money is taken in the app; official rules are shown on the raffle page. Donations open the charity's own website in the browser."
- Age rating: 4+ is likely (no objectionable content); answer the questionnaire honestly — no gambling, no unrestricted web access (external links open in Safari).
- Guideline watch-outs: 5.1.1(v) account deletion — done (Staff dashboard); 3.1.1/3.2.2 donations outside the app — done; **5.3.2/5.3.3 raffles** — put OHRR's official raffle rules (and "Apple is not a sponsor") in Staff → Silent Auction → Auction setup → raffle details so they show on the raffle page, and if Review still objects switch OFF "Raffle tickets inside the phone apps" (Staff → Settings) and resubmit — no rebuild needed.

## 9. Before a PUBLIC release (not needed for testing)

1. **Apple:** enrol Ohio House Rabbit Rescue as an *organisation* in the Apple Developer Program (needs a D-U-N-S number for the nonprofit, the legal entity name, and someone with authority to sign). Apply for the **nonprofit fee waiver** (US 501(c)(3) organisations can have the $99/year waived — in the enrolment flow, or via https://developer.apple.com/support/membership-fee-waiver/). Until then the bundle id can be used from a personal team for testing only.
2. **Google Play:** the existing account must be verified as an organisation (D-U-N-S again, or the org’s documents) and a new personal account would need a 14-day closed test with 12 testers before production — check which applies to this account in Play Console → Setup → Advanced settings.
3. **Privacy policy URL:** https://ohrr-website.pages.dev/privacy — after board review; both stores require it in the listing and (Apple) in App Store Connect → App Privacy. Fill in the data-safety / privacy-nutrition questionnaires: My Bunny data stays on device; Supabase auth is staff-only; no ads or tracking.
4. **Remove `noindex`:** delete the `<meta name="robots" content="noindex, nofollow">` line in `index.html`, the `X-Robots-Tag` header in `public/_headers` (and netlify.toml), and `public/robots.txt`, so the web app can be found once the stores link to it.
5. **Store listing text:** app name, short + full description, category (Lifestyle or Education), contact email, support URL (the OHRR website).
6. **Screenshots:** the iPhone sizes App Store Connect asks for (currently the 6.9″ and 6.5″ sets) and phone screenshots for Play — take them from the test build.
7. **Icons:** the generated icon (OHRR mark in a white disc on brand blue) is fine to ship; if the sponsor wants a different treatment, change `scripts/make-native-assets.py`, run it and `npm run cap:assets`.
8. **Donations open externally** — already done (Give / Support links leave the app), which is what Apple 3.1.1 / 3.2.2 and Play policy expect for nonprofit donations that are not in-app purchases.
9. **Versioning:** set version 1.0.0 in package.json, `android/app/build.gradle` (versionName + versionCode) and Xcode (Version + Build).
10. **Signing for production:** decide whether to keep using the test keystore as the Play upload key (fine with Play App Signing on) or generate a fresh one — either way, keep it in the Drive keys folder with its passwords.

## 10. Troubleshooting

| Symptom | What to do |
|---|---|
| Xcode: “No such module Capacitor” or packages missing | Wait for Swift Package Manager to finish (progress bar at the top). If stuck: File → Packages → Reset Package Caches, then Product → Clean Build Folder (Shift-Cmd-K) and build again. Make sure `npm install` was run — the plugin packages are read from node_modules. |
| Xcode: “Signing for App requires a development team” | App target → Signing & Capabilities → tick Automatically manage signing → choose a Team (sign in at Xcode → Settings → Accounts first). |
| Xcode: bundle identifier not available / already in use | Someone else registered it or your team cannot use it yet — change it temporarily (section 4 step 6). |
| iPhone: “Untrusted Developer” when opening the app | Settings → General → VPN & Device Management → trust the developer app (free-team builds only). |
| App shows a blank white screen | `npm run cap:sync` was not run (no web build inside the native project) — run it and build again. Check for errors in Safari → Develop → [iPhone] (iOS) or chrome://inspect (Android). |
| Xcode says CocoaPods / Podfile | Not needed — this project uses Swift Package Manager. Ignore Pods entirely. |
| Android Studio: Gradle sync fails / “SDK location not found” | Create `android/local.properties` with `sdk.dir=…` (section 5) or File → Sync Project. Also confirm API 35/36 platforms are installed in SDK Manager. |
| Android: “Unsupported class file major version” / Java errors | Gradle needs JDK 21. Android Studio → Settings → Build Tools → Gradle → Gradle JDK → choose the embedded JDK (21). In a terminal set `JAVA_HOME` to a JDK 21. |
| Play Console rejects the bundle: “not signed” / “debug key” | The .aab must be the release bundle signed with the test keystore (keystore.properties in place, or Generate Signed App Bundle). Debug APKs are for sideloading only. |
| Play Console: “version code 1 has already been used” | Raise versionCode in `android/app/build.gradle` and rebuild. |
| Notifications never appear on Android 13+ | Tap “Remind me on this phone” once so the app asks for permission; if it was denied, Settings → Apps → OHRR → Notifications → Allow. Reminders fire at 9:00 AM on the due date. Battery-saver modes can delay them slightly (they are scheduled with “allow while idle”). |
| Notifications never appear on iPhone | Settings → Notifications → OHRR → Allow. iOS also drops pending notifications if the app is deleted and reinstalled — set them again. |
| Camera button does nothing / permission denied | Android: Settings → Apps → OHRR → Permissions → Camera. iPhone: Settings → OHRR → Camera / Photos. The app shows a message pointing there. |
| Donate / website links open inside the app instead of the browser | They should not — every http(s) link to another site is intercepted (src/native/browser.ts). If one slips through, note the page; it is a one-line fix. |
| `npm run cap:sync` fails with “dist not found” | The web build failed first — run `npm run build` alone and fix the error it prints. |

## Appendix — how the native pieces fit

- `capacitor.config.ts`: app id / name, `webDir: dist`, `server.androidScheme: https` (the app is served from https://localhost inside the Android WebView, like the website), splash and status-bar colours, notification small icon.
- `src/native/platform.ts`: `isNative` (true only inside the app) and the status-bar / splash setup. Every native call in the app checks `isNative` first, so the web bundle only carries this check.
- `src/native/camera.ts`: `pickPhoto('camera' | 'library')` → Capacitor Camera → data URL → the same 512px downscale as the web.
- `src/native/reminderSchedule.ts` + `notifications.ts`: a reminder id becomes a stable numeric notification id; a one-off schedules once at 9:00 AM local; a repeat schedules the next 6 occurrences; Mark done / edit re-schedule, delete / archive cancel; an overdue reminder nudges at the next 9:00 AM.
- `src/native/browser.ts` + `NativeBridge.tsx`: one document-level click handler sends outside http(s) links (or `target="_blank"`) to the system browser; the Android back button and notification taps are handled in NativeBridge, mounted once in `main.tsx`.
- Android permissions (`android/app/src/main/AndroidManifest.xml`): CAMERA, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED. The photo picker needs no storage permission. iOS usage strings are in `ios/App/App/Info.plist`.
