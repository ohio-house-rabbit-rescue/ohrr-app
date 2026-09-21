# OHRR App — START HERE (orientation & resume guide)

> Read this **first** if you're picking the project up cold — a brand-new Claude
> session, or John after a gap. It maps where everything lives, what is durable,
> why Claude sessions kept disappearing, and how to resume in ~2 minutes.

---

## Resume in 3 steps

1. **Open your session in the code repo on local disk:** `C:\Users\johns\ohrr-app`
   — **not** the Google Drive folder. (See "Why sessions kept disappearing.")
2. `git pull`, then read **`docs/PROGRESS.md`** (the live status) plus the design
   docs `docs/00`–`03`.
3. Continue. Commit + push after every meaningful change; at the end of each work
   chunk update `docs/PROGRESS.md`, push it, and mirror it to the Drive folder as
   `04-progress-log.md`.

---

## Where everything lives (the storage map)

| What | Location | Durable? | It's the record of… |
|---|---|---|---|
| **Code + docs (working copy)** | Local disk: `C:\Users\johns\ohrr-app` | ✅ local SSD | the app |
| **Code remote (canonical)** | GitHub: `ohio-house-rabbit-rescue/ohrr-app` | ✅ cloud | the app — source of truth |
| **Design docs (canonical)** | Drive Shared Drive → "07-OHRR App / OHRR App Design" (`00`–`04` + this file) | ✅ cloud | research & strategy |
| **Live app** | https://ohrr-app.pages.dev (Cloudflare Pages auto-deploys `main`) | ✅ cloud | what's shipped |
| **Database changes to paste** | Drive "OHRR App Design" → `APPLY-*.sql` (each mirrors `supabase/migrations/*`; paste into Supabase → SQL Editor, in order: `APPLY-ALL-2026-09-17`, `APPLY-2-SCAN-ITEMS`, `APPLY-3-INBOX-BOOKINGS-PAGES`, `APPLY-4-POSTS-REACH`, `APPLY-5-HOURS-IMPACT`, `APPLY-6-PUBLIC-SHOP`) | ✅ cloud | the schema the app expects |
| **Phone builds (Android/iOS)** | Repo `android/` + `ios/` (Capacitor); built files, test keystore + passwords in Drive "07-OHRR App / Mobile builds"; steps in `docs/HANDOFF.md` (= *OHRR Mobile Build Handoff.docx* in Drive) | ✅ cloud | the test builds |
| **Claude session transcripts** | Local only: `C:\Users\johns\.claude\projects\<project>\*.jsonl` | ⚠️ local only — **not** the record | a convenience |
| **Project memory (AI)** | Local: `…\.claude\projects\<project>\memory\` | ⚠️ local only | AI continuity |

**The two clouds — GitHub + Drive — are the system of record.** Any session can
be fully rebuilt from them. The Claude session itself stores nothing you can't
recover; it's a convenience, not where the work lives. That is the entire point
of the persistence protocol: never let work sit only in a session.

The design docs are reachable **three** ways (GitHub `docs/`, the mounted Drive
folder, and the connected Google Drive integration), so a future session can read
them even if one path is unavailable.

---

## Why sessions kept "disappearing" — and the fix

**Root cause.** Every Claude project on this machine, OHRR included, was opened
from a **Google Drive Streaming path**
(`C:\Users\johns\Google Drive Streaming\Shared drives\07-OHRR App`). Google Drive
Streaming is a **virtual filesystem that mounts after login and can lag or change
location**. If Claude launches before Drive has mounted (or the mount shifts),
the project's working directory doesn't exist *at that moment*, so the app can't
list it — and pinning or renaming can't rescue a project whose path isn't there.
That's why it vanished day after day despite pinning.

**Nothing was lost.** All prior session transcripts are intact on local disk under
`C:\Users\johns\.claude\projects\C--Users-johns-Google-Drive-Streaming-Shared-drives-07-OHRR-App\`,
and every actual deliverable is in GitHub + Drive.

**The fix.** Open this project from the **local-disk repo path
`C:\Users\johns\ohrr-app`**. That path is always present the instant you log in,
so the session stays listed and pin/rename stick. You keep full access to the
Drive docs — they're mirrored into `docs/` and the Drive folder is still reachable
directly. (To pre-stage continuity, the AI memory has been copied to the local
path's project folder so it carries over when you switch.)

*Secondary mitigation* (if you ever do want the Drive folder reliably present):
in Google Drive for Desktop, right-click the "OHRR App Design" folder →
**Available offline**, so it's backed by a real local copy instead of streamed.

---

## Finding / resuming an old session

Transcripts are `*.jsonl` files in the project folder above. In the Claude Code
CLI, `claude --resume` (run from the project's working directory) shows a session
picker; the desktop app has a history list. Because session discovery is keyed to
the working directory, sessions started from the Drive path and sessions started
from the local path are listed separately — going forward, keep using the local
path so they all stay together.

---

## Seeing all the documentation (for John)

Everything is readable without opening a code session:

- **Google Drive** → Shared drive "07-OHRR App" → folder **"OHRR App Design"**:
  `00-README.md` (index), `01-OHRR-org-profile.md`, `02-app-strategy-and-findings.md`,
  `03-conversation-summary.md`, `04-progress-log.md` (live status), and this
  `START-HERE.md`. Markdown files preview as text in Drive.
- **GitHub** → `chasingtheunicorn/ohrr-app` → `docs/` has the same set (renders
  nicely formatted on github.com).

If you'd prefer the docs as native, prettier Google Docs (instead of `.md`), ask
and they can be converted.
