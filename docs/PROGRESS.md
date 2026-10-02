# OHRR App — Progress Log

> The single source of truth for "where is this project right now." A fresh
> session (human or AI) should be able to resume from **GitHub `main` + this file
> + the Drive design docs** alone. Keep it current: update and push at the end of
> every work chunk, and mirror a copy to the Drive folder "OHRR App Design" as
> `04-progress-log.md`.

- **Last updated:** 2026-10-01 (ADD A DELIVERY FROM ITS INVOICE — a PDF or a photo of the paper invoice is read on the phone or laptop (no AI, no outside service), its lines matched to Hop Shop items, the stock added and the delivery kept with what shipping really cost; update 42 RUN BY OHRR and checked live — RUN-THIS has nothing to run, next is 43; not yet tried on a real supplier invoice; before that ITEM NUMBERS WITH A SYSTEM — donations DON-00001, Hop Shop SKUs HAY-101-001 (type-vendor-item), product types, vendor numbers, supplier shipping, Hop Shop price labels; update 41 RUN BY OHRR and checked live — RUN-THIS has nothing to run, next is 42; before that SCAN AN ITEM ON THE WEBSITE for laptop users — type or USB-scan a code, read it from a webcam or a photo, drag photos onto the item forms; before that STAFF PORTAL IN GROUPS — a Today row + 8 groups on one phone screen; the home bar takes you home, no drop-down list; before that TWO WAYS TO ADD — Add a donation + Hop Shop inventory; DONATION INTAKE: drop-offs, thank-you letters, where it's headed, value each/for all, split, baskets, monthly report — update 40 RUN BY OHRR and checked live, RUN-THIS has nothing to run, next is 41; staff portal grouping proposed; before that STAFF DASHBOARD CRASH FIXED — blank on a fresh open since 61be387; "ADD HOP SHOP STOCK" door and "Hop Shop inventory" on the app and website; before that DONATION DETAILS — how many, price, condition, sort of thing, where it's kept; update 39 RUN BY OHRR and checked live — RUN-THIS has nothing to run, next is 40; Hop Shop shelf empty because no active products, not a code fault; before that FEATURE SWITCHES FOR FOUNDERS/DEVELOPERS + COVER PHOTO, PHOTO ORDER, GALLERIES — update 38 RUN BY OHRR and checked live; before that CATALOG FIX + FOUR PHOTOS PER ITEM — update 37 RUN BY OHRR and checked live; before that OHRR-JOBS EDGE FUNCTION DEPLOYED from this PC with the Supabase CLI — phone notifications on, daily RescueGroups check live; UPDATES 35 AND 36 RUN BY OHRR and checked live — RUN-THIS has nothing to run, next is 37; before that CATALOG DONATIONS + PRINT LABELS (update 36); the silent auction is ON HOLD at OHRR's request since 2026-09-29, its database part (update 35) now in place; before that SILENT AUCTION: online bidding, Buy Now, cards on file via Stripe, pickup/shipping; payment server live at ohrr-website.pages.dev/api/auction/* awaiting OHRR's three secrets; before that updates 33 and 34 run by OHRR and checked live — RUN-THIS has nothing to run; the Saturday vet clinic is bookable; before that the board comparison PDF; Happy Tails example, Easter campaign, cost article, clinic Saturdays; persona audit fixes; page art + two-tone tiles; before that 2026-09-26: wish-list items, rabbits kept up to date from RescueGroups, phone notifications, My Bunny photos on the account; update 32 SQL applied and checked 2026-09-26; the ohrr-jobs Edge Function was NOT reachable at /functions/v1/ohrr-jobs yet; Cloudflare Web Analytics switched on by OHRR)
- **Repo:** https://github.com/ohio-house-rabbit-rescue/ohrr-app
- **Live site:** https://ohrr-app.pages.dev
- **Local working tree:** `C:\Users\johns\ohrr-app` (this is the git repo; the
  Google Drive "OHRR App Design" folder holds the canonical *design* docs only).
- **New here? Read [`START-HERE.md`](START-HERE.md) first** — storage map, how to
  resume, and why Claude sessions kept disappearing (open the project from the
  local repo path above, **not** the Google Drive Streaming path).

---

## Current state (at a glance)

- **Add a delivery from its invoice, 2026-10-01 (app `6fbbd57`, website `77eb52a`; update 42 APPLIED and checked live 2026-10-01).**
  OHRR: "one thing we would like to do is upload an invoice and then that would fill in the items and the quantity.
  how can we do this in a simple form?" Answers: invoices come as "PDF by email" and "Paper in the box"; "Keep a
  delivery record".
  - **Where:** Staff → Items → **Add a delivery** (`/staff/hopshop/deliveries/new`); also the Hop Shop Reorder tab
    ("Something arrived? Add it from the invoice"), each supplier card ("Deliveries from X") and **Past deliveries**
    (`/staff/hopshop/deliveries`).
  - **Reading, on the device only:** a PDF's own text with pdf.js; a photo (or a scanned PDF) with Tesseract OCR in
    the browser (its English data, about 5 MB, downloads from jsdelivr the first time). Nothing is sent to an AI or any
    paid service. Finds the supplier, invoice number and date, subtotal, shipping, tax and total, and each item line.
  - **Matching, plain rules:** the supplier's item number on a pack size (a case of 12 adds 12) or on the item, a
    match staff told it to remember for that supplier, the packet barcode, then the item name (marked "check it").
    Quantity × price is checked against the line total; the lines are checked against the subtotal. A line can become
    a new Hop Shop item (kept off the shelf until it has a price).
  - **Save:** "Add N items to stock" adds the units, takes them off "on order", updates each item's cost, keeps the
    invoice file (private), and offers "Print N price labels". The same supplier + invoice number twice is stopped
    unless "add it anyway". **Past deliveries** shows the year's spending and shipping, each delivery's lines, See the
    invoice, Print labels and Undo (takes the items back off stock and deletes the record and file).
  - **Database update 42** (`20261002100000_deliveries_from_invoices.sql`): supplier_deliveries,
    supplier_delivery_lines, supplier_invoice_matches, the private `invoices` bucket, receive_delivery /
    list_deliveries / delivery_detail / undo_delivery / forget_invoice_match. Tested on an in-memory Postgres (28
    checks), the reader on made-up invoices (31 checks), and both sites end to end with the database mocked.
  - **Still to do:** try it on real supplier invoices — OHRR can drop a PDF and a phone photo of a paper invoice in
    Drive `OHRR App Design/Sample invoices/`; layouts it misreads get a fix and a test case.
- **Item numbers with a system, Hop Shop labels, shipping, 2026-10-01 (app `cc046bf` + `ed9bce4`, website `b2669a4`; update 41 APPLIED and checked live 2026-10-01).**
  OHRR: "on the hop shop items this looks really good. we will need the label printing capability like we have on the
  donations. also for the sku lets make them very different than the donations so they have a system behind them" ·
  "on the supplier side there should be a shipping section … if there is a minimum order for free shipping" · "the
  donations can be a systematic order like DON-000001 … the vendors could be attached to a vendor number which can be
  attached to a product type" · "no other labels or codes are in use yet. you can delete the old or update with the new
  format." Chosen: DON-00001 and TYPE-VENDOR-ITEM.
  - **Numbers:** donations (and the auction/raffle items, splits and baskets they become) get the next DON number from
    the database. Hop Shop SKU = type letters (Types: HAY PEL TRT TOY LIT HSE GRM GFT OTH, staff add more) + the
    supplier's vendor number (101, 102 …; 000 = no supplier) + an item number: HAY-101-001. The SKU follows the type
    and supplier until its label is printed, then stays ("Give it a new … SKU anyway" on purpose). A packet barcode is
    a second code; a donation sorted into the shop keeps its DON number as a second code. Existing items renumbered;
    `OHRR-XXXXX` codes, "Give it a new code" and the blank tag sheets are gone (`/staff/items/tags` → labels).
  - **Hop Shop inventory:** type chips (+ New type) in place of the free-text category, the SKU preview, Barcode on the
    packet; SKU, barcode and "Came in as DON-…" on cards; a Labels button per card and in the header; "Added X as
    SKU. Print its labels →"; a **Types** tab. **Reorder:** Subtotal, Shipping, Total, "Add $X more for free
    shipping"; Arrived → "Print N labels". **Suppliers:** vendor number; a **Shipping** section (always free / flat
    rate per order / it varies / we pick it up; free shipping from $X) with a one-line summary.
  - **Labels:** `/staff/hopshop/labels` price tags (OHRR HOP SHOP, name, price, barcode, SKU; price on/off; one per item
    in stock; `?code=&copies=`); donation labels leave shop items out and print the full DON number. A shop label's QR
    opens the public Hop Shop for shoppers, Scan for staff. Scan's "No label on it yet?" → Add a donation / Add to Hop
    Shop inventory; the Saved screen offers "Print its label".
  - **Database update 41** (`supabase/migrations/20261001180000_item_numbers_and_shipping.sql`, 8 chat parts): code_counters,
    product_types, suppliers.vendor_no + shipping, hopshop_products.type_id/barcode, item_tags.is_alias; new
    normalize_item_code, new_item_code, make_product_sku, refresh_product_sku; save_product (+ p_type_id, p_barcode,
    p_new_sku; old p_sku still accepted), save_scanned_item, catalog_new_item, set_item_extras, tagged_item_json,
    list_tagged_items, counter_add_item, counter_link_code, list/save/delete_product_type. Checked live over REST.
  - Tests: the whole migration history + 41 run in PGlite (in-memory Postgres) with old-style data first — 71
    checks (renumbering, SKUs following until printed, barcodes, sort into the shop and back, splits, baskets, the till,
    running 41 twice); browser `app41/app41_test.py` 75 checks + `tag_landing_test.py`; earlier suites moved to DON
    numbers and passing (catalog 35, intake40 45, app40 73, groups 25, switches 21). tsc, build, 231 checks, hooks scan.
  - **Website** (`b2669a4`, helper): the same — `lib/codes.ts` + `lib/labels.ts` copies, Hop Shop form/cards/Types/Reorder
    shipping/supplier Shipping, `/staff/hopshop/labels`, donation labels without stock, `items/tags` → labels; packet
    barcode by camera or "read it from a photo"; its "Add a donation" keeps a scanned number only when it's a DON number.
    216 mocked checks. Website keeps 999 copies per label (app 200).
  - App follow-ups (`ed9bce4`): Enter in "New type" inside the product form adds the type instead of saving the product;
    the donation and Hop Shop label pages no longer share ticks when switching between them.

- **Scan an item on the website, for laptops, 2026-10-01 (website `8628706`).**
  OHRR: "on the web version for the laptop users i think they still need the option to scan and input like on the
  app. they can upload images if they have them verse use the camera."
  - **`/staff/scan`:** a type box with the focus (a USB scanner types the code and presses Enter; the code stays
    selected so the next scan replaces it); "Use the camera" (webcam) and "Read the code from a photo" (choose or
    drop a picture). Found → photo, name, kind, status, details line, Open it / Print its label / Scan another.
    Not found → "What is it?": A donation or A Hop Shop item, each with the code filled in (a shop barcode puts
    the Hop Shop first; without Hop Shop access only A donation). Same people as Items and Add a donation.
  - **Dashboard:** website Today row = Inbox, Bookings, Scan; Scan an item also listed in Items and Hop Shop.
  - **Photos from a laptop:** drag-and-drop onto Add a donation, the item photo editor and the Hop Shop form (four
    photos, cover first, unchanged). Laptops get "Choose a photo"; "Take a photo" only on phones and tablets.
  - ZXing (`@zxing/browser` 0.2.1, as in the app) reads the codes; it loads only when the camera or a photo is
    used. Chrome on Windows has no BarcodeDetector, so ZXing does the work there.
  - Tests: helper `webscan/testscan.py` 103 checks (every flow, photo reading, drag and drop, camera messages, a
    fake webcam video, no sideways scroll at 1300 and 375); `webgroups/testg.py` updated for the new Today row.
    Build and hooks scan clean; checked that the live website serves `/staff/scan`.

- **Staff portal in groups + the home bar goes home, 2026-10-01 (app `70d9fd9` + `b208ac0`, website `1ebc2a4` + `ca7599b`).**
  OHRR: "clean up the staff portal … too many in the list and you have to scroll a long way … bin these into groups and
  simplify the look and feel" (mock-up approved: "this looks better … we need the dashboard simplified"); then "the home
  button you have opens a list. i think just taking the user back to the home works better so they land on the home
  screen."
  - **Staff home:** a Today row (Inbox, Bookings, Counter, Scan, with waiting counts) + 8 group tiles — Items and Hop
    Shop, Rabbits and care, Volunteers (orange), Events and BunFest, Getting the word out, Supporters and giving, Admin,
    Me — on one phone screen (was ~40 tiles). A group shows only if the person can open something in it; a one-page
    group opens that page. `/staff/g/:group` lists a group's pages (icon, title, one line, a count). Me holds My
    account, My volunteer hours, Your access, Signed in as, Delete account.
  - **No drop-down menu:** under the top bar, on every page but the staff home, "[home] Staff › Group" (Staff → the
    staff home, Group → its list); the page title isn't repeated, so nothing is cut off at 375px. Beside Back the top bar
    drops the "OHRR Staff" name (it truncated and wrapped "Sign out").
  - **One list** of every staff page with its group and permission check — app `src/features/staff/staffTiles.ts`,
    website `src/lib/staffTiles.ts`; every old dashboard/menu page is still reachable (app 42, website 39 ways in).
    Website: same groups; Today = Inbox, Bookings (no Counter/Scan there); laptop sidebar = Dashboard, Today, the 8
    groups; Share kit gets `/staff/posts?view=kit`; on phones Back to the website / My account / Sign out moved to the
    bottom of the staff home and the Me page.
  - Tests: scratchpad `groups_test.py` 25 checks (Founder, a volunteer lead, 375 and 1300, every old page reachable;
    also run against the live app), `intake40_test.py` 45, `catalog_test.py` 35, `switches_test.py` 21; website
    helper `webgroups/testg.py` 105. tsc, build, 231 checks, hooks scan clean.

- **Two ways to add + donation intake, 2026-10-01 (app `9dd69ad` + `8b4ad5e`, website `f652ab7`; update 40 APPLIED and checked live 2026-10-01).**
  OHRR: "we get a donation and then you ask where it goes … tell it a donation, then we sort it out later or a hop shop
  … a value input … an each, or box version … a simple check the box for a donation that we know goes to a raffle or a
  silent auction"; picked every extra offered (drop-off + thank-you, split a lot, baskets, for the rabbits + passed on +
  use-by, label copies, monthly report, a Size box); a ticked donation STAYS a donation until sorted. Then, mid-build:
  "we have 3 ways to add things and it is confusing. the hop shop inventory is the right setup for those items. the
  others are simpler and should remain that way."
  - **Audit — five ways to add were found:** Catalog donations, "Add Hop Shop stock" (catalog stock mode, added earlier
    the same day), Hop Shop inventory → Add (full form), Scan an item on an unknown code (auction/raffle/stock), the
    Counter's "Add a new item". **Now two:** "Add a donation" (simple) and **Hop Shop inventory → Add** (supplier, cost,
    price, packs, reorder — the one place shop items are added; `?add=1` opens it, `?code=` fills the code, new "Scan
    the barcode on the packet"). The stock tile and catalog stock mode are gone (`?kind=stock` redirects); a new scanned
    code is "A donation" or "A Hop Shop item" (→ the form with the code); the Counter's tile and `/staff/counter/add`
    open the form (CounterAdd.tsx deleted). Auction/raffle items come from sorting donations (or the Silent Auction /
    Raffle managers).
  - **Add a donation:** who it's from once per drop-off (name with recent chips, optional email for the thank-you, the
    day; remembered for the day), then photo, name, how many, value with **Each / For all** ("$10 each · $500 in
    all"), **where it's headed** (Not sure yet / Raffle / Silent Auction / Hop Shop / For the rabbits); More details =
    size, condition, sort of thing, where kept, use-by, price, notes. Saved screen → Next item / Print this label /
    Finish this drop-off (→ its page and letter).
  - **After intake:** Items opens on "Donations to sort" with where-headed chips, "Move all N to the raffle" (Silent
    Auction, Hop Shop — unpriced ones arrive hidden — or "used for the rabbits"), Use soon badges, Make a basket (value
    adds up). A donation: Split this lot, Used for the rabbits, Passed on / not usable, Undo; shows its basket; a basket
    lists its contents. Sorting into the raffle/auction starts the prize at the whole lot's value. **Drop-offs** list +
    page with an editable **thank-you letter** (print, email to the donor, copy, mark thanked, values off by default),
    **monthly donations report** (totals, where it is now, by donor, print, CSV), **label copies** ("One per piece").
  - **Update 40** (`20261001160000_donation_intake.sql`): `donation_dropoffs`; donation_items + dropoff_id, headed_for,
    value_basis, size, use_by, outcome (sorted / basket / rabbits / passed_on), sorted_kind, sorted_tag_id, split_from;
    **a sorted donation stays on record** (save_scanned_item marks it 'sorted' instead of deleting; moving back re-opens
    it) so letters and the report still see it; donation_value_total/each; tagged_item_json (new fields, basket
    contents); delete_item_by_code frees a basket's contents; start/update_dropoff, set_dropoff_thanked, list_dropoffs,
    dropoff_detail, set_donation_plan, set_donation_outcome, split_donation, make_basket, sort_headed_donations,
    donations_received; catalog_new_item + p_plan; recent_donors + drop-off names. Given as 7 chat blocks.
  - **Before update 40** everything saves (catalog retries without p_plan, a "for all" value is saved as one piece's so
    it doesn't later read 50× too high); the screens say what waits.
  - Tests: scratchpad `intake40_test.py` 45 checks (incl. before-40, live check after deploy), `catalog_test.py` 35,
    `switches_test.py` 21, `app40/app40_test.py` 73 + `letters.test.ts` 43 (helper); website helper 151 checks
    (`web40/test40.py`). tsc, build, 231 checks, `scripts/hooks-scan.py` clean.
  - **Update 40 run by OHRR 2026-10-01** (7 chat parts). Checked live over REST: the new donation_items columns and
    `donation_dropoffs` answer; all 13 new/changed functions answer ("Not authenticated" / "Not allowed" / [] for
    anon); `donation_value_total(1000,'each',50)` = 50000 and `donation_value_each(50000,'all',50)` = 1000. Filed as
    `APPLY-40 (applied 2026-10-01).sql`; RUN-THIS has nothing to run (next is 41). Not yet tried with a real signed-in
    drop-off — worth one test item.
  - **Next (OHRR, mid-build):** "clean up the staff portal … too many in the list … bin these into groups and simplify".
    Mock-up shown in chat, approved, built the same day (entry above).

- **Staff dashboard crash fixed + "Add Hop Shop stock", 2026-10-01 (app `9e77224`, website `af7e784`).** OHRR: "i was
  in the staff list. i went to add a donation and that was there but there was not add inventory just a scan an item which
  i think leads to a purchase or something."
  - **Bug (mine, from `61be387`):** StaffHome called `useAllAccess()` below its early returns, so opening /staff fresh
    (auth still loading on the first render) threw React error #310 and the dashboard came up blank on the LIVE app;
    arriving from another page worked, which is why tests and OHRR's in-app taps mostly missed it. Hook moved above the
    returns; confirmed blank on live before, loading after deploy (mocked sign-in). New `scripts/hooks-scan.py` (no ESLint
    here) flags a hook after a top-level early return; app, website and BunFest scan clean.
  - **App:** "Add Hop Shop stock" on the staff list and in the menu → `/staff/catalog?kind=stock` (the catalog in stock
    mode: photo, name, how many, price; no donor question; title "Add Hop Shop stock"); "Catalog donations" never opens on
    stock. "Hop Shop" → **"Hop Shop inventory"**, moved up beside Catalog / Items. "Scan an item": "Point the camera at a
    label to see, change or sort that item. Not a sale." New stock is active by default, so it fills the public shelf
    (the Hop Shop shelf was empty because no products exist yet — see the entry below).
  - **Website:** Dashboard tiles "Add Hop Shop stock" (`/staff/hopshop?add=1` opens the new-item form, param removed,
    focus on the form) and "Hop Shop inventory" beside Items; menu and page title renamed; Items page link under "Add a
    donation"; BunFest vendor hints say "Hop Shop inventory → Suppliers".
  - Tests: scratchpad `stock_door_test.py` 14 checks (also run against the live app after deploy), `catalog_test.py` 35,
    `switches_test.py` 21; website helper 90 checks (founder and a lead without create, 1300×675 and 375×740). tsc,
    build, 231 checks pass.

- **Donation details + Hop Shop shelf check, 2026-10-01 (app `66e626b`, website `b45bf82`; update 39 APPLIED and checked live 2026-10-01).**
  OHRR: "the hop shop inventory does not show anymore. also the donation items should have things like quantity and
  possible price etc. … a few more details that the scanner person can enter."
  - **Hop Shop:** not a code fault. `hopshop_public_products` answers `[]` for visitors, and it did before update 38 too
    (the website helper saw the empty shelf then); the Hop Shop items switch reads ON. The public "On the shelf now" list
    only shows **active** rows in `hopshop_products`, and there are none. Staff lists were not changed. OHRR was given a
    one-line SQL check (products, active, on hand) and asked which screen they were looking at.
  - **Donation details:** Catalog donations → What is it? now has **How many** (stepper, starts at 1) and **Price for
    one** ("if it may be sold") on the screen, and a **More details** toggle (remembered per phone) with What is it worth,
    Condition (New / Like new / Good / Fair), What sort of thing (recent + starter chips, or type), Where is it kept
    (recent chips; **stays filled for the next item**, since a box usually goes to one bin) and Notes. Scan an item →
    Details on a donation has the same; shop stock gets sort of thing + shelf. The details line ("3 of them · $5 each ·
    Like new · Toys & chews · Kept: Bin 3") shows on the Saved screen, the item card and the items list. Sorting a
    donation carries them: to the Hop Shop = price, stock count, sort of thing, shelf; to auction/raffle = worth, and the
    condition is added to the notes. New `features/scan/DetailsFields.tsx`. Website Items page mirrors it (Add a donation
    grid, edit panel, stock edit, list rows, Move to Hop Shop fills price + count); until update 39 runs the website's
    edit panel shows a note instead of fields the database would drop.
  - **Update 39** (`20261001140000_donation_details.sql`): `donation_items` gets quantity / price_cents / condition /
    category / location; `condition_label()`; `tagged_item_json` returns them (stock: category + shelf);
    `save_scanned_item` keeps them and carries them on a move (blank quantity keeps the old one — `greatest(1, null)` is
    1 in Postgres, so it uses a `case`); `set_item_extras()`; `catalog_new_item` with the extra arguments (old 10-argument
    version dropped); `catalog_suggestions()` (recent places and sorts). Before 39 runs: the catalog retries the old call,
    the item is saved, and the Saved screen says the details need update 39.
  - Tests: scratchpad `catalog_test.py` 35 checks (details sent, place carries over, pre-39 retry + note, Scan → Details
    → `set_item_extras`), `switches_test.py` 21; the website helper's Playwright run (after and before 39, 1300×675 and
    375×740). tsc, build, 231 checks pass.
  - **Update 39 run by OHRR 2026-10-01** (four parts, given in chat). Checked live over REST: the five new
    `donation_items` columns answer, `condition_label('like_new')` = "Like new", `set_item_extras` and the 13-argument
    `catalog_new_item` answer "Not authenticated", `catalog_suggestions` answers empty lists for a non-member. Filed as
    `APPLY-39 (applied 2026-10-01).sql`; RUN-THIS has nothing to run (next is 40). Still open from this round: OHRR's
    answer on the Hop Shop shelf (the one-line product check, and which screen).

- **Feature switches for Founders and Developers + cover photo, photo order, galleries, 2026-10-01 (app `61be387` +
  `07a9096`, website `6c13fd3` + `5ee03e9`, BunFest `a6e2aa1` + `ee94841`; update 38 APPLIED and checked live 2026-10-01).** OHRR: choose the
  "hero shot" like Instagram, see all four photos in order when an item opens, reorder saved photos; and "at the developer
  and founder levels … turn on and off major features … like the silent auction … then when we are ready … visible".
  - **Photos:** the first photo is the **Cover**. Catalog strip: tap a photo to make it the cover. Photos page: Move earlier
    / Move later arrows, Make cover, Remove (website editor the same). `PhotoGallery` (swipe strip, "2 of 4", Previous /
    Next chevrons, thumbnails; print = cover) on the auction item page (all three sites), the staff item card, and Hop Shop
    products ("See all N photos"). Lists keep the cover.
  - **Switches:** Staff → Features is Founders and Developers only (`useAllAccess()`; update 38 `can_set_app_setting()`
    makes the database refuse others for `*_enabled` keys, and audits each flip). New: **Silent Auction**, **Hop Shop items
    online**, **Phone notifications** (all default ON). OFF = gone for visitors on the app, the website and the BunFest
    site; signed-in staff still see it under "Hidden from the public" (`useFeature` / `FeatureGate`). Auction OFF also
    closes online bidding and blocks reopening it; a bidder's own "Your bids" page stays open (winners still need it).
  - **Update 38** (`20261001120000_feature_switches_and_photo_order.sql`): `feature_on()`, `can_set_app_setting()` +
    app_settings policies, switch trigger (audit + close bidding), auction_settings guard, `auction_item_json` /
    `auction_catalog` (`enabled`, items hidden from non-members while off) / `auction_item_by_code` with `photo_urls`,
    `hopshop_public_products` with `photo_urls` (empty for non-members while off), `push_messages_send` skips while off.
  - Tests (scratchpad): `switches_test.py` 21 checks (visitor vs staff, Founder vs Board, gallery), `catalog_test.py` 28,
    `me_open_test.py`; helpers ran 82 BunFest checks and the website's own. Before update 38 everything works with the
    single-photo fallback and UI-only hiding.

- **Catalog fix + up to four photos per item, 2026-10-01 (app `6011c36`, website `a8289e6`; update 37 APPLIED and checked live 2026-10-01).**
  OHRR tested the catalog loop on the phone: the first photo never showed, a later one showed but didn't save; asked for
  photo → description → Save → next or print, and up to four photos per item. **Cause, reproduced in a browser test**
  (Playwright, mocked sign-in, the OS file chooser): the hidden camera input was swapped for a new element when the
  screen changed, so the camera's answer landed on a detached element and never reached the page. Fix: the inputs live
  above every screen. Flow now: Start → camera → What is it? (photo strip, main first, × / Make main, + up to four; name
  with mic; donor chips) → **Save** → Saved screen (thumb, name, donor, code; Next item / Print this label / I'm done;
  Change something). Save waits for the background uploads (one retry); a failed photo leaves the item saved with an amber
  note and Try again. **Update 37** (`20261001100000_item_photos.sql`): `photo_urls text[]` on donation_items /
  raffle_items / raffle_prizes / hopshop_products (filled from photo_url), `clean_photo_urls()`, `set_item_photos()`,
  `tagged_item_json` returns photo_urls, `save_scanned_item` keeps the list (a new main photo replaces the first; a move
  carries it). App: `/staff/items/photos?code=` (add / Make main / Remove), Scan an item → Photos goes there, ItemCard
  shows the extra thumbs, Print labels `?code=` ticks one label. Website: Add a donation takes several photos, the edit
  panel has a Photos editor, Print labels `?code=`. Until 37 runs the first photo saves and the Saved screen says the
  others need the update. Test: scratchpad `catalog_test.py` (23 checks; fails on the old page, passes now). Also
  2026-09-30: the `ohrr-jobs` function deployed from this PC with the Supabase CLI (see below).
  **Update 37 run by OHRR 2026-10-01** (parts 1–3, then the save function as part 4). Checked live over REST: the
  `photo_urls` column answers on all four tables, `set_item_photos` and `save_scanned_item` answer "Not authenticated"
  for anon, `clean_photo_urls` drops blanks and repeats and keeps four, and all 7 auction items that had a photo now
  carry it as the first of their list. `APPLY-37 (applied 2026-10-01).sql` filed; RUN-THIS says nothing to run.

- **`ohrr-jobs` Edge Function deployed, 2026-09-30.** OHRR asked to clear this first. Deployed from the repo with the
  Supabase CLI (`npx supabase@2 functions deploy ohrr-jobs --project-ref ixxzebtzjgeimoijexwn --no-verify-jwt --use-api`);
  a Supabase CLI login saved on this PC since August let it through, so no dashboard step was needed, and no
  `supabase/config.toml` is required. Checked live: the function answers `{"error":"not allowed"}` without the shared
  secret (JWT check off; the secret guards it); anon `init_push` made the web-push keys within 5 s, so `push_public_key`
  is set and phone notifications are switched on for the web app (iPhone: Add to Home Screen first). The 7:15 AM Ohio
  RescueGroups check (pg_cron 11:15 UTC) now reaches the function; first proof = Staff → Adoptable rabbits → "Check
  RescueGroups now" or tomorrow's run (`job_runs`). Not yet seen: a real push on a phone, a real RescueGroups run.
  Deploy note added to `supabase/README.md`.

- **Database up to date, 2026-09-30.** OHRR ran updates 35 (silent auction, on hold) and 36 (cataloging + labels) from
  RUN-THIS in one paste. Checked live over REST with the publishable key: `auction_catalog` answers with the sample items,
  `auction_bidders`/`auction_sales` exist, `place_bid` answers with its own message; `donation_items`,
  `item_tags.donation_id`/`label_printed_at`, the three-argument `list_tagged_items`, `catalog_new_item`,
  `mark_labels_printed` and `recent_donors` all answer (permission messages for anon, as designed).
  `APPLY-35`/`APPLY-36 (applied 2026-09-30).sql` filed; RUN-THIS says nothing to run (next is 37). **Still OHRR's own:**
  test the catalog loop on a phone and a print on the Phomemo; an email-sending account (outbid notices, automatic letters); Apple and Google developer accounts + the iOS
  workflow file (the GitHub token lacks the `workflow` scope); the payments decision (Donate page, Counter card reader);
  a Founder account; when the auction resumes, the Stripe account + three Cloudflare secrets + a test-mode dry run; the
  privacy page stays Draft until the board reviews it.

- **Catalog donations fast + print labels, 2026-09-29 (app `c1be452`, website `be15ca2` + `40f9429`; update 36 APPLIED and checked live 2026-09-30).**
  OHRR: "a simple process for the staff to inventory, take a photo, label and provide a name, donor etc… print to a thermal
  printer that can create barcodes… photo from phone camera, voice to name the item and then hit next." Decisions: label =
  QR + barcode + code + name + donor; everything saved as "Donation — sort later"; OHRR's printer is a **Phomemo PM-249-WF**
  (203 dpi, 1–4.6 in labels, Wi-Fi/USB, no AirPrint → phones print through the Labelife app's "PDF processing", laptops
  through Phomemo's driver with a custom page size).
  - **Update 36** (`20260930120000_donations_catalog.sql`): `donation_items`; `item_tags.kind` gains `donation`
    (+ `donation_id`, `label_printed_at`); `catalog_new_item()` makes the OHRR code server-side and saves in one call;
    `mark_labels_printed()`; `recent_donors()`; `list_tagged_items(p_org, p_kind, p_unprinted)` re-created; `save_scanned_item`
    and the status/publish/delete RPCs learn the fourth kind (moving a donation into the auction/raffle/stock keeps its code).
  - **App:** Staff → **Catalog donations** (`/staff/catalog`): camera → say (Web Speech mic) or type the name → recent-donor
    chips → Next reopens the camera at once while the save runs in the background ("Saved · OHRR-7K3PX" line, retry on
    failure); per-session kind chip; today's count; labels-to-print count. **Print labels** (`/staff/labels`): size presets
    (2¼×1¼ default, 2×1, 62×29 mm, 3×2, 4×2, 4×3, 4×6 with photo) + custom, remembered per device; unprinted ticked by
    default; preview; browser print (one label per page, `@page` at the label size) or a PDF (jsPDF) — on the phone the PDF
    goes to the share sheet (Labelife); marks printed with undo. `labels.ts` painter: QR left, name shrinks to fit (never
    cut first), donor + kind under it, Code 128 barcode across the bottom, code beneath; photos drawn via CORS. Items list:
    "To sort" filter, Catalog/Scan/Print labels/Blank tags buttons; scan flow: "Where does it go?" on a donation. Deps:
    jsbarcode, jspdf (MIT).
  - **Website:** `/staff/items` gets "Add a donation" (title, donor chips, value, photo → `catalog_new_item`), "Move to…"
    on donation rows (stock asks price + count), label-printed badge; `/staff/items/labels` (desktop two-column) with the
    same painter (`src/lib/labels.ts`, keep in sync with the app's). Verified with stubbed RPCs: print pages at the exact
    label size, 5-page PDF, graceful "run update 36" notes before the update.
  - **Checked:** labels rendered at all presets through the app's own painter (Playwright + Vite), PDF page count, staff
    routes load to the sign-in gate with no errors. **Not exercised:** the camera loop on a real phone and a real print on
    the Phomemo — OHRR to calibrate the printer, set the label size once per device and try Labelife's PDF processing.
  - **Silent auction: ON HOLD** (OHRR, 2026-09-29): nothing further until asked; update 35 stays in RUN-THIS with 36.

- **Silent auction with online bidding, 2026-09-29 (app `5bcb17a`, website `cebb649`/`bc49180`, BunFest `a7c084b`; update 35 APPLIED and checked live 2026-09-30; the feature stays ON HOLD).**
  OHRR: "a silent auction that has the ability to bid and also have a buy now option… take a credit card upfront, and
  allow… local pick up and shipping." Decisions (OHRR, 2026-09-29): Stripe; the server piece on Cloudflare Pages Functions
  next to the website; card saved BEFORE the first bid; flat shipping fee per item set by staff (null = pickup only).
  - **Database (update 35, `20260930100000_silent_auction_bidding.sql`):** `auction_settings` + bidding switch, opens-at,
    "going once" `extend_minutes` (5), `default_increment_cents`, Stripe PUBLISHABLE key, notes; `raffle_items` + starting
    bid, step, Buy Now, `ship_fee_cents`, `closes_at_override`, running bid/high bidder; new `auction_bidders` (private
    `access_token`, Stripe customer/payment-method ids only), `auction_bids`, `auction_sales` (one live sale per item;
    payment_status pending/paid/failed/cash/refunded/void; fulfil pickup/ship + status/tracking). Public RPCs:
    `auction_catalog`, `auction_item_bids`, `auction_item_by_code`, `auction_bidder_by_token`, `auction_update_bidder`,
    `place_bid` (locks the item, validates open/min/Buy Now, marks outbids, extends the close). service_role-only:
    `auction_register_bidder`, `auction_set_card`, `auction_bidder_secure`, `auction_begin_sale` (locks; buy_now or
    closing bid), `auction_finalize_sale`, `auction_sale_by_pi`, `auction_sale_get`. Staff (events.bunfest.manage):
    `auction_desk`, `auction_close_ready`, `auction_offer_next`, `auction_desk_sale`, `auction_update_sale`,
    `auction_set_bidder_blocked`, `auction_save_settings`, `auction_set_item_prices`. No new permission key.
  - **Payment server** (`ohrr-website/functions/api/auction/*` + `server/auction/*`, `wrangler.toml`,
    `public/_routes.json`): register → Stripe Customer + SetupIntent (card only, off_session); card-saved reads the PM
    from Stripe; new-card; buy-now (begin sale → charge; failure voids so the item is back on sale); pay (winner retries);
    complete (after 3-D Secure); charge (staff JWT → Postgres checks the permission: close & charge all / retry one /
    offer to next bidder); webhook (constructEventAsync + SubtleCrypto; setup_intent.succeeded, payment_intent.succeeded /
    payment_failed, charge.refunded); health. CORS for the three sites, the phone apps and localhost. Charges use an
    idempotency key per attempt; `receipt_email` so Stripe emails receipts. **Live and verified** (health, CORS, 503 until
    secrets); exercised locally in workerd with fake keys (bad signature → 400, fake service key → "Invalid API key").
    Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` in Cloudflare → Settings →
    Variables and Secrets (OHRR's step). Docs: `ohrr-website/docs/AUCTION.md` (= Drive `06-silent-auction-setup.md`).
  - **Shared client** `src/features/auction/client.ts` + `CardSetup.tsx` (copies: website/BunFest `src/lib/auctionClient.ts`,
    `src/components/CardSetup.tsx`; keep in sync). `AUCTION_API` = website `/api/auction` (VITE_AUCTION_API) or the
    website's absolute URL from the app/BunFest.
  - **Pages:** app `/bunfest/auction` (+ `/register`, `/me`, `/me/:token`, `/:id` with BidBox + Share), `/t/:code` now lands
    the public on the item; website `/bunfest/silent-auction/…`; BunFest `/auction/…`. All fall back to today's preview
    (no bidding) until update 35 runs, and Register says "hasn't opened yet" until staff switch bidding on with a
    publishable key. Staff: item editor + setup panel (both surfaces), **Auction desk** (app `/staff/auction-desk`,
    website `/staff/auction/desk` with CSV): close & charge, retry, offer to next bidder, table sale, paid at desk,
    picked up / shipped + tracking, refund link + mark refunded, void, block bidder.
  - **Facts for OHRR** (verified 2026-09-29): Stripe standard 2.9% + 30¢; the nonprofit discount needs ≥80% tax-deductible
    donation volume and Stripe says auction payments don't count; Apple 3.1.3(e) / Google Play allow physical goods outside
    IAP; Ohio R.C. 5739.02(B)(9) six-selling-days exemption — treasurer to confirm; Cloudflare Pages can't run cron
    (closing is a staff button); outbid emails need the email-sending account (still OHRR's to-do).
  - **Not yet exercised with real Stripe** (no account here; OHRR must create it): register/card/bid/buy/close flows are
    type-checked, mocked on the BunFest site, and the server paths were probed; a test-mode dry run is in the guide.
  - **OHRR's steps, in order:** run update 35 → Stripe account (keys, webhook to
    `https://ohrr-website.pages.dev/api/auction/webhook`, receipts on) → three Cloudflare secrets + redeploy → paste the
    publishable key, prices, close times → switch bidding on. BunFest is 2026-10-25.

- **Database up to date, 2026-09-29 (app `c64abb2`, website `a40d2ff`).** OHRR ran update 33 (six small chat blocks) and
  update 34. Checked live over REST: Mackenzie, Rachel, Tobias published; Edmund, Leo, Monty and the older Nimbus hidden
  (16 published = RescueGroups' 16, re-read that morning); cost article in OHRR's words. **Update 33's vet-clinic insert was
  skipped** — a hidden `vet-clinic` row already existed from the 2026-09-21 bookings seed (`on conflict do nothing`), and its
  fill set `slots_filled_on`. **Update 34** (`20260929100000_vet_clinic_publish.sql`) updates that row (15-min Saturday
  rules noon–4, staff-confirmed, published, `slots_filled_on = null`), clears unbooked future times and refills: 128 times,
  Sat Oct 3 – Nov 21, bookable on both /book/vet-clinic pages. `fmtWeekly` (both repos) now merges back-to-back rules on the
  same days into one range with their length ("Sat 12:00 PM–4:00 PM, 15-minute times"; socialization reads "Sat 1:30 PM–3:30
  PM, 1-hour times"). Lesson: before seeding a booking type by slug, check for an existing (hidden) row — use an update or
  `on conflict do update`. Still OHRR's own to-dos: the `ohrr-jobs` Edge Function (not SQL), email-sending account, Apple and
  Google developer accounts, payments, a Founder.

- **Board comparison, 2026-09-28 (document only; no code changes).** OHRR asked for a comparison a board member who knows
  only the old sites can follow: where the app, website and BunFest site could save volunteer time, reach more (and younger)
  people, or bring in money. Delivered as Drive root `OHRR Old and New - Board Comparison.pdf` (11 pages): summary, first
  screens old vs new (live screenshots), two everyday tasks, task-by-task table, the seven personas + staff, behind-the-scenes
  chores, a blank hours worksheet (no invented savings), BunFest old vs new, money, reach/next generation, limits + measures +
  decisions, and QR codes to the three sites. Sources and build script: Drive `Research/board-comparison/` (`comparison.html`,
  `build.py` = Playwright + installed Chrome, `shots.py`). Old-site facts come from read-only checks on 2026-09-28 of
  ohiohouserabbitrescue.org (WordPress: 63 pages, 9 posts, 269 links; forms by Visual Form Builder/WPForms with unseen
  destinations; SignUp.com shifts; PayPal donate; 65 outside domains) and midwestbunfest.org (Weebly: 23 menu pages; 2025 map;
  2024 RHDV2 wording; paper agreement; handwritten raffle stubs). Flagged for the board, neutrally: an older donation form on
  the old site uses a personal email as the PayPal receiver. **Update 33 is on hold at OHRR's request** ("probably tomorrow").
- **Round after the audit, 2026-09-28 (latest; app `be11ce9`, website `34bab80`; update 33 WRITTEN, NOT YET RUN).**
  OHRR's answers to the open list:
  - **Happy Tails:** one clearly marked EXAMPLE story, "Dottie" (OHRR's own photo `img/ohrr/adoption-rescued-favorite-breed.jpg`,
    "Example" badge and note, invented name/text said so), shown only while no real story is published; staff screen explains it.
    Fixed "the Patel family family" (`withFamily`).
  - **Cost article** in OHRR's own words (OHRR fees and policy; prices credited to the Missouri House Rabbit Society 2022;
    savings ideas to the House Rabbit Society); Binkybunny.com link gone. Live row = update 33.
  - **Mobile vet clinic: Saturdays noon–4 PM, 15-minute appointments** (OHRR, "Saturday-only… Four hours… 15-minute
    increments"; noon–4 = the Adoption Center's weekend hours). Booking type `vet-clinic` = update 33; wording updated.
  - **Volunteer approvals**: "as they come in… as quickly as possible" (OHRR); family age rule shown up front.
  - **Footer** "modern preview" line removed. **Privacy** stays Draft (OHRR's choice).
  - **Easter campaign** (Staff → Posts, both surfaces): plans the season's drafts from existing education cards
    (7/5/3/1 weeks before, 3/7/11 after; `source` marker `easter:<year>:<slot>`, never duplicated), painted with the Share
    kit; reminders on the queue, website dashboard and app staff home (63 days before Easter until planned).
  - **Small fixes:** Home Explore no longer repeats quick actions/tabs; top-bar buttons labelled (Search/Help/Settings/Sign in);
    Vets' RHDV2 block after the list; bonded pairs one card, one photo.
  - **Update 33** (`20260928120000_rabbits_vetclinic_cost.sql`): rabbits from RescueGroups (new Mackenzie, Rachel, Tobias;
    Edmund, Leo, Monty, older Nimbus hidden with the badge), the clinic booking type, the cost article.
  - Correction: the "Ages 5â€“12" / Buncare "â€”" garbling was a Windows console misreading the dash — the stored text was
    fine; the SQL given for it was harmless and not needed.
  - OHRR's own to-dos: email-sending account, Apple/Google accounts, payments, a Founder (all understood by the sponsor).

- **Persona audit + fixes, 2026-09-28 (latest; website `c3c619d`, app `d66c7fd`).** OHRR asked for an audit of the
  visuals and navigation against the brief's personas; three reviewers (Dana+Marcus, the Reillys+Cheryl,
  Ruth+Alan) read live captures (`scratchpad/audit/`, Playwright phone emulation — headless Chrome can't go
  below ~500px). Verdict: the drawings, two-tone tiles and orange Volunteer work; the problems were navigation.
  Fixed: app Volunteer gets the website's three doors (Apply / Pick a shift / My volunteer page) + the
  hours-and-letter line; website Bunny Help and Vets put the emergency first; Events' BunFest card shows
  admission, the rabbit rule (+ RHDV2 vets link) and parking (`BunFestFacts`); Give's doors include "See what
  your gift does"; the menu highlights the section on Legacy/Mobile vet/Found/Hop Shop/Contact; "All ways to
  give" pill removed; text links blue; app orange buttons dark text (white was ~2.6:1); drawings fainter on
  phones, hand + vet cross toned down, bunting redrawn. **Open, for OHRR:** cost + lifespan in OHRR's own words
  (Rabbit care's cost card links to Binkybunny.com); a family path for socialization shifts (ages, who applies,
  how long approval takes); real Happy Tails stories (sample ones use stock photos); Mobile vet copy ("Pick a
  time" with no dates; vaccines?); the footer's "modern preview" line; BunFest admission "Ages 5â€“12" is
  double-encoded in the events row (SQL given 2026-09-28). Not done (polish): app Home repeats its doors
  (quick actions + Explore + tabs), app "?"/gear have no visible labels, app Vets lists the RHDV2 block before
  the list.

- **Page art + two-tone tiles, 2026-09-28 (latest; app + website).** OHRR: faint white line art in the page
  tops instead of photos — the logo's bunny on Home only ("we're just duplicating the logo" otherwise, so no
  house), one item per kind of page (Adopt heart, care carrot, Give gift, Events bunting, Hop Shop bag,
  Contact envelope, Volunteer raised hand, Found pin, Vets cross, Happy Tails house-with-heart; About the
  bunny). `public/art/*.svg` (same files in both repos), `components/PageArt.tsx` (section by URL prefix,
  CSS mask, beside the title; website: only crumbs + title make room, so no band grows — checked at
  1300/1024/375). Tiles: dark blue lines + ONE orange part (`Icon accent`), only on the big tiles; small
  icons stay one colour. **Volunteer is orange** (OHRR: volunteers are the top need): solid orange tile on
  the app's Home (quick actions + Explore), orange "See the shifts" on the website's Home. Next, if OHRR
  wants it: redraw the 43 icons in the bunny's rounder line, keeping the same orange parts.
  - **Same day, OHRR clarified:** on the website the drawing is the title band's *background* — big, faint,
    top right, faded out below the upper third (`BandArt`), Home included (the bunny); and the **Volunteer
    section's band is orange** (website `brand-orange-100`, app solid orange with dark text).
  - **Vet + hand, same day:** new icon `vet` (thin circle + solid broad cross; orange cross on tiles) on every
    find-a-vet / vet-clinic button and as the vets background — the veterinary V-and-staff symbol was tried
    and dropped. Volunteer background = Tabler "hand-stop" (MIT; `THIRD-PARTY-NOTICES.md`).
- **Done 2026-09-30:** the `ohrr-jobs` Edge Function was deployed from this PC with the Supabase CLI (see the
  2026-09-30 entry at the top); update 32's notifications and the daily RescueGroups check are live.

- **Update 32, 2026-09-26 (latest; website `c5d97c9` + app the same day; update 32 SQL applied and checked live 2026-09-26 — new tables/RPCs answer with their rules, `APPLY-32 (applied 2026-09-26).sql`; the `ohrr-jobs` function answered "not found", so `push_public_key` is still null until it is deployed under that exact name).** OHRR: "build
  the things you can and then lets also do 2 [phone notifications] and 7 [Cloudflare Web Analytics]".
  - **Order for OHRR:** (1) Supabase → Edge Functions → Deploy a new function → Via Editor, name `ohrr-jobs`, paste
    Drive `OHRR App Design/OHRR-JOBS-FUNCTION.ts` (= `supabase/functions/ohrr-jobs/PASTE-INTO-SUPABASE.ts`),
    **Verify JWT OFF**; (2) run update 32 (RUN-THIS / six chat blocks). Every new screen stays quiet until then.
  - **Wish-list items** (`wish_list_items`, task `giving.wishlist`): staff paste each item's own Amazon link
    (Amazon blocks programs reading the list); Give / Hop Shop list them, "Most needed" first, each "Buy on
    Amazon"; the whole-list button stays. Staff → Wish list items in both.
  - **Rabbits from RescueGroups:** the `ohrr-jobs` function reads OHRR's listing (org 6091; port of
    `scripts/rescuegroups-rabbits.py` in `supabase/functions/ohrr-jobs/rescuegroups.ts`) every morning at 11:15
    UTC (pg_cron) and on Staff → Adoptable rabbits → "Check RescueGroups now". New rabbits are added; one no
    longer listed is hidden with a badge (`auto_hidden`), **never marked adopted**; staff "Mark adopted" or
    "Show it again until tomorrow's check". An empty listing changes nothing. Each run leaves a `job_runs` row.
  - **Phone notifications (web push, web app only):** My OHRR → "Notifications on this phone" (topics
    volunteer / events / adoptions / bunfest / news, "Send me a test" signed in), a one-time Home prompt,
    `public/sw.js` push + tap handlers, `public/manifest.webmanifest` (iPhone needs Add to Home Screen). New
    volunteer calls, events and hand-added rabbits send one by themselves; the RescueGroups check sends one a
    day for new rabbits. Staff → Send a notification (task `notifications.send`, 10 an hour) in both. VAPID keys
    are made by the function and kept in `push_config` (no policies). Endpoints are limited to the browsers' push
    services. The phone app (Capacitor) still says notifications come with the app-store version.
  - **My Bunny photos on the account:** private bucket `my-bunny-photos`, `<user id>/<bunny id>.jpg`, own folder
    only; `src/features/account/photoSync.ts` (stamps per account; an empty folder never deletes phone photos);
    Delete account empties the folder first.
  - **Cloudflare Web Analytics (item 7):** OHRR switched it on in the Cloudflare dashboard 2026-09-26 (Pages injects
    the cookie-free beacon on the next deploy, so all three sites were redeployed); both privacy pages say so.

- **One account for everyone, 2026-09-26 (latest; website `b0145e8` + app the same day; update 31 applied and checked
  live the same day — new tables refuse anon, save_my_data needs sign-in; `APPLY-31 (applied 2026-09-26).sql`).** OHRR: supporters "enter your information and save things like
  favorites, my bunny etc.", get told about volunteering and events, use a password they can change, and staff
  are the same accounts — "nothing is different on my login except the features I can see".
  - **App:**
    - **Sign-in for everyone and My OHRR** (`/account`, and `/staff/signin` redirects to it): name; what's
      saved on the account; email choices (six interests, consent); phone reminders; sign-in email and
      password; "Have a staff invite code?"; delete account; sign out.
    - **Sync of saved things:** favourites, saved sessions and My Bunny (no photos; merged by id, newest
      edit wins, nothing silently dropped, deletions carry across) go to `user_saves`.
    - **"New for you":** a home card and badge for new volunteer calls, events, rabbits and BunFest talks
      matching the person's interests.
    - **Phone reminders:** local notifications for saved sessions, events added and bookings made on the
      phone.
    - **Settings:** the device-only "Your info" box is gone; its place is the account card plus "Just want
      emails?".
    - **Other:** Staff → Supporters, and an app privacy page.
  - **Website:** "Get emails from OHRR" with interests (Volunteer and Events link to it pre-ticked);
    `/emails/:token` to change or stop; Staff → Supporters (search, filter, counts, copy emails, spreadsheet
    with each person's link); privacy section.
  - **Update 31:**
    - `user_profiles`, `user_saves` (written only via `save_my_data`, ~1 MB cap) and `mailing_list`;
    - `join_mailing_list` (public, only adds), `save_my_email_prefs`, and the by-token choices functions;
    - the `supporters.view` task;
    - Inbox mailing-list sign-ups copied onto the list;
    - `delete_own_account` also takes you off the list.
    - Sign-up emails aren't confirmed, so nothing is ever looked up by an account's email.
  - **Stage 2 (needs OHRR accounts):** automatic emails need a free email-sending account; push needs web-push
    keys stored as a Supabase secret; iPhone store push needs Apple's paid account.

- **On hold, 2026-09-26 (no SQL).** OHRR: a BunFest-only helper shouldn’t have working access all year but
  shouldn’t need setting up again each year. Team (website and app): **Put on hold / Turn back on** on each
  person (was Disable access / Re-enable) keeps their account, level and tasks; turning back on also clears a
  passed end date. Everyone on hold (switched off, or past “Put on hold automatically after”) sits in one
  “On hold” section at the bottom. Someone on hold who signs in is told so instead of being asked for a code.

- **Staff tiers and sharing, 2026-09-25 (latest; website `d6912fc`, app `27f2f12`; update 30 applied and
  checked live 2026-09-26 — `level_rank('developer')` = 10, `create_staff_invite` refuses outsiders;
  `Supabase history/APPLY-30 (applied 2026-09-26).sql`).** The sponsor is now Developer (one-line SQL
  run 2026-09-26, since nobody can change their own level); OHRR has no Founder until one is invited. OHRR hit "function gen_random_bytes(integer) does not exist" on Staff →
  Team → Invite and asked for an audit of how people join and get access, more levels, and a way to share
  some but not all tasks.
  - **Found:**
    - no invite could be made (pgcrypto is in the `extensions` schema; the function looks only in
      `public`; codes now come from gen_random_uuid());
    - anyone who could invite could put any task on an invite, and anyone who could manage people could
      switch on tasks they didn't have themselves;
    - an invite could switch back on access that had been switched off;
    - the one-time owner code left the level behind;
    - the invite level picker could start at Founder;
    - both clients loaded "my membership" without filtering by user, so the screens could show another
      person's level (the database still enforced the real one).
  - **The levels OHRR set, lowest first:** Volunteer 1–3, Lead, Admin 1–3, Board, Founder, Developer.
    - Only Founder and Developer hold every task (role owner). They can change anyone, each other
      included; there is always one founder.
    - Everyone else holds exactly the tasks switched on and changes only people below them.
    - Worker became Volunteer 1. Board members (admins underneath) stay Board with every task switched on
      explicitly.
  - **The sharing rule (database-enforced):** give only levels below your own and share only tasks you
    have (`create_staff_invite`, `set_membership_permission`).
  - **Access can end on a date** (`access_until`, e.g. BunFest weekend helpers), and people can always
    read their own membership row, to be told when access ended.
  - **New presets:** Board, BunFest & Events, Inbox helper, Rabbit listings helper, Care pages helper.
  - **Team screens (website and app):** "How access works", invite with level, preset or chosen tasks,
    "Can bring on helpers", access until, and who it's for; waiting invites; per-person tasks (only
    shareable ones switchable), level and end date. My account shows the end date.

- **My account + clearer joining, 2026-09-25 (website `b0c5e69`, app `3b80d9c`; no SQL).** OHRR: "I don't
  have the ability to create an account or edit my account." Everyone signed in now has Staff → My account
  (`/staff/account`): name, title, photo, show on About, sign-in email (link to the new address), password,
  and their level and access. Sign-up with an email that already has an account says so instead of waiting
  for an email that never comes; the forms say invite codes come from a founder or board member (Staff →
  Team → Invite). App: signed in but not on the team goes to the invite-code screen (not the master-code
  one), and emailed links from inside the phone app point at ohrr-app.pages.dev, not localhost.
  OHRR added `https://ohrr-app.pages.dev/**` and `https://ohrr-website.pages.dev/**` to Supabase →
  Authentication → Redirect URLs the same day, so email links come back to the right screen.

- **Legacy Fund, 2026-09-24 (latest; website `f175ed8` + app `b253c67`; update 29 applied and checked live the same day —
  47 published 2026 names, anon insert refused; `Supabase history/APPLY-29 (applied 2026-09-24).sql`).** Updates 25–28 were run and checked live the same day (anon REST:
  `volunteer_check` answers with a role, `count_posts_to_approve`, `level_rank`, and the new staff tables
  refuse anon). OHRR on the Legacy Fund proposal: "the legacy donors just follow the existing website
  details for now" — so the contact stays Pat Barron (pbarronosu@aol.com), the Guardians stay one group
  (a planned gift, or $1,000+ in a calendar year), and nothing new is said in legal terms (no EIN, sample
  bequest wording or memorial gifts until OHRR asks).
  - `/info/legacy-fund` is its own page on the website and in the app: the live page's words (still the
    staff-edited 'legacy-fund' page), the Legacy Fund graphic, the contact, the **2026 Rescue Rabbit
    Guardians** by name (the live site shows them as a picture; 47 names, sorted by surname as it does)
    and "Request more info", which now reaches the Inbox (kind `legacy-info`, "I've already included
    OHRR"). Before update 29 runs, the names come bundled.
  - Staff → Rescue Rabbit Guardians (permission `giving.guardians`; owners and admins have it): add, edit
    (with "sort under"), hide, remove, and start a new year from last year's list. The table holds only
    the name as shown, never what anyone gave.

- **A long round, 2026-09-24 (latest; website `6fe33e4`…`8de568c`, app `5d06c6e`…`d384d45`; updates
  25–28 to run, in order — Drive RUN-THIS and `Supabase history/APPLY-25…28.sql`).** Everything degrades
  quietly until the SQL is run. OHRR asked, and got:
  - **Vet new volunteers** (update 25): `/volunteer/apply` (the old "I'm interested" links land there too) →
    the roster as "waiting" + the Inbox; Staff → Volunteers approves for everything or for kinds
    (socialization, buncare, events, vet-transport, hop-shop) or declines, with email drafts. Shift types
    and volunteer calls can be approved-only (`approval_role`; Bunny Socialization, Buncare and calls start
    that way); the sign-up asks "the email you applied with", the database answers approved / waiting /
    not yet and nothing more, and a trigger on bookings refuses unapproved emails (staff exempt). Everyone
    already active was approved for everything — only new people are vetted.
  - **The volunteer's private page** (`/volunteer/hours/:token`): Coming up (calendar, can't make it),
    Approved for, hours (checked-in shifts now count), and **"Your hours letter"** — the database counts the
    confirmed hours and records the letter under a code; the page paints it with Beverly May's name in a
    handwriting face (Dancing Script, bundled; not an image of her signature) and makes a one-page PDF with
    no library (`lib/pdf.ts`). `/verify/:code` (website) lets a school or employer check it.
  - **Certificates are staff's** (OHRR): owners/admins (or `volunteers.certificates`) get "Certificates to
    consider" when a volunteer makes a letter (once a month) or passes an hours mark they set
    (`set_certificate_hours`); Appreciation / Achievement heading, optional signed name, PDF.
  - **Mobile vet** on the home page: a third door (Mobile vet clinic) in the top section; `/mobile-vet`
    shows clinic days or "Tell me when there are dates"; `/book/<unpublished>` offers the same. The
    booking type `vet-clinic` stays hidden until OHRR publishes dates (Staff → Bookings).
  - **Social posts** (update 26): permission `social.approve`; draft → waiting for approval → approved →
    posted; nobody approves a post they wrote or last changed; editing an approved post sends it back; the
    rules hold in the database (status only through `set_social_post_status`).
  - **Vendors and ordering** (update 27): the company card (suppliers and BunFest vendors are one list,
    staff-only) gains photo, socials, shop, mailing address, paperwork (agreement, insurance, licence),
    booth needs, invite again?, per-year tables/fee/paid, and a "Given to OHRR" log (auction, raffle,
    goods, money, sponsorship, services; thank-you sent). Silent-auction items can name the company.
    Hop Shop products get pack sizes (single / box / case: units, cost, supplier SKU, minimum); the reorder
    list suggests whole packs, groups by supplier with subtotal and minimum, and copies an order as text.
  - **Staff levels** (update 28): founder > board > lead > worker (founder = owner, board = admin); only
    people below you can be managed, always one founder, invites can't jump levels; certifications per
    person (hop-shop, buncare, animal-handling, vet-transport or free text); presets Hop Shop Worker,
    Content Approver. **Trusted volunteers**' self-logged hours count straight away (staff can un-confirm);
    staff get "My volunteer hours" (their own volunteer page) to log time.
  - **Donate** is an orange pill in the top bar on every page; on wide screens the bar also has Wish list,
    Foster, Hop Shop, All ways to give. The home top still fits 1300×675.
  - **Legacy fund**: researched, proposal sent; waiting on OHRR (one contact email; Guardians listed
    separately or not; board/attorney look at the wording). IRS name: "Ohio House Rabbit Rescue Inc".

- **BunFest topics open; sponsor logos; sponsor renewals list (2026-09-24, latest; website `ea1da23`,
  BunFest site `a736c4e` + `72f4961`, app `c920b0a` + `3fb45d1`; update 24 applied and checked live 2026-09-24).** Sponsor: the
  website's BunFest topics "are not clickable to open for more details or lists like the app … next year
  we update on the admin and this will reflect the changes"; the sponsor list "is a mass of words … logo
  links … shows a logo if one is available"; sponsors expire, so "a list generator on sponsors that are
  about to expire" to ask them to continue.
  - **Website /bunfest:** the "At the festival" cards come from this year's `event_features` (Staff →
    BunFest → Cards; the year is the BunFest event's), each opening its page, the schedule or the vendor
    list (app paths translated by `lib/bunfestPublic.ts` `bunfestDest`). Pages no card opens show under
    "Plan your visit". Phones get one short row per card. New pages on the same records:
    `/bunfest/p/:slug` (prices "at a glance", sections, contact, related), `/bunfest/schedule` (talks, then
    the speakers) and `/bunfest/vendors` (vendors by kind, then this year's rescue partners). **Next
    year:** set the date in Events → "Copy 2026 into 2027" in Staff → BunFest → edit; every page follows.
  - **Sponsor logo wall** (website BunFest page, app BunFest home, BunFest site home): equal tiles, each
    linking to the sponsor's site; the name in the tile when there's no logo; the lead sponsor's tile is
    bigger. Logos: the 2026 sponsors' own, from OHRR's midwestbunfest.org/2026-sponsors.html (ads cropped
    to the logo; Borders' personal email/phone line cut off), bundled at `/img/sponsors/` in all three.
    Supreme Pet Foods only had an advert there, so it shows its name until staff upload a logo.
  - **Staff → Sponsor renewals** (app `/staff/sponsors/renewals`, website the same path): sponsorships
    ending in the next 30 days / 90 days / 6 months (opens on 6 months) or all, plus those ended in the
    last 90 days; contact, status (Not asked yet / Asked + date / Renewing / Not renewing — about the
    current term only), note; "Email them" with a drafted note, "Renewed — add a year", copy list,
    spreadsheet (.csv), print. Linked from Sponsors, the expiring-sponsors notice (now on the website
    dashboard too) and the staff menu.
  - **Update 24** (`supabase/migrations/20260924170000_sponsor_renewals_and_logos.sql`, Drive RUN-THIS +
    `Supabase history/APPLY-24 (applied 2026-09-24).sql`): staff-only `sponsor_renewals` table (contact details never public),
    the 11 logos, four missing sponsor web addresses from the same page, and Norton Road's corrected
    (nortonroadvet.com does not exist; nortonroadvethospital.com). Applied 2026-09-24: 11 logos + addresses live, logos load on
    all three sites, `sponsor_renewals` refuses public reads.
  - Also: a link to a place on another page (`/bunfest/vendors#rescues`) now scrolls there, and a new
    page always opens at the top (the site's smooth scrolling could leave it mid-page).

- **Real photos lead on the website (2026-09-24, latest; website `659cac9`, `7763108`, `1a559bf`; app
  `8860f00`; update 23 applied and checked live 2026-09-24).** Sponsor compared with the current site: "lots of information, but very
  little … visually appealing"; keep the words, blend in imagery. Rule kept: photos only of real OHRR
  things (their rabbits, volunteers, shop, events/fundraiser artwork); icons stay on the function doors.
  - **Home hero:** a 2×2 collage of real adoptable rabbits (live RescueGroups photos, names on them, each
    opens its rabbit; "Meet all N rabbits") beside the headline and doors on a laptop; a swipeable photo
    row ending in a "Meet all N" tile on a phone. Replaced the "Rabbits looking for homes" row. Sponsor:
    "a little more above the fold" (their screen ≈1300×675): kicker phone-only (the header says it), headline
    `lg:text-[2.375rem]` (two lines), tighter padding, collage 24rem, and on a laptop "Help with my rabbit"
    shares one line with its box. Measured: whole hero + the What's happening heading above the fold at
    1300×675; card tops too at 1440×800; Bunny Help above the fold at 1024×700 and 375×740.
  - **"What's happening at OHRR" picture cards** (up to 4, artwork never cropped, equal heights): a new
    `hero_slides.placement = 'happening'` group, managed in Staff → Homepage features (website) and Staff →
    Home screen (app, "What's happening (website)"); the app's own Home ignores those rows. Until update 23
    runs, the five posts from the current OHRR home page show from `data/heroSlides.ts`. The BunFest card
    hides itself after Oct 25. Artwork also bundled in the app (`public/img/news`) for editor previews.
  - **Update 23** (`supabase/migrations/20260924150000_whats_happening_cards.sql`, Drive RUN-THIS +
    `Supabase history/APPLY-23 (applied 2026-09-24).sql`): opened the 'happening' placement and seeded the
    five cards. Applied 2026-09-24: 5 rows live, the website home reads them, the app's Home does not.
  - **Inner pages** (`PhotoStrip.tsx`, `data/ohrrPhotos.ts`; 15 photos from OHRR's own site in
    `public/img/ohrr/`, ≈1.15 MB total, EXIF/GPS stripped, lazy-loaded): Volunteer (3 volunteers-with-
    rabbits), Hop Shop (2 shelves), About volunteer family (4 named squares + "Photos: Ohio House Rabbit
    Rescue"), Give ("Lola's tale" from the Veterinary Care Fund page, captions from its text), Found a
    rabbit (wild cottontail in Domestic-or-wild + 3 catching-a-stray photos captioned from the article),
    Adopt ("Rescued is my favorite breed"). Rejected: child-as-subject, tiny, street/building exteriors,
    unclear identities. **Ask OHRR:** the wild-cottontail photo may be stock and BevMay.png looks
    professional — confirm they're free to reuse; and send 10–15 newer, larger photos.
- **App gets the two-minute check; shorter footer; BunFest Add to calendar everywhere (2026-09-24; app `e84c4d0`, website `0f3973c`, BunFest site `9e540c1`).**
  - **App:** `ReadyCheck.tsx` (the website's seven questions word for word) above the
    `is-a-rabbit-right-for-us` article (`/info/is-a-rabbit-right-for-us`, alias `/thinking-about-a-rabbit`;
    shows the check even if the article can't load). Entry cards on Home (after Quick actions), Adopt
    (under the live-rabbits line) and Rabbit Care; a search entry; the Easter line on Home from
    `lib/season.ts` (7 weeks before Easter; hidden now).
  - **Website footer** (sponsor: "the links at the bottom are still a lot … socials can be icons"): 19 links
    → 13; one "where we are" block (address + Directions, hours, email) with Facebook/Instagram as 44px
    icons and the mailing list; "Also at OHRR" = Events, BunFest, Hop Shop, News, Happy Tails, Sponsors &
    partners; Privacy + Staff sign-in in the bottom line. "See rescues near you" moved into Surrender's
    admissions text (the only other way to that page).
  - **Add to calendar** where BunFest shows its date (sponsor: "where it says mark your calendars it should
    have a link to add to your calendars. Same on the app"): website BunFest page (`AddToCalendar`, .ics +
    Google), BunFest site Home "When" line + Visit page, app BunFest home + Plan Your Visit + the Events
    card (`AddEventToCalendar`: on the web an .ics or Google; in the native app "Remind me on this phone"
    (evening before + an hour ahead) or Google, as bookings already do). All built from the shared
    `events` row; hidden once the event is over. Checked: 10 AM–4 PM Eastern, Sun Oct 25 2026, The Makoy.
    Native path type-checked/built but not yet run on a device.
- **Even boxes, Bunny Help above the fold, the two-minute check (2026-09-24; website
  `0160f94`).** Sponsor: boxes with different amounts of words look like "mismatched boxes" (keep the
  words); get Bunny Help above the fold and open it fully when used; educate people before they buy
  (OHRR research, Drive `Research/market-data-points.md` 2.1–2.3: rabbits are given up almost always
  for human reasons; surrender requests rise 2–3 months after Easter).
  - **Box rule:** side-by-side topics with very different amounts of text become rows or open columns
    (Volunteer opportunities: details beside the sign-up; Give's top ways as rows like Donate; Adopt's
    Still deciding / matchmaking as two columns with a rule; Found a rabbit as one reading column).
    Similar cards line up: `LinkCard` summaries clamp to 3 lines with the link on the bottom edge;
    Surrender, Volunteer "more ways", vet and rescue cards pin buttons/contacts to the bottom.
    Measured at 1280px: no flagged rows left except BunFest's six short feature cards (left as is).
  - **Home Bunny Help (`HomeBunnyHelp.tsx`):** "Help with my rabbit" is a question box among the doors
    (above the fold on a 375×740 phone). Tapping it opens example questions, the emergency vet line,
    live answers and every topic by category — a drop-down on a laptop, in place on a phone. The old
    below-the-fold box is gone.
  - **The two-minute check (`ReadyCheck.tsx`)** on OHRR's staff-edited article
    `/info/is-a-rabbit-right-for-us` (alias `/thinking-about-a-rabbit`; flyers/QR codes already use the
    /info path). Seven questions whose wording and "why" lines come from that article; "not yet"
    answers list the reasons and offer a socialization shift and the care guides; nothing stored.
    Offered on Home (after the rabbits), Adopt and Rabbit care (doors) and site search. The home hero
    shows "Easter is … Thinking about a bunny? Read this first" by itself in the 7 weeks before Easter
    (`lib/season.ts`). App mirror built next (see above).
- **Street address: a select place or two, like the current site (2026-09-24; website
  `6a1989b`, app `bd5c21b`).** Sponsor corrected the first pass: "people need to find it but if you
  have it everywhere on things like contact us when we want them to email then they will drop a bunny
  off … look at how it is now and model that. it is not everywhere just a select place or two." The
  live site shows it in its footer (every page) and on its Hop Shop and Contact pages. Now: **website**
  footer (street, city/ZIP, Directions link) + Hop Shop page (address, landmark, Get directions); **app**
  About screen (with the no-drop-off note under it) + Hop Shop screen. Contact, Home, the About page
  body, booking pages before booking, flyers, letters and the rescues list stay address-free; Contact
  and the visiting note point to email ("Visits are by appointment, so please email us before you
  come."). The entry below describes the first pass; this supersedes its "address rule".
- **Street address off public pages; orange Volunteer; doors on inner pages (2026-09-24;
  website `0685cac`, app `6ce2830` + `7f23900`; update 22 applied and checked live 2026-09-24).** Sponsor: "minimize the address
  exposure … people will drop a bunny off at the rescue and then we are forced to take it."
  - **Address rule (app + website):** public screens say "Columbus, Ohio" (website `OHRR.place`);
    no street, ZIP, directions or map link for OHRR's own location. A visiting note says visits are by
    appointment and the address comes with the appointment or volunteer shift; a calm note
    (from OHRR's Admissions Policy: restricted admissions) asks people not to bring a rabbit without
    talking to OHRR first (Contact, About, Surrender, app Surrender/Found). Booking pages show only
    the place before booking ("OHRR Adoption Center"); the confirmation, calendar file and My
    bookings keep the full location. Flyers, outreach letters, volunteer-call messages and call
    letters dropped the street. **Kept:** supplier order emails, staff booking defaults, the org
    profile (staff settings) and letters about one volunteer. The app also hides the phone and
    address on OHRR's own BunFest partner row.
  - **Update 22** (`supabase/migrations/20260924130000_hide_ohrr_street_address.sql`) cleared the
    street from OHRR's own `rescue_partners` row (shown on website, app and BunFest site); applied and
    checked on the live website and BunFest rescues pages 2026-09-24. **Update 21** (the socialization
    health note) applied and checked on the live Volunteer page the same day. Nothing to run.
  - **Menu:** Volunteer is orange on the website (`--color-brand-orange-nav: #b35900`, 4.8:1 on
    white, the brightest brand-hue orange that passes AA).
  - **Inner pages get the home page's layout:** `PageHero` takes `doors` (2–3 main actions,
    titles only on phones) or an `aside` beside the title: Adopt, Rabbit care, Found / surrender,
    Found a rabbit, Volunteer, Give, About, Contact, Hop Shop; Bunny Help's question box sits in the
    band. Jump links land below the sticky header (`[id] { scroll-margin-top }`). Contact rebuilt
    (form, hours and visiting, email). Events, News, Happy Tails left as they are (short lists).
- **Website: the important things on the first screen (2026-09-24; website live, `f1caf8c`).**
  Sponsor: "a lot of app feel and wasted space … the important things above the fold". Measured at
  1280×720 and 375×740: header + tall blue title band took 60% of the first screen.
  - **Title band (`PageHero`)** is a short light band (brand-blue-50, ink title), not a tall blue
    app header: bands end at ~300px on a laptop (was 420–450) and each page's first action is
    130–165px higher. **Header** ~20px shorter. **Sections** `py-8 md:py-12` (was 12/20).
  - **Home:** the purpose sits beside the three doors on a laptop, with four rabbits on the first
    screen; on a phone the purpose and all three doors fit. The doors are compact rows (titles
    only on phones), not app action cards. Sponsor strip moved below the rabbits.
  - **BunFest:** When/Where/Admission/tickets come before the logo on phones. **Found a rabbit:**
    the Report button comes before the checklist.
  - **Phones:** five pages (Adopt, Surrender, Volunteer, About, Contact) scrolled sideways; a grid
    with no column setting stretched to a long email address. Fixed once in `index.css` (`.grid`
    defaults to one shrinkable column in the base layer; long words wrap).
  - **Removed:** the website's A−/A+ text-size control (OHRR: "the website does not need the font
    size change option"; `82eb68e`); the app keeps Settings → Text size. Unused `HomeHero.tsx`.
  - **App:** the staff header's way back to the app is now a blue 40px "App" button (`815cdba`).
- **Website nav audit (2026-09-24; website live, commit `c9c88ab`).** Sponsor: "I'm in
  the staff and can not get back to the main site." The old staff screen had ~30 tool buttons in a
  wrapping row, and the only way out was a small grey "View site" pill after them.
  - **Staff:** a "← Back to the website" button on every staff screen, next to Sign out (also
    on the signed-in-but-not-staff screen). The tools are grouped (Every day · Rabbits & care ·
    Volunteers · Website & outreach · Hop Shop & BunFest · Settings), shown as a left sidebar on
    laptops and behind a "Staff menu" button on phones that closes when a page opens. Same
    capability checks as before; groups with nothing the person can use are hidden.
  - **Public:** the phone menu now starts with Home and ends with an "Also at OHRR" group
    (Events, Midwest BunFest, Hop Shop, News, Happy Tails, Contact us); "Contact" sits in the top
    bar on tablet and laptop.
  - **Route audit:** every public page is linked from somewhere. Staff pages missing from the menu
    are tabs or sub-pages reached from their parent (Hop Shop reorder, BunFest tabs, hours letter,
    item tags).
- **The website leads with the rescue’s purpose (2026-09-24; website live).** Sponsor:
  "closer but still too overwhelming … focus on the purpose of the rescue and the rest is
  secondary"; the app should be "a standing pill at the top of the page … links to the app
  elsewhere is a waste". Built from OHRR’s own mission (About page: run the Adoption Center,
  rescue abandoned pet rabbits, adopt them out, teach care for rabbits as indoor companions).
  - **Home:** H1 "Rescuing abandoned pet rabbits and finding them homes" + one sentence; three
    doors (Adopt a rabbit / Help with my rabbit / Found or surrendering a rabbit); three rabbits;
    Bunny Help; "Help us help them" (Volunteer / Foster / Donate, one button each + "Other ways to
    give"); one quiet line for hours and the next event. Gone from home: the staff hero slide,
    news, the doors grid, the app block (`ThisWeek.tsx`, `LatestTail.tsx` deleted). 12 links in
    the main content.
  - **Header:** a top bar with A−/A+, Search and the standing **"Get our app"** pill (visible on
    phones too); the menu is the mission: Adopt · Bunny Help · Rabbit care · Found / surrender ·
    Volunteer · Give · About (one row from 1280px, second row on smaller laptops, Menu button on
    phones/tablets). Events left the menu.
  - **Footer:** "Also at OHRR" holds the secondary things once: vets, Happy Tails, Events, BunFest,
    Hop Shop, News, Rescues, Sponsors, Impact, Contact.
  - **App links removed** everywhere but the pill (home block, footer, Help topic pitch, "BunFest in
    the app"); the privacy policy still describes the app, and site search still finds /app.
  - **Update 21 (waiting):** the Bunny Socialization shift said "Because of COVID, we must account
    for all people in the building." Sponsor: drop the COVID portion but keep the care, as COVID is
    still around. Now: "… you must sign up for a volunteer slot also, so we know everyone who is in
    the building. COVID and other illnesses are still around: if you are feeling unwell, please
    reschedule your shift." (`20260924100000_socialization_health_note.sql`; app fallback text
    changed to match.)

- **Website persona review → calmer pages (2026-09-24; website `5ebb3b4`, live).**
  Sponsor: "the look and feel doesn't meet the user — links all over the pages, overwhelming."
  The site was run past the brief's personas (four reviewers, two personas each, reading
  full-page captures at 1280 and 500px plus per-page link counts —
  `scratchpad/persona/`). They agreed: the home page opened on BunFest not the rescue and
  offered BunFest up to eight times; "Explore →" ×10; 66 links on home, 30 in the footer;
  the Volunteer page showed the same four positions twice (typed list + live list); Learn
  showed five guides twice (live slug ≠ bundled slug); orange text on white 2.6:1; "Live —
  synced" captions read as unfinished; Give was 14 equal cards; Events had three buttons per
  card; the hours page said "This link isn't working".
  - **Home:** `HomeHero` is OHRR first (kicker, "Rescued rabbits, looking for homes", one
    sentence, See the rabbits / Bunny Help / Donate) with the staff `hero_slides` slide beside it
    as "Happening now" (hand-rotated, 44px pager); then Bunny Help (one heading), This week,
    three rabbits, two news items, four doors named for where they go, the app. The featured-card
    strip and the stats band are gone (featured cards still drive the app's home; the editor says
    so). Home: 25 → 18 main links, 66 → 48 total.
  - **Shared:** footer is one 10-link "Find your way" + Connect (30 → 19 links, 44px rows);
    `btn.outline` is blue, `btn.orange` carries dark text, `--color-brand-orange-ink` replaces
    orange-dark for text; `LiveNote` renders nothing for live data and "Sample entries — real
    ones replace these" otherwise; "Explore →" is gone.
  - **Pages:** Volunteer = one live list of shifts (typed list only as fallback), one sign-up
    path per kind (book / email / interest), hours as a button, other needs as one sentence;
    Learn dedupes by title preferring the on-site guide; Help shows the emergency vet under the
    search; Adopt merges a bonded pair into one card and points the undecided at "Is a rabbit
    right for us?", the cost guide and a socialization shift; Give leads with Donate then plain
    rows (Give while you shop / More ways); Events one button; BunFest shows admission + the
    rabbit rule from `events.info` beside the date (`EventItem.info` added), sponsors after;
    About hours from OHRR details; the booking form says what happens next; Impact shows the
    three standing facts while a year is being counted; hours page says "You need your private
    link".
  - Still theirs to fix: the two Nimbus listings; the Buncare shift text in the database still
    mentions COVID; `/impact` has no published year yet.

- **Website audit — the older visitor, and every app capability on the website (2026-09-23; website `89b1883`, live).** Sponsor: audit the website for its age group, implement
  the app's details and design ideas on the website, make it appealing with reasons to return,
  represent every app capability including staff sign-in, and solve what's found.
  - **Against the brief's web rules:** body text was 14px with grey-on-white labels — the
    Tailwind text scale is moved up (text-sm 16px, text-base 18px), readable text is slate-600+,
    buttons are ≥44px, every PageHero carries "Home › … › page" (`parent` prop), phones get a
    labelled Menu button, an **A− / A+ text-size control** in the header (localStorage, same
    three steps as the app's Settings → Text size), reduce-motion + visible focus + skip link.
    The hero already rotated only by hand. The footer's staff link now opens the site's own
    `/staff` (it opened the app's) and shows live hours + any notice from OHRR details.
  - **Reasons to return (Home):** "Something wrong with your bunny?" (Bunny Help search up
    front), "This week at OHRR" (`ThisWeek.tsx`: doors + notice, next event with days-to-go,
    help needed now from open volunteer calls, newest Happy Tail), six doors (adds Happy Tails and
    Found a rabbit), and an honest app pitch (My Bunny reminders, offline, camera).
  - **App capabilities added to the website (public):** Bunny Help `/help` + `/help/:slug`
    (`src/lib/bunnyhelp/`, care_topics with the seed fallback, the app's search without Fuse),
    site search `/search`, Happy Tails `/tails`, `/tails/:id`, `/tails/share` (request kind
    `happy-tail`, public-uploads bucket), Found a rabbit `/found` + `/found/report` (kind
    `found-rabbit`, added to `lib/requests.ts`), Find a Rescue `/rescues` + `/rescues/:id`, a
    volunteer's own hours `/volunteer/hours[/:token]` (same RPCs and localStorage key as the app).
    Learn, Volunteer and Surrender link to them; Get the app now separates "only in the app".
  - **Staff:** Forgot your password? on sign-in + `/staff/reset` (outside the shell); Events,
    Sponsors (full port incl. placements), Volunteers roster, Silent auction catalogue
    (`/staff/auction`), Bunny Help topics, Features switches, Activity log — each in the nav and
    on the dashboard with its capability. The app's home-screen editor was not ported (it edits
    hero_slides, which Staff → Homepage already does).
  - Still app-only by design: My Bunny (device data), Scan an item, the Counter (offline, camera),
    `/t/:code` tag landing, in-app raffle ticket page.
  - Verified: tsc + build; every public page in the browser at 1280 and 375; every staff page in a
    throwaway harness (fake owner session, live reads, writes captured); reset page; forgot link.
  - **OHRR to do:** Supabase → Authentication → URL Configuration → Redirect URLs must include
    `https://ohrr-website.pages.dev/staff/reset` (or `https://ohrr-website.pages.dev/**`) or reset
    emails from the website will land on the app instead.
  - **Volunteer follow-up (website `cc36909`, 2026-09-24):** the sponsor asked whether the
    volunteer side (sign-ups, outreach, the rest) was on the website too. Checked route by route:
    calls, bookings + Hours tab, hours letters, outreach letters, share kit + post queue, flyers,
    inbox, team, foster, interest form, roster and the hours page were already there. Two gaps
    fixed: the website's opportunity editor lacked the 2026-09-22 limit fields (`limit_kind`
    people/hours, filled counts, `contact_email`) and used a shorter category list; the public
    "Open shifts" cards had no Sign up. Now `src/lib/volunteerOpps.ts` (copy of the app's), "N of
    6 spots left" / "Full", Sign up → `/volunteer/interest?role=&item=` (the `item` field is sent
    with the `volunteer-signup` request, as the app does). Tested in the harness.

- **The real adoptable rabbits (2026-09-23). Update 20 applied 2026-09-23** (run
  in five parts) and checked live: 17 rows, the app's Adopt tab and the website's Adopt
  page and home strip show them ("Live"), Dan's page shows Special needs + Adopted
  together with Forrest, photos load. Nothing waiting in Supabase. Sponsor: replace the demo rabbits with
  the real ones; Petfinder later. OHRR's Adoptable Bunnies page is a RescueGroups.org frame
  (organisation 6091) — the same record feeds Petfinder and Adopt-a-Pet, so RescueGroups is
  the one source (its API is the natural tie-in later). `scripts/rescuegroups-rabbits.py`
  reads that public listing and writes `20260923200000_real_rabbits.sql`: 17 rabbits with
  OHRR's photos (RescueGroups CDN, 800×600), breed (RescueGroups' "Bunny Rabbit" = none
  given, left blank), age, sex, size, OHRR's write-up minus the closing apply line,
  litter-trained, "Special needs" tag, bonded pairs (April & Pierce, Dan & Forrest) marked
  and naming each other, spayed/neutered for all per OHRR's adoption policy. New column
  `rabbits.source_id` ("rescuegroups:<id>", unique per org) so a re-run adds only new
  rabbits and never overwrites a staff edit. **Two listings are both named "Nimbus"**
  (different photos and write-ups) — OHRR to check. The website now has a page per rabbit
  (`/adopt/rabbit/:id`; cards were two lines with no way to read on); the app's rabbit
  page shows "Special needs" and "Adopted together with …". Previewed on the website with
  the scraped rows (fetch patch, throwaway) before commit.

- **The Midwest BunFest sample site (2026-09-23).** The third front door from the
  design brief (*OHRR Design Principles and Personas*), built as a board sample like the OHRR
  website; midwestbunfest.org is untouched. Repo
  https://github.com/ohio-house-rabbit-rescue/ohrr-bunfest (public, like the other two;
  local `C:\Users\johns\ohrr-bunfest`). **Live at https://ohrr-bunfest.pages.dev**
  (Cloudflare Pages project `ohrr-bunfest`, connected by OHRR 2026-09-23; build
  `npm run build`, output `dist`, `NODE_VERSION` 22; every push to `main` deploys). All 14
  pages checked on the live address with live data. The website's BunFest page and About
  link, and the app's BunFest home, now point to it; midwestbunfest.org stays named as the
  current official site. Nothing needs pasting into Supabase.
  - **Nothing typed in:** every page reads the shared database — `events` (+`info`),
    `event_features`, `bunfest_pages`, `bunfest_sessions`, `bunfest_presenters`,
    `bunfest_vendors_public()`, `rescue_partners`, `sponsor_placements`/`sponsors`,
    `raffle_items`/`raffle_prizes`/`auction_settings`, `bunfest_venues` +
    `bunfest_tables_public()`, `vets.gives_rhdv2`, `app_settings.org_profile`. A failed read
    says so and offers Try again; there is no made-up fallback content.
  - **Pages:** Home (the six answers — what, when, where, price, your rabbit, tickets — on
    the first screen at 1280×800 and 375×812), Plan your visit, Bringing your rabbit (rule,
    proof, attendance agreement, RHDV2 practices; prints), Talks & schedule (track buttons,
    prints), Speakers, At the festival + each festival page, Vendors (search + category),
    Rescues, Sponsors (terms expire themselves), Map (the app's VenuePlan, to scale), Silent
    auction, Volunteer, Past years (`?year=` on schedule/vendors/rescues/festival), 404.
  - The links OHRR types in the app (`/bunfest/p/spa`, `/vets?rhdv2=1`, `/shop` …) are
    translated by `src/lib/links.ts` to this site's pages or the OHRR website.
  - Older-visitor rules: 18px body (Tailwind text scale moved up), dark on white, every menu
    item visible (labelled Menu button on phones, Tickets button in the phone header), 48px
    targets, print styles, reduce-motion, `noindex` + `robots.txt`. Email only for OHRR — its
    number is not on this site (other rescues' and vets' numbers are theirs to publish).
  - `src/lib/floor.ts` and `src/components/VenuePlan.tsx` are copies of the app's — change
    the app first.
- **Website: Staff → Vets and Staff → OHRR details (2026-09-23).** Both were phone-only.
  Vets mirrors the app's manager (badges, "gives the RHDV2 vaccine" + how to get it,
  show/hide, delete); OHRR details mirrors the app's screen (notice, hours, email, phone,
  address, letter signer, EIN) and keeps any other keys in the row. Public `/learn/vets`
  shows an RHDV2 badge and a filter (`?rhdv2=1`). Checked in a throwaway harness (fake
  sign-in, live public data, writes captured) and live on ohrr-website.pages.dev.

- **Email, not the phone (2026-09-23).** OHRR: the phone isn't for emergencies,
  email is the primary way in, and everything runs on a very limited team of volunteers.
  OHRR then asked for it to be hard to find: it now appears ONLY on the About page (app
  and website), as small grey print — not in the footer, not a tap-to-call link —
  and everything else points to email —
  surrender, found a rabbit, help, adopt, BunFest host card, letters, thank-yous,
  outreach, flyers. "Hurt? Call" became: OHRR can't respond to emergencies — MedVet
  Hilliard for an injured rabbit, the Ohio Wildlife Center for a wild one. Update 19
  (applied and checked 2026-09-23) took the phone off OHRR's BunFest rescue-partner entry;
  nothing is waiting to be pasted. Updates
  17 and 18 were **applied 2026-09-23** and checked live (Beverly May signs letters,
  EIN on file, Winstead spelling; every Counter function answers and refuses the
  signed-out).

- **The Counter — store operations and the BunFest door (2026-09-23).** Update
  18 (applied 2026-09-23). Sponsor: add new
  items from a phone first, SKU/barcode second; a separate staff area for store
  operations and taking tickets at BunFest; don't overwhelm the staff. Decisions
  (2026-09-23): a Counter volunteer role — yes; selling in the app lowers stock,
  payment stays on the cash box / card reader — yes; door receipts counted so a
  ticket can't be used twice; several door phones at once; must work with low or
  no signal.
  - **Staff → Counter** (`src/features/counter/`): big buttons, one job each; a
    per-phone switch "The Hop Shop" (Sell, Add a new item, Today at the till) /
    "BunFest" (Door tickets, Sell, Raffle tickets); each phone is named ("Door 1")
    and the name is on everything it records.
  - **Counter volunteer** (`counter.use`, preset in both Team screens): the till,
    the door, the raffle table — lands straight on the Counter, menu shows nothing
    else; can't edit the website, delete, void raffle tickets or draw winners
    (the raffle functions were re-issued to allow counter.use for selling and
    taking payment only).
  - **Add a new item**: photo → name → price → how many → it gets an OHRR item
    number (`counter_add_item`); then scan or type the maker's barcode
    (`counter_link_code`), or print a sheet of labels carrying that item's number
    (`/staff/items/tags?code=`).
  - **Sell**: scan / name / barcode-number search / tap the picture, basket,
    "Something else", Paid cash (change) or Paid by card; `record_counter_sale`
    lowers stock. `counter_day` for the day's cash and card totals.
  - **Door**: advance tickets (`door_tickets`) loaded from the ticket shop's CSV
    export (columns and ticket items guessed, staff confirm; shirts/raffle/spa
    skipped) or by hand; each door phone keeps the list and all entries
    (`door_pack`), checks receipts with no signal, queues entries and syncs with
    `door_sync` (client ids — a resend never counts twice). Already used → when and
    which door; let in anyway needs a reason; undo 15 min; receipts let in twice are
    listed. Walk-up sales by adults / 5–12 / under 5 at the published prices
    ($10 / $5 / free, editable under Door setup).
  - **Offline**: the staff membership is cached on the phone; the Counter has its
    own gate; `public/sw.js` caches the app so it opens with no connection (checked
    by stopping the server and reloading).
  - Not yet: Square hand-off (waiting on which Square hardware OHRR uses), app-sold
    signed QR tickets (needs online payments — sponsor asked; discussed, parked).
  - Verified in a throwaway harness with sample data: 24 logic checks, every screen,
    offline → online sync for sales and door entries, CSV import.

- **Letter signer + a name fix (2026-09-23).** Update 17 in `RUN-THIS-IN-SUPABASE.sql`
  (waiting to be run): OHRR named Bev as the signer, so hours letters are signed by
  **Beverly May, Founding Director and Shelter Manager** (her title on OHRR's site),
  with OHRR's EIN **27-0830606** (GuideStar / Charity Navigator). Only blanks are
  filled. **Karen Winstead** — an Ohio State professor, per OSU's English department
  — was "Winsted" on the 2026 bonding talk; fixed live (with 17) and in
  `src/data/sessions.ts`.

- **Volunteer calls — ask, share, sign up, check in, thank (2026-09-23, latest).**
  Database: update 16, **applied 2026-09-23** together with 15 and checked live
  (every function answers; the staff-only reads return nothing to signed-out
  visitors; both sign-up pages reach the database). Sponsor: "We need 5 people for up
  to 6 hours, shifts are 2 hours… share this across all social platforms, letters
  and email… sign up in the app or online… log that they showed for this block…
  thank them with their hours… military medal and school letters, automated, always
  thanking them."
  - **One call, entered once** (`volunteer_calls`, Staff → Volunteer calls, app and
    website). Day, hours, shift length, people per shift, areas, perks, what to
    read first. `save_volunteer_call()` makes the shifts as an ordinary shift
    booking type (`call-<slug>`), remakes them on edit, never deletes a shift
    somebody is on (it closes it and says so). The slug never changes, so links
    already shared keep working. "Fill in from BunFest" uses the festival record.
  - **Spread the word:** nine ready messages from the one call (Facebook,
    Instagram, story, text, email to a company, email to a community group,
    printed letter with QR, flyer with QR, newsletter paragraph), each with its own
    `?src=` link. Phone media link to the app, desk and paper media to the website.
    Sign-ups shows which source brought people (`call_sources`).
  - **Sign-up page** `/volunteer/call/:slug` in the app and on the website: shift
    buttons with places left, pick several, an area, and the optional "Need a letter
    for your hours?" (school / military award / workplace / community) with the
    details that letter needs, kept on the volunteer's record
    (`volunteers.hours_for`, `letter_details`). A new volunteer gets their private
    hours page; an existing email never gets a token back (privacy).
  - **On the day:** tap *Here* per person per shift — the whole shift counts, no
    clocking; *Didn't come*; walk-ins added straight to their shift
    (`mark_call_attendance`, `add_walk_in`).
  - **Thank everyone:** each helper's hours here / this year / in all
    (`call_thanks`), an email and text that always thank them and link their hours
    page, *Mark thanked* (`bookings.thanked_at`), and their letter.
  - **Hours letters** (`/staff/hours-letter`, rewritten; website mirror added):
    school, military (verifies hours for the MOVSM; says the award decision rests
    with the command), workplace, "to whom it may concern", and a certificate.
    Details pre-filled from sign-up. Who signs is set once in OHRR details
    (`letter_signer_name/title`, optional EIN) — blank until OHRR sets it, and the
    letter then leaves the lines blank to sign by hand. Never invented.
  - Pure logic shared by copy: `src/features/volunteers/calls.ts`, `letters.ts`,
    `paint.ts` ↔ website `src/lib/volunteers/`. Verified in throwaway harnesses on
    both surfaces with sample data (sign-up payloads, every tab, pictures, letters).

- **BunFest floor plan, venue designer, speakers, RHDV2 (2026-09-23).** Update 15 in
  `RUN-THIS-IN-SUPABASE.sql`, **applied 2026-09-23** and checked live: The Makoy's
  two rooms with 59 numbered tables on the event map, the ten speakers on 10 of
  the 12 talks, two RHDV2 practices in the vet finder, and the "Bringing Your
  Bunny" link going to them. Nothing is waiting to be pasted now.
  - **Per-year venue** (`bunfest_venues.layout`): rooms in feet, rows of tables
    (start, direction, count, table size, walkways every N, which side customers
    stand), fixed areas and doors — Staff → BunFest → Floor plan → Design the venue,
    app and website. Tables number continuously room by room. The Makoy's two rooms
    are seeded as an **estimate** (the published map isn't to scale) — check them.
  - **Who sits where** (`bunfest_tables`): type "7, 8" beside a vendor or rescue and
    the map fills in; side-by-side tables of one holder draw as one block with the
    name once; a table can't be given twice. `start_bunfest_year()` copies the venue
    and assignments forward.
  - **Speakers** (`bunfest_presenters`, `bunfest_sessions.presenter_ids`) — the ten
    2026 bios from midwestbunfest.org. **RHDV2**: `vets.gives_rhdv2` (Borders, Norton
    Road) and the vet finder's filter; "Bringing Your Bunny" links to it.
  - Also: *OHRR Design Principles and Personas.pdf* in the Drive root — the brief for
    the BunFest sample site (older visitors first).

- **Midwest BunFest 2026, and the last of the hard-coded content (2026-09-22,
  0.3.0 · rev 6, latest).** **Paste `RUN-THIS-IN-SUPABASE.sql`** (Drive →
  OHRR App Design). A review of the published 2026 site against the app found the
  rest of the festival still bundled or in code, and some of it now wrong.
  - **The activity pages are per year.** `bunfest_pages` replaces
    `src/data/bunfestPages.ts` — the Bunny Spa, Glamour Shots, the raffle, the
    Chillaxabun Lounge, the toymaking workshop, Bringing Your Bunny, the
    attendance agreement, the host hotel and (new) **Volunteer at BunFest**. The
    page renderer already took its content as data, so it only had to be pointed
    at the table; the bundled copy stays as the offline fallback. Edited under
    **Staff → BunFest → Pages**, on a phone or a laptop.
  - **Two tracks.** `bunfest_sessions.track` — the festival runs *Education
    Sessions* and *Special Interest Sessions* side by side, and one timeline made
    them look like clashes. The schedule now has a tab per track; the staff form
    suggests the two names and accepts a new one.
  - **Rosters by year.** `suppliers.vendor_years` and
    `rescue_partners.bunfest_years` — "at BunFest" was a single yes/no, so putting
    this year's roster up meant deleting the record of last year's. Both forms
    tick years now.
  - **`start_bunfest_year()`** copies a whole year forward — programme, festival
    cards, every page and both rosters — so next year starts from last year
    rather than a blank screen. Nothing already in the new year is touched.
  - **This year, typed in.** Both 2026 tracks (10 talks and a break each), nine
    activity pages, the 18 rescue partners, the 27 vendors and the 12 sponsors,
    transcribed from midwestbunfest.org on 2026-09-22. **Applied 2026-09-23** and
    verified live.
  - **Advance booking carries its own dates.** Taking spa and photo appointments
    ahead of the day was a yes/no, so somebody had to remember to switch it off —
    and if they didn't, the app kept collecting requests nobody was reading. A
    page's `reserve` block now holds `opensOn` / `closesOn` (inclusive, plain
    YYYY-MM-DD so a window set in Ohio doesn't shift for someone booking from
    another timezone), the `slots` offered and what to say once it shuts. The Bunny
    Spa and Glamour Shots arrive fully set up and switched off; turning it on is
    picking the form and setting the last day.
  - **Caught in verification:** the years each rescue came were recorded but no
    page read them, so the BunFest partners list showed all 21 in the directory
    rather than the 18 coming. An "At BunFest" filter now leads the row.
  - **Also done 2026-09-23:** both stale Netlify mirrors (app and website) deleted
    by OHRR; Cloudflare Pages is the only deployment.
  - **Three things the app had wrong, corrected.** Advance booking for the Bunny
    Spa and Glamour Shots has closed for 2026 — the app was still offering to
    take requests, so those pages now give the day-of, first-come guidance OHRR
    publishes, with a staff switch to reopen requests another year. The hotel link
    pointed at a page that doesn't exist (`/hotel-information.html`; it is
    `/accommodations.html`) and the merch link went to the Bonfire store's front
    door rather than this year's collection.
  - **Two bugs found on the way.** `/staff/bunfest/schedule` had no route, so the
    one screen the year's programme is typed into landed on Not found. The "at the
    festival" cards were seeded without links, so tapping one did nothing.
  - Verified: `tsc` + `build` clean in both repos; the two migrations validated
    for SQL and JSON before release; the schedule's track tabs, the new Volunteer
    page and the rewritten Spa, Raffle and Accommodations pages walked at phone
    width. Staff screens are build-verified only.

- **Drive tidied (2026-09-22).** The sponsor could not tell which files still needed them, so the
  Drive now answers that by itself. **`OHRR App Design/RUN-THIS-IN-SUPABASE.sql`** is the single
  file to paste — APPLY-8 … 12 concatenated in order, idempotent, with a plain-English header;
  verified against the live database that none of those five had been applied. Everything else
  moved out of the way: `OHRR App Design/Supabase history/` (the five pieces + every applied
  migration + the old root paste file) and `OHRR App Design/Older design notes/` (the early
  research, the duplicate progress log). `Mobile builds/android/Older builds/` holds every build
  before 0.3.0-vc6. New `OHRR App Design/00-WHAT-IS-IN-HERE.md` explains the folder in four lines;
  both START-HERE files now point at the one SQL file.

- **Volunteers, per-year event content, and the rest of the sponsor's list (2026-09-22,
  0.3.0 · rev 6, latest).** **Paste `APPLY-12-VOLUNTEERS-AND-EVENT-CONTENT.sql`** (Drive root
  `PASTE-THIS-INTO-SUPABASE.sql`), after APPLY-8 … 11 if those haven't been run.
  - **A volunteer roster, and hours volunteers log themselves.** `volunteers` (contact, status,
    roles, orientation date, notes) + `volunteers.access_token` — a private link and QR code,
    handed over by staff, that opens **My volunteer hours** (`/volunteer/hours/:token`,
    remembered on the device). Totals for today / this week / month / year / every year, a
    branded card to share or hand to a school (`features/volunteers/hoursCard.ts`), and
    self-logging through `log_my_hours()` which lands as **logged** for staff to confirm
    (`set_hours_status`). **Staff → Volunteers** has the roster, each person's link + QR, and a
    "To confirm" tab; `link_volunteer_hours()` attaches hours already recorded against an email.
    Decision (sponsor): volunteers log, staff correct.
  - **Opportunities limited by people or hours.** `volunteer_opportunities.limit_kind` +
    `limit_people` / `limit_hours` / `filled_*`; the staff form asks which, the public card shows
    "4 of 6 spots left" / "12 of 30 hours still needed" and flips to Full.
  - **Events** take a picture (camera or file) and already move themselves to Past when their end
    passes — the editor now says so, and shows the picture on the public card.
  - **Numbers are typed, not nudged** — the browser's spinner arrows are hidden app-wide
    (`index.css`); screens that want stepping (Hop Shop stock) keep their own big − / + buttons.
  - **Sponsors** gain `remind_days` (default 21) and `sponsors_expiring()`; the staff dashboard
    warns before a term lapses instead of a sponsor quietly vanishing.
  - **Team photos, optional.** `memberships.photo_url` / `display_name` / `title` /
    `show_on_about` via `save_member_profile()`; without a photo the app draws a bunny with an
    excuse ("Mid-zoomies, no photo"), the same one for the same person every time
    (`components/StaffAvatar.tsx`).
  - **Invites** record who they're for (name, email, phone, the position asked about) and show a
    **QR code** that opens `/staff/join?code=…`; Email it / Text it / Share are one tap.
  - **Settings made sense of** (sponsor: "setting in the setting"): the staff screen splits into
    **Features** (admin on/off switches, `features/settings/features.ts` — BunFest section,
    raffle tickets, phone-app raffle, volunteer self-logging) and **OHRR details** (hours, phone,
    address, notice). Staff sign-in leaves the *visitor's* Settings; it's in Help and at /staff.
  - **BunFest content per year, not in code.** `event_features` (the "at the festival" cards) and
    `events.info` (admission, parking, the rabbit rule, tickets / hotel / volunteer / merch links,
    the logo credit) — edited under **Staff → BunFest → This year**, read by the BunFest home and
    Plan your visit. Seeded from the published 2026 site, including this year's gaps: hotel and
    BunFest-volunteer links, the merch store, the RHDV2 rule and the logo credit.
  - **Share to social.** `features/share/socialCard.ts` paints a 1080² OHRR-branded card (mark,
    photo, kicker, title, QR back to the app) and hands it to the share sheet;
    `components/ShareButton.tsx` puts it on a rabbit, a Happy Tail and BunFest.
  - **Breeds suggest and still accept anything** (`components/BreedInput.tsx`, the breed guide's
    24 + "Mixed breed", "Not sure") on My Bunny and the adoptable-rabbit form.
  - Verified: `tsc` + `build` clean in both repos; the social card rendered in the browser with a
    real photo, QR and branding; public pages walked at phone width. Staff screens are
    build-verified only, and APPLY-12 is not yet pasted.

- **Revision stamp, staff Back, tidier Settings (2026-09-22, 0.2.3 · rev 5, latest).** Sponsor:
  "remove the photo credits … make it a single line at the very end that can open when selected",
  "show revision numbers for tracking", "in the staff section there is no back button", and
  "I'm looking on the web for the updates and not seeing any of them."
  - **Where the updates are:** the live app is **https://ohrr-app.pages.dev** (Cloudflare Pages,
    auto-deploys from `main`). **https://ohrr-app.netlify.app is a stale mirror** from before the
    Cloudflare move — it still serves a build from weeks ago (its `<title>` is the old one), which
    is why none of the new work appeared. Nobody here has Netlify credentials, so it can only be
    fixed from OHRR's Netlify login: either reconnect the site to the repo (netlify.toml is still
    in the tree, so a build would work) or delete it so it stops showing old content.
  - **Revision numbers.** `package.json` gains `"revision"`, injected as `__APP_REVISION__`
    (`src/data/version.ts` → `build.revision`, `buildLabel` = "v0.2.3 · rev 5"). It matches the
    Android versionCode / iOS build number, so one number identifies a release everywhere. Shown
    in Settings → About (with Version, Build and Updated) and at the foot of every staff screen,
    on the phone and the website (`ohrr-website` gained the same `revision` + `src/lib/version.ts`).
    Also fixed: the commit was injected from Netlify's `COMMIT_REF`, so it had read "dev" since the
    move — it now reads `CF_PAGES_COMMIT_SHA`, then `COMMIT_REF`, then local git HEAD.
  - **Staff Back.** The staff header's back control is now labelled **Back** (a work screen reads
    better with the word), the "App" button lost its competing arrow, and `BackButton` takes an
    optional `label`. It was added yesterday and is live on pages.dev — it was missing from what
    the sponsor was looking at because that was the Netlify mirror.
  - **Settings.** Photo credits moved out of a full section into one line at the very end, opened
    on tap (`<details>`); the licences require the credit to be available, not prominent.

- **Audit round: consumer + staff (2026-09-22, latest).** Sponsor asked for an audit of
  "like issues" on both sides and approved every finding. **Paste `APPLY-10-BUNFEST-CONTENT.sql`
  + `APPLY-11-TAILS-UPLOADS-PROFILE.sql`** (Drive root `PASTE-THIS-INTO-SUPABASE.sql` = both).
  - **Consumer — a booking you can find again.** OHRR sends no confirmation email, so a booked
    shift lived only on the confirmation screen. `src/features/bookings/mine.ts` keeps every
    booking made on this device (localStorage, pruned a day after it ends, refreshed by token so
    a staff confirmation shows) and `MyBookingsCard` puts it on Home, Volunteer and Services;
    cancelling by the private link forgets it. The website privacy policy's claim about a
    "confirmation email" was corrected.
  - **Consumer — two dead ends opened up.** `/found/report` is a real report form (photo, where,
    condition, contained, contact → Inbox `found-rabbit`), linked first from Found a rabbit; a
    booking type with no published times now offers `NotifyMe` ("Tell me when there's a time" →
    Inbox `notify-me`) instead of "This isn't open for booking right now."
  - **Consumer — photos and drafts on the forms.** `public-uploads` bucket (anon may add, nobody
    but staff may change or delete; 8 MB, images only) + `lib/publicUpload.ts` +
    `components/PhotoField.tsx`: Happy Tails asks for a photo instead of "a shared photo link",
    and the surrender intake takes one. `lib/formDraft.ts` (`useFormDraft`) keeps the surrender,
    foster and Happy Tail forms as you type, with a "picked up where you left off" line.
  - **Consumer — reach and read.** `SegTabs` chips are 44 px (Adopt, Vets, Tails, Schedule,
    Vendors); Settings → **Text size** (Normal / Large / Extra large, `lib/textSize.ts`, applied
    to the root font size before first paint); My Bunny's help box asks the question like Home's;
    Help & FAQ covers the Back button and Text size; `components/PageTitle.tsx` gives every route
    its own browser-tab / shared-link title (they all read "Midwest BunFest · OHRR" before).
  - **Staff — BunFest content is no longer code.** `bunfest_sessions` (per year, copy last year's),
    `rescue_partners`, and `suppliers.vendor_*` (category, blurb, room, booth, tables, published)
    behind `bunfest_vendors_public()`; **Staff → BunFest** (`features/bunfest/pages/StaffBunfest.tsx`,
    website `Staff → BunFest`) has Schedule / Vendors / Rescues. Schedule, Vendors, VendorDetail,
    the event map (live booths and colours, `placeBooths()`), Partners and PartnerDetail read live
    with the 2025 seed as fallback; the BunFest **Sponsors** page now reads the `sponsors` table it
    had been ignoring.
  - **Staff — Happy Tails can be published.** `happy_tails` + `publish_happy_tail()`; the Inbox
    shows a pre-filled "Publish as a Happy Tail" panel on a story (and renders any photo a form
    sent), `Staff → Happy Tails` edits them afterwards, and `/tails` + `/tails/:id` read live.
  - **Staff — parity and reach.** Home-screen cards (`hero_slides`) are now editable on the phone
    (`StaffHomeScreen.tsx`), announcements take a picture on the phone (the column existed since
    September) and show it on Home; adoptable-rabbit photos use the native camera; the booking
    roster has "Email everyone" (BCC) and a CSV export, and the Inbox exports too; OHRR's hours,
    phone, address and a holiday notice moved from constants into `app_settings.org_profile`
    (Staff → Settings → OHRR details, read by `lib/orgProfile.ts` on Home, About, Hop Shop, Help
    and the website's Contact); Scanned items opens on auction + raffle and points at Hop Shop
    for stock, so two screens no longer list the same thing.
  - Verified: both repos `tsc` + `build` clean; every touched public page walked in the browser at
    phone width (found-rabbit form, no-dates booking, text size, chips, titles, seed fallbacks with
    the new tables still absent — the REST 404s prove the fallback path). Staff screens are
    build-verified only (no staff sign-in here), and the SQL is not yet pasted.

- **Tester-feedback round 1 (2026-09-22, latest).** Sponsor after using the build: the Home help
  should *pose a question*; icons bigger; a Back button; "Find a time" empty; the Hop Shop needs
  photo + code + supplier/reorder. **Paste `APPLY-8-BOOKING-SCHEDULE.sql` + `APPLY-9-HOPSHOP-SUPPLIERS.sql`**
  (Drive root `PASTE-THIS-INTO-SUPABASE.sql` = both).
  - **Bunny Help asks a question.** Home box is headed "Is something up with your bunny?", the
    placeholder rotates real questions ("Did my bunny stop eating?" …) and three are tappable
    chips (`src/features/bunnyhelp/HomeSearch.tsx`). `cleanQuery` strips question forms ("why is",
    "did my bunny", "what can my bunny eat" → the diet alias) and the ranking puts an exact
    title/alias phrase first, ahead of the urgency order; the red emergency banner only shows
    when the *top* answer is an emergency. `scripts/check-help-questions.ts` (10 questions →
    expected topic) runs with `npx tsx`.
  - **Bigger icons:** IconTile 44→52 px (icon 22→28), quick-action tiles 38%→48% of the tile,
    header actions 36→40 px (icon 22), tab bar icons 23→27 + 11 px labels, page-header icon
    20→26, hero card icon 56→68.
  - **Back button** (`src/components/BackButton.tsx`) in the OHRR, BunFest and Staff top bars on
    every non-root screen: `navigate(-1)` when React Router's `history.state.idx > 0`, otherwise
    up to the nearest tab root (deep links, printed tags, notifications never strand anyone).
    On narrow phones the top-bar name yields to Back + mark + actions. Android hardware back was
    already handled in `NativeBridge`.
  - **Bookings fill themselves** (`20260922100000_booking_schedule.sql`): `booking_types.weekly`
    (jsonb rules `{days,start,end,capacity,label}`) + `auto_weeks`; `fill_booking_slots(type,
    force)` makes the next weeks of `booking_slots` (flagged `auto`), runs once a day from the
    public `booking_slots_open` and immediately when staff save the schedule (force also prunes
    future empty auto slots no rule makes any more). **Seeded with OHRR's real times read from
    the SignUp.com sheets the live site links to:** Socialization Sat 1:30–2:30 + 2:30–3:30, Sun
    1:30–2:30 (4 each); Buncare Mon–Fri 9–10 breakfast (2), Mon–Thu 4–6, Tue–Thu 5:30–7:30, Fri
    11–1 + 2–4, Sat/Sun 10–12 + 3–5 (uncapped on SignUp.com → 6 here, editable); adoption
    visits + bonding sessions on the published Sat/Sun 12–4. Staff → Bookings → Set up has the
    **Every week** editor (day chips, from/to, people, label; "keep N weeks ready"); the public
    Book page shows "Usual times". Website mirrors both (`src/lib/bookings.ts`, staff Bookings,
    Book).
  - **Hop Shop manager rebuilt** (`src/pages/HopShopManager.tsx` + `src/features/hopshop/api.ts`;
    `20260922110000_hopshop_suppliers.sql`): tabs **Items / Reorder / Suppliers**
    (`/staff/hopshop[/reorder|/suppliers]`). Item card = photo (native camera or file), name,
    **code** ("Make one" → `OHRR-XXXXX` tag code, or type/scan a barcode; registered in
    `item_tags` so scanning opens it), price, stock count, category, shelf, unit, description,
    supplier + their item #, our cost, reorder point + qty, shelf visibility — all through
    `save_product()`; `list_products_admin()` feeds the list (search, Low / on-order badges).
    **Reorder** = `hopshop_reorder()` grouped by supplier with contact/account/how-to-order,
    "Ordered" → on order, "Arrived" → adds to stock (`hopshop_set_order()`), "Email the order"
    (mailto with the list) / Copy. **Suppliers** table: one list with two tick boxes —
    *Supplier (we buy from them)* / *Vendor (sells at BunFest)* — contact, website, account #,
    how we order, lead days, minimum, notes. Website mirror `Staff → Hop Shop`
    (`src/pages/staff/HopShop.tsx`, `src/lib/hopshop.ts`, `src/lib/codes.ts`).
  - Verified: both repos `tsc` + `build` clean; Home chips → results, Back on a deep page, Book
    page in the browser preview. Staff screens not exercised live (no staff sign-in here) and
    the SQL not yet pasted.
- **0.2.0 test build — Google Play internal testing + TestFlight (2026-09-21, latest).** Sponsor:
  "build this for a Google and Apple test app version … offer testers the full features … on
  the raffle let's put it together and see what we can do with a working version." **Paste
  `APPLY-7-RAFFLE-TICKETS.sql`** (Drive root `PASTE-THIS-INTO-SUPABASE.sql` = APPLY-5 + 6 + 7).
  - **Native gaps closed** (`src/native/share.ts`, `@capacitor/share` + `@capacitor/filesystem`):
    inside the app the share sheet carries everything the app paints — Share kit / Post queue
    images, Flyers, the tag sheet (`src/features/scan/tagSheet.ts`, Avery 5163 on a canvas), the
    service letter (`src/features/bookings/letterImage.ts`), the My Bunny backup, Outreach text.
    `src/features/share/share.ts` is native-aware (`sharePng` / `savePngAsync` / `shareText`);
    `src/features/share/canvas.ts` holds the shared painter helpers. Print buttons become
    "Print or share" in the app (iOS share sheet has AirPrint).
  - **Raffle tickets, working version** (`20260921170000_raffle_tickets.sql`): `raffle_ticket_orders`,
    `raffle_tickets` (one row per number, one sequence per event → `A-0001…`), `raffle_counters`;
    public `reserve_raffle_tickets` (12/phone/hour) + `raffle_order_by_token`; ticket page
    `/raffle/tickets/:token` with a QR the desk scans; **Staff → Raffle tickets**
    (`src/features/raffle/tickets/pages/RaffleDesk.tsx`; website `Staff → Raffle tickets`): Desk
    (scan / search, Mark paid, Void), Sell at the table (paid at once, same draw), Draw (random
    among paid tickets for a prize from `raffle_prizes`, or record the bucket number; Undo).
    The migration switches `raffle_tickets_enabled` ON. Amount due comes from
    `auction_settings` pricing (`raffle_quote_cents`); nothing is charged.
  - **Delete my account** (`delete_own_account()`, `src/components/DeleteAccount.tsx` on the staff
    dashboard) — Apple 5.1.1(v); refuses the only active owner; clears every `auth.users`
    reference in public tables (own rows deleted, shared content unattributed).
  - **Version 0.2.0** / Android versionCode 2 / iOS build 2. Signed **`ohrr-0.2.0-vc2-release.aab`**
    + `…-debug.apk` in Drive `Mobile builds/android/` (jarsigner verified).
  - **iOS without a Mac:** `docs/github/ios-testflight.yml` — GitHub Actions macOS runner (free on
    this public repo), automatic signing via an App Store Connect API key, uploads to TestFlight.
    Must be copied to `.github/workflows/` — the automated push was refused (token lacks the
    `workflow` scope): `gh auth refresh -h github.com -s workflow` as the OHRR login, or add the
    file in the GitHub web UI. Needs OHRR's Apple Developer account + 4 secrets (see the file).
  - `docs/HANDOFF.md` rewritten for 0.2.0; `scripts/make-handoff-docx.py` regenerates the Drive
    docx (`OHRR Mobile Build Handoff.docx`).
  - **Submission readiness pass (later that day, app 2464ebf / website 8a19412):** privacy policy
    rewritten for the current build (website `/privacy`; app Settings links to it); a second
    switch "Raffle tickets inside the phone apps" (`raffle_tickets_native_enabled`, ON by default
    via `useFeatureFlag(key, fallback)`) so the raffle can be hidden from the native builds alone
    if Apple (5.3.3) or Play object; Adopt/Help sample-rabbit notes no longer mention Petfinder;
    HANDOFF §8a = Data safety / App Privacy / content-rating answers + review notes; ten store
    screenshots (1290×2796, headless Chrome) in Drive `Mobile builds/store-screenshots/`
    (`make-screenshots.py` regenerates); AAB rebuilt. Briefing PDFs live in the Drive root
    (`OHRR App and Website Briefing.pdf`, `Midwest BunFest - Sponsor Case.pdf`; sources in
    `Research/`, `build-briefing.py`). SQL APPLY-5/6/7 confirmed pasted (verified via REST).
  - Sponsor side before testers: Play Console (org) + Apple Developer (org, fee
    waiver) accounts; privacy-policy sign-off; real rabbits / booking times / auction items;
    tester email lists. Deferred by decision: payments, Easter scheduler, push notifications,
    App Links / Universal Links (with the store release).

- **"All but the money side" round — on `main` (2026-09-21, later).** Sponsor: keep building
  everything except payments; the money process attaches later. **Paste `APPLY-6-PUBLIC-SHOP.sql`**
  (Drive root `PASTE-THIS-INTO-SUPABASE.sql` = APPLY-5 + APPLY-6 until pasted).
  - **Hop Shop shelf, public** (app `/hop-shop`, website `/hop-shop`): `hopshop_public_products()`
    (read-only RPC for anon) — what staff scanned in, with photo, price and *Sold out*; "buy at the
    counter" is the seam where in-app payment attaches later.
  - **Raffle prizes, public** (app `/bunfest/p/raffle`, website `/bunfest/silent-auction` →
    "Raffle prizes"): published `raffle_prizes` from Scan an item, photo / donor / value / *Drawn*;
    tickets still sold at the table.
  - **Flyers on the phone** (`/staff/flyers`): the four QR flyers painted on a canvas
    (`src/features/share/flyers.ts`, US Letter @ 200 dpi) — Share (AirDrop / Messages to whoever
    prints), Save image, Print. Same flyers as the website's Staff → Flyers.
  - **Outreach letters** (`/staff/outreach`; website Staff → Outreach): six ready-to-send emails —
    campus offices & student orgs (the OSU pilot door), vet clinics, pet/feed stores (before
    Easter), schools/libraries/scouts (group visits), apartment communities (renters page), local
    media/newsletters. `src/features/share/outreach.ts` (mirrored in the website); facts only from
    OHRR's own pages; sender's name remembered on the phone; Open in Mail / Copy / Share.
  - `utm(path, campaign, medium)` — share-kit / print / email — so flyers and letters show up
    separately in Cloudflare analytics.
  - **Breed guide — "What kind of bunny do I have?"** (`/learn/breeds`, `/learn/breeds/:slug`; website
    the same) — the sponsor's 2026-06-17 request. `src/data/breeds.ts` (mirrored in the website): 24
    breeds with ears / grown weight / coat / origin / "how to tell", every fact checked against the
    breed's Wikipedia article (ARBA figures where given) — nothing invented; 24 freely licensed
    Wikimedia Commons photos in `public/breeds/` (website `public/img/breeds/`), credits on
    Settings (app) / foot of the guide (website). Three questions narrow the cards; "most rescue
    rabbits are mixes" said first; My Bunny's breed field points to it. Static reference data,
    not staff-editable (it is not OHRR content).
  - Cleanup: removed unused `learnLinks`, `surrenderForms`, `LinkCard`.
  - **Amazon Wish List opens Amazon** (sponsor: the rescue gets residuals from the visit) — Give
    card on app + website, and the website Hop Shop "Donate supplies" link; the in-house
    `/info/wish-list` item list stays as the secondary link.
  - **Not built (money side, by sponsor decision):** Donate → payment page, in-app raffle-ticket or
    Hop Shop payment, donation receipts. Easter campaign scheduler still on hold.

- **Volunteer hours, service-hours letters, yearly impact page — on `main` (2026-09-21).**
  **Paste `APPLY-5-HOURS-IMPACT.sql`** (= Drive root `PASTE-THIS-INTO-SUPABASE.sql`).
  - Staff → Bookings → **Hours**: totals per person (checked-in shifts × hours + hours added
    by hand for transport/events/orientation), line-by-line history, `/staff/hours-letter`
    prints a signed service-hours letter on OHRR letterhead (or emails the text). Tables/RPCs:
    `volunteer_hours_entries`, `volunteer_history`, `volunteer_hours_summary`,
    `volunteer_hours_total`.
  - **/impact** (app + website, printable) + Staff → **Impact numbers** (both): one row per year
    in `impact_years` — adopted, taken in, spays/neuters, vet care $, volunteer hours (one tap
    from recorded hours), foster homes, BunFest attendance, highlights, note; published per
    year. Give page + website footer link to it.
  - Heart icon replaced with a regular heart (both icon sets).
  - Easter campaign scheduler: **on hold per sponsor** (2026-09-21).

- **Reach & education build — on `main` (2026-09-21).** Sponsor direction: OHRR is missing the
  market (see `G:\Shared drives\07-OHRR App\Research\market-data-points.md` and *OHRR Users &
  Growth Research.docx*); realign toward educating the right people and recruiting volunteers,
  given a volunteer base short on digital-media skill. **Paste `APPLY-4-POSTS-REACH.sql`.**
  - **Share kit** (`/staff/share`; website Staff → Posts): pick a rabbit / event / one of ten
    education messages / custom → the app paints a branded 1080×1080 or 1080×1920 card (canvas,
    OHRR mark, QR, UTM-tagged link) and writes the caption → **Share** (share sheet → Instagram /
    Facebook / TikTok) or save image + copy caption. Education cards target families before
    Easter, new owners after, renters/students, would-be fosters, rabbit owners who never adopted.
  - **Post queue** (`/staff/posts`; `social_posts`; new cap `social.publish`): anyone with content
    rights drafts (Share-kit card or phone photo + caption), picks platforms + a day, approves;
    the one person with posting rights sees "N ready", taps Share, marks posted. Zero cost — no
    social APIs, no scheduler.
  - **Foster form** (`/volunteer/foster`, both surfaces → Inbox 'foster-application';
    `src/data/fosterForm.ts` in both repos — OHRR should confirm the questions), website
    `/volunteer/interest?role=` quick sign-up, Volunteer page doors **Foster a rabbit** and
    **Help OHRR online** (recruits the digital volunteer).
  - **Education pages** (`/info/is-a-rabbit-right-for-us`, `/info/rabbits-for-renters-and-students`,
    `/info/foster-a-rabbit`; new `care_articles.section = 'volunteer'`).
  - **Flyers** (website Staff → Flyers): four letter-size QR posters (owners, students/volunteers,
    families before Easter, adopt), each with its own UTM link.
  - Still to do from the research: Cloudflare Web Analytics (sponsor enables in the CF dashboard),
    OSU pilot, Feb–Apr Easter campaign scheduling (hero slide + queue), volunteer hours log,
    yearly impact page, Donate → real payment page.

- **Outside-links audit → everything in-house except payments & third-party directories — on `main` (2026-09-20/21).**
  Sponsor asked where the app and website still "lead outside the current design"; the
  sweep found four kinds of hand-off and all four are now solved. **Migrations to paste
  (Drive → `OHRR App Design/APPLY-2-SCAN-ITEMS.sql` then `APPLY-3-INBOX-BOOKINGS-PAGES.sql`).**
  - **Scan an item (`/staff/scan`, `/staff/items`, `/staff/items/tags`; website `/staff/items`).**
    One QR/barcode scan → "What is it?" (Silent Auction / Raffle prize / Hop Shop stock) →
    photo → name → two details → saved. Built for a person with impaired cognition: one
    question per screen, 60 px buttons, plain words, Back always top-left, draft survives a
    refresh. Scanning a known tag opens it with the one action that matters (mark won /
    drawn, +1 / −1 stock, hide / show). Printed OHRR tags (Avery 5163, QR → `/t/CODE`) open
    the item from any camera app; sign-in returns to the tag. `item_tags` registry → the
    existing `raffle_items`, new `raffle_prizes`, or `hopshop_products` (+ `photo_url`).
    Scanner = BarcodeDetector where present, ZXing (lazy) elsewhere — works in the Capacitor
    WebView too. Retail barcodes get a best-effort name from Open (Pet) Food Facts (name
    only, never their photo). Bucket `item-photos`.
  - **Inbox (`/staff/inbox`, both surfaces; capability `inbox.manage`).** The seven Netlify-
    Forms posts (appointment, bonding/clinic, surrender intake, volunteer sign-up, Happy
    Tail, raffle-ticket test forms) were dead on Cloudflare. All forms now call
    `submit_request()` (anon, insert-only, size-capped, 12/hour per address) → `requests`;
    staff tap to call/email, see every answer, add notes, New → In progress → Done; website
    Inbox exports CSV (mailing-list joins → the email service). Dashboard badge.
  - **Bookings (`/book/:slug`, `/book/cancel/:token`, `/staff/bookings`; both surfaces;
    capability `bookings.manage`).** Replaces SignUp.com (Bunny Socialization, Buncare) and
    the appointment/bonding/clinic forms. `booking_types` (rules: length, people per time,
    book-ahead hours, max per month, who confirms, a question, a box to tick) →
    `booking_slots` made in bulk ("Sat & Sun, noon–4, one hour each") → `bookings` (no
    account; private cancel token; shifts confirm instantly, appointments wait for staff).
    Every rule is enforced in `book_slot()`. Confirmation: phone reminders in the native app,
    .ics / Google Calendar on the web. Seeded: bunny-socialization (2/month, 4 per hour),
    buncare-shift (2 h, attest orientation), adoption-visit (2 h, Sat/Sun, staff confirms),
    bonding-session (staff confirms), vet-clinic (hidden until OHRR has dates). Nothing is
    bookable until staff **Make times**. `/appointment` → `/book/adoption-visit`; Services
    sample clinic dates removed; Appointment + ServiceSignup pages retired.
  - **Forms in-house (both surfaces).** Adoption application (`/adopt/apply` — OHRR's 80-odd
    questions verbatim from the live form, one section per screen on the phone, draft kept
    on the device), surrender intakes (`/surrender/form?type=owner|good-samaritan`),
    mailing list (`/mailing-list`), Become a Supporter (`/support/become-a-supporter`),
    website Contact message form. All → Inbox. `SchemaField` / `SchemaForm` render the shared
    schemas (`src/data/adoptionApplication.ts`, `surrenderForm.ts` — same file in both repos).
  - **Old-site content (`/info/:slug`, both surfaces).** `care_articles.section`
    (care | give | adopt | about); seeded Workplace Donations, Host a Fundraiser, Legacy
    Fund, License plate, Kroger Rewards, Wish List, Online Affiliates, Bonding dates from
    OHRR's own words; edited in **Care guides & pages**. OHRR's five PDFs (adoption,
    admissions, surrender policies, Be the Voice, Capital Campaign pledge) are served from
    the website's `/docs/`. Learn shows `section = 'care'` only.
  - **Still outside, on purpose:** Donate (old-site donate page → payment), Bonfire shirt
    stores, Amazon wish list, Kroger enrolment, BunFest tickets on midwestbunfest.org,
    Petfinder/Adopt-a-Pet, vets / partners / vendors directories, Facebook/Instagram, HRS/CHRS.
  - Also: one-line **"My bunny is…" Bunny Help search on Home** under the My Bunny strip.
  - Shared icons gained scan, gavel, camera, check, plus, minus, keyboard, printer, trash, box.

- **Native Android + iOS test builds (Capacitor 8) — on `main` (2026-09-17).** The same web
  build now ships inside `android/` and `ios/` (both committed) with app id
  `org.ohiohouserabbitrescue.app`, name **OHRR**, version 0.1.0. Free official plugins only.
  Inside the app: My Bunny camera / photo picker, care reminders as **local notifications**
  ("Remind me on this phone", 9:00 AM on the due date, next 6 for repeats), every outside
  http(s) link → system browser, brand-blue status bar + splash, Android back button. The web
  app is unchanged (every native call is behind `isNative` in `src/native/`). A **signed
  Android .aab + debug .apk** were built here and sit in Drive `07-OHRR App/Mobile builds/`
  (test keystore + passwords in `…/keys/`, never in the repo). iPhone builds happen on the
  sponsor's Mac — **`docs/HANDOFF.md`** (= *OHRR Mobile Build Handoff.docx* in Drive) has the
  numbered steps, what's OFF for test builds, and the public-release checklist. Scripts:
  `npm run cap:sync` / `cap:android` / `cap:ios` / `cap:assets`.

- **Icons for functions, photos only for content — on `main` (2026-09-17).** Sponsor rule
  (already applied on the website, now matched in the app): *"For things like upcoming
  events use an ICON so it never changes and people see and remember the purpose — versus
  the image of a bunny."* Real photos stay only where the thing IS content (real rabbits,
  auction items, artwork, the BunFest logo, sponsor logos, My Bunny photos).
  - **Home → Quick actions** (`OHRR_QUICK_ACTIONS` in `src/data/content.ts`): Find a vet →
    `phone`, Found a stray → `mappin`, Volunteer → `users`, Give → `gift`, Events →
    `calendar` — rendered by the new `IconPhotoTile` (`src/components/PhotoCard.tsx`): the
    same square tile as `PhotoCard variant="tile"`, a large brand-blue line icon on a
    brand-blue-50 tile, title bottom-left. **Adopt keeps its real rabbit photo.** A
    `QuickAction` now carries exactly one of `icon` / `photo`. 3-across grid unchanged.
  - **Home → hero / featured cards** (`HeroCard` in `OhrrHome`): picture slot follows
    `slideVisual()` in `src/data/heroSlides.ts` — an uploaded `image_url` always wins →
    `/bunfest` shows the logo → `/adopt…` shows a real rabbit → every other link shows its
    fixed icon centred on the tinted top band. `SLIDE_FALLBACK_IMAGES` now holds only the
    BunFest logo and the Adopt photo; `slideIcon()` / `isAdoptSlide()` / `slideVisual()`
    mirror the website's (`ROUTE_ICONS`: silent-auction/auction/sponsors → `award`,
    bunfest/events/services/appointment/schedule → `calendar`, give/support → `gift`,
    volunteer → `users`, vets → `phone`, learn → `book`, found/surrender/rescues/map/visit
    → `mappin`, hop-shop/vendors → `bag`, tails/news → `sparkles`, partners/perks →
    `ticket`, partners → `star`, contact → `mail`, about → `info`, help → `help`,
    my-bunny → `heart`, app → `device`, adopt → `heart` only when no photo applies).
    Seed function slides carry a seed-only `icon` like the website's seed (no DB column;
    `scripts/generate-seed-sql.mjs` ignores it).
  - **Icon set parity:** `device` (phone outline) added to `src/components/icons.tsx` so the
    app and website icon files match again.
  - **Audit result:** BunFest hub, Explore, Learn, Volunteer, Give, Vets, Found, Hop Shop,
    Events, Partners, Silent Auction catalog and the BunFest activity grid already used
    `ActionCard` / `IconTile` / icon `PageHeader`s — no photo-for-category left anywhere
    else. Untouched (content): adoptable cards + gallery, Happy Tails, My Bunny photos and
    the rotating sample rabbit on the empty My Bunny strip, auction item photos, sponsor
    logos, the BunFest logo, OHRR logo/mark.

- **App settings + raffle-ticket TEST feature — LIVE (2026-09-17).** Sponsor decision:
  the in-app "reserve numbered raffle tickets, pay at the table" flow is a **test
  feature** — hidden from the public by default and shown only while an owner switches
  it on in the app; its pricing is **never hard-coded** (the old "$1 each / 6 for $5"
  was unverified and is gone) — staff enter it.
  - **Migration (apply AFTER `20260917130000_raffle_items.sql`):**
    `supabase/migrations/20260917170000_app_settings.sql` — seeds the capability
    `settings.manage` (Staff area; owners/admins hold it implicitly), creates
    `app_settings` (org_id, key, jsonb value; public select, writes gated on
    `settings.manage`; **non-secret flags only** — every row is publicly readable), and
    adds nullable `raffle_ticket_price_cents`, `raffle_bundle_qty`,
    `raffle_bundle_price_cents`, `raffle_details` to `auction_settings`. Until it's
    applied the app quietly behaves as "everything off / nothing set".
  - **Staff → Settings** (`/staff/settings`, `StaffSettings`, gated `settings.manage`;
    nav entry + dashboard tile): a "Test features" list of switches
    (`src/features/settings/testFeatures.ts` — add a feature = one `{key,label,description}`
    entry). First switch: **Raffle ticket reservation** → `app_settings`
    `raffle_tickets_enabled` = `{"enabled": true}`.
  - **Staff → Silent Auction → Auction setup** now has a **Raffle tickets** group: ticket
    price ($ → cents), optional bundle (quantity + price; both or neither), and a free-text
    details line (where tickets are sold, drawing time…). Saved with the same upsert.
  - **Public:** `RaffleTickets` (on `/bunfest/p/raffle`) renders **only** while the flag is
    on, carries a small **Preview** chip, and shows a price line / total **only** from
    `auction_settings` (unset → no price shown, blank total in the form post). The
    staff `raffle_details` text appears under the page's neutral "Raffle" copy when set.
    Reservations still post to the Netlify Form `raffle-request` (hidden form registered
    in `index.html`: quantity, total, MWBF-##### ticket codes, name, phone) — codes are
    generated client-side; **no payment processing** was added.
  - Hook: `src/features/settings/useSetting.ts` — `useSetting<T>(key, fallback)` /
    `useFeatureFlag(key)` (silent fallback on missing table/row), `fetchSettings(orgId)`,
    `setSetting(key, value, {orgId, userId})`.

- **Live-site parity + shared data contract — LIVE (2026-09-17).** Everything on
  the read-only WordPress site (ohiohouserabbitrescue.org) is now IN the app, built
  for phones, and the app shares ONE Supabase backend with the new OHRR website:
  - **New tables (migrations to paste into the Supabase SQL editor, in this order):**
    `supabase/migrations/20260917120000_events.sql`,
    `supabase/migrations/20260917120100_vets.sql`,
    `supabase/migrations/20260917120150_hero_slides.sql` (+ public `site-images`
    Storage bucket), then the seed
    `supabase/migrations/20260917120200_seed_live_site_content.sql` (idempotent;
    BunFest 2026 event, 27 vets, 13 care articles, the 4 volunteer positions, 6
    hero/featured slides). The seed is **generated** from the app's own data files by
    `node scripts/generate-seed-sql.mjs` (Node 22.6+), so the app fallback, the DB and
    the website agree — edit `src/data/{events,vets,careArticles,volunteer,heroSlides}.ts`
    and re-run; never hand-edit the seed. Until the migrations are applied every screen
    silently uses the bundled seed (`useEvents`, `useVets`, `useHeroSlides`,
    `useCareArticles` fallback).
  - **New public screens:** `/events` (upcoming first, map + calendar links),
    `/vets` (Find a rabbit-savvy vet: region filter, MedVet Hilliard 24/7 emergency
    banner, tap-to-call, EMERGENCY badges, low-cost spay/neuter, HRS vet lists, the
    live-site disclaimer), `/found` (Found a rabbit? / Need to surrender?: domestic-vs-wild,
    catching a stray, CHRS Help Line + Columbus Rabbit Field Rescue path, Admissions facts
    + both official online applications), `/adopt/how-it-works` (3 steps, still-deciding
    hour-long visit, free bunny matchmaking + what to expect at a bunny date, Petfinder /
    Adopt-A-Pet links, Adoption Policy summary + fees). `/give` redirects to `/support`.
  - **Rebuilt screens:** Home (photo quick actions: Find a vet · Found a stray · Adopt ·
    Volunteer · Give · Events; top cards from `hero_slides`; BunFest date/theme live),
    Give (EVERY channel incl. Kroger, license plate, merch, affiliates, Legacy Fund,
    Spay It Forward — with in-app "More" detail), Volunteer + VolunteerWay (the 4 REAL
    positions with verbatim requirements + real sign-up links; other needs; group visits;
    live "Open shifts"), Learn (13 seeded articles from the Resources page + Living Space
    + Stray, bare URLs tappable, vet card), Hop Shop (real product list, hours, map,
    live "In the shop now" when RLS allows), About (Mission & Vision, Background,
    Volunteer Family, contact parity incl. landmark directions, media email, socials).
    The BunFest sub-app reads its date/time/venue/theme from the BunFest event record
    via `useBunfestEvent()`.
  - **Staff:** `/staff/events` (gated `events.bunfest.manage`) and `/staff/vets`
    (gated `content.education.edit`), both with one-tap import of the bundled seed;
    nav entries + dashboard tiles; volunteer categories now `socialization` / `buncare` /
    `vet-transport` / `field-rescue` / `events` (unknown values tolerated).
  - **Unchanged by sponsor instruction:** adoptable rabbits stay on the labelled sample
    data; the Petfinder function was not touched. Link-only/noindex settings untouched.
  - **Could not fetch/verify:** the Binkybunny.com "cost of a house rabbit" page (404 —
    summarized from OHRR's description only, still linked); the Columbus Rabbit Field
    Rescue Facebook group has no public URL on the live site (named, not linked); the
    2026 BunFest logo artwork is not bundled (2025 logo still shown, theme text is 2026).

- **Staff backend (Supabase) — MERGED & LIVE (2026-06-27).** [PR #28] merged to
  `main` (merge `a60b8b5`) and **deployed to `ohrr-app.pages.dev`**. The staff admin
  is reachable at **`/staff`** (unlinked from the public app): Supabase Auth sign-in,
  role/capability access control, master-code owner bootstrap, a capability-gated
  **Hop Shop manager** (CRUD + inventory), a **Team** screen (invite + per-capability
  toggles + enable/disable), and worker **join**. The browser-safe Supabase config is
  committed in **`.env.production`** (public project URL + *publishable* anon key —
  safe by design; secrets never committed) so the Netlify build connects without
  dashboard env setup; verified the URL bakes into the live bundle and that RLS blocks
  anonymous access. Owner decisions confirmed 2026-06-27: login = email+password,
  admins = full access (no code change needed). Owner has **signed in + redeemed the
  master code (verified live 2026-06-27)**. A **second increment is live ([PR #29])**:
  a discreet **Settings → "OHRR Staff"** entry point (so staff don't need the `/staff`
  URL), an **Activity** (audit-log) view, and the **Team** screen now shows members by
  **email** via `list_org_members()` — apply
  `supabase/migrations/20260627053730_staff_admin_extras.sql` in the Supabase SQL
  editor to enable it (falls back to short IDs otherwise). **Password reset is now live ([PR #30])** — a
  "Forgot password?" flow on sign-in + a `/staff/reset` page; it needs one Supabase
  config step to accept the emailed link: add the app origin
  (`https://ohrr-app.pages.dev`) under **Auth → URL Configuration** (Site URL +
  Redirect URLs). The owner chose to **keep the public Hop Shop on curated samples**
  for now (not wired to live inventory). With that, the **staff admin is
  feature-complete for release** — what's left is owner-side Supabase config only
  (below). **Heads-up:** the Supabase project currently has **email confirmation ON**
  (`mailer_autoconfirm=false`), so new staff get a confirmation email — turn it off
  (Auth → Providers → Email → "Confirm email") for frictionless signup, or click the
  emailed link. See the **Staff backend (Supabase)** section below.
- **Staff-editable content (in progress, 2026-06-27).** Extending staff editing
  beyond the Hop Shop to everything non-static (owner's request). Per-area pattern: a
  DB table (RLS — public reads *published* rows, staff with that area's capability read
  drafts + write), a staff editor screen, and the public app reads live data (with
  sample fallback where it makes sense). **#1 Announcements is LIVE ([PR #31])**:
  `/staff/announcements` (gated `announcements.post`) posts notices shown on the OHRR
  home via `AnnouncementsBanner`. **Owner step:** apply
  `migrations/20260627063130_announcements.sql` in the Supabase SQL editor to switch it
  on (until then the banner shows nothing and the editor errors — nothing else breaks).
  **#2 Volunteer opportunities is LIVE ([PR #32])**: `/staff/volunteer` (gated
  `volunteers.shifts.manage`) manages the shifts / vet-transport runs / events shown
  on the `VolunteerWay` pages — each category shows live staff data when present,
  else the built-in samples; apply
  `migrations/20260627064506_volunteer_opportunities.sql`. **#3 Education / care guides
  is LIVE ([PR #33])**: `/staff/learn` (gated `content.education.edit`) edits the
  Rabbit Care articles — a one-click "Import the built-in guides" seeds the 7 existing
  guides (light-markdown body: `##` headings, `-` bullets); `Learn`/`LearnTopic` render
  live-or-built-in; apply `migrations/20260627065720_care_articles.sql` then tap import.
  **#4 Adoptable rabbits is LIVE ([PR #35])**: `/staff/adopt` (gated `adoptions.*`)
  manages rabbits with **photo uploads** (Supabase Storage `rabbit-photos` bucket) and
  adoption status (`set_rabbit_status` RPC for status-only workers); `getAdoptables()`
  now prefers app rabbits (then Petfinder, then samples); apply
  `migrations/20260627072524_rabbits.sql` (creates the table, RPC, and Storage bucket).
  **All four planned content areas are now staff-editable** (announcements, volunteer,
  care, adoptions). The Hop Shop *public* view still shows curated samples by the
  owner's choice (the staff Hop Shop manager is live).
- **Workflow:** finished, verified work is merged straight to `main` (auto-deploys
  to Netlify) — the sponsor is the only stakeholder, so we don't park work in draft
  PRs. Still branch + PR per change for clean history. *(Exception: the staff-backend
  build above keeps one draft PR open across steps, since its pieces — auth, RLS,
  screens — only fully verify together against the live Supabase project.)*
- **Latest on `main`:** [PR #13](https://github.com/chasingtheunicorn/ohrr-app/pull/13)
  (in-app polish: volunteer role codes, wrapping vendor filter, in-app surrender
  content) is **merged & live**, on top of #12 (event map) and #11 (volunteer hub +
  photos). The **in-app surrender intake form** (`feat/surrender-intake-form`) is the
  next merge.
- **Merged & live:** #13, #12, #11, [#10](https://github.com/chasingtheunicorn/ohrr-app/pull/10)
  (Settings + calendar chooser), [#9](https://github.com/chasingtheunicorn/ohrr-app/pull/9)
  (plan-your-day); PRs #1–#8 merged/closed.
- **Build health:** `npm run typecheck` and `npm run build` pass clean; features
  verified in-browser (or, when the screenshot tool is down, via the a11y snapshot
  + DOM geometry checks + interaction tests).
- **Phase:** v1 shipped and deployed. The app has grown well past the original
  "BunFest companion" scope into a full OHRR host app with BunFest as a themed
  sub-app. Now layering in attendee-retention + identity features, and making the
  service sections (Volunteer first) actually usable in-app.
- **Identity/backend note:** an optional email "profile" capability now exists
  (device-local, stable anonymous UUID, `src/lib/profile.ts`). `identityPayload()`
  is the seam for the **still-pending backend decision** — wiring a database to
  persist/sync profiles + saved data is the next major step.

---

## Stack & deployment

- **Frontend:** Vite 6 + React 19 + TypeScript + Tailwind CSS v4 + React Router 7.
- **Native shell (test builds):** Capacitor 8 — `capacitor.config.ts`, `android/` (Gradle 8.14,
  AGP 8.13, JDK 21, compileSdk 36 / minSdk 24), `ios/App/App.xcodeproj` (Swift Package
  Manager, iOS 15+, Xcode 16.4+; no CocoaPods). `npm run cap:sync` = web build + copy into
  both. Plugins: camera, local-notifications, browser, app, status-bar, splash-screen; icons
  and splash generated by `@capacitor/assets` from `resources/`. See `docs/HANDOFF.md`.
- **Hosting:** Netlify. Build `npm run build` → `dist/`; SPA fallback redirect so
  deep links/refreshes work; `NODE_VERSION = 22`.
- **Serverless:** `netlify/functions/petfinder.js` proxies Petfinder's API so the
  Adopt page can show OHRR's live adoptable rabbits. Credentials
  (`PETFINDER_CLIENT_ID/SECRET/ORG_ID`) are server-side only (set in Netlify env,
  never `VITE_`-prefixed). Until set, the page falls back to built-in sample data.
- **Backend:** **Supabase (Postgres + Auth + RLS)** is now being wired in for the
  **staff side** (`@supabase/supabase-js`, schema under `supabase/migrations/`,
  client in `src/lib/supabase.ts`). The public attendee-facing app is still
  read-only + outbound and builds/runs **without** Supabase env — staff screens show
  a "not configured" notice until `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are
  set (`.env.local` locally, Netlify env when deployed; anon key only on the client,
  never the service_role key). The Supabase schema is **already applied** to the live
  project and the OHRR org + a one-time master code are bootstrapped (the migration
  file just version-controls it).

---

## What's been built

### OHRR host app (routes under `/`)
- **Home** (`OhrrHome`) — branded landing / hub. *(feat/appointment-flow)* The visit
  mini-card no longer shows the street address; it shows hours + a "Visits are by
  appointment — schedule one" link to the new Appointment page (address is revealed
  there, after a visit is requested).
- **Appointment** (`Appointment`, `/appointment`) *(feat/appointment-flow,
  feat/appointment-slots, feat/appointment-date)* — a by-appointment "Schedule a
  Visit" page: a request form (Netlify `appointment-request`) plus a "prefer to
  call?" option. It has a **required date picker** (native calendar/manual entry,
  no past dates, **weekend-only** — weekday picks warn and block submit, since OHRR
  is open Sat/Sun) and **eight 30-minute slots** (12:00–3:30 PM, OHRR's open hours),
  **multi-select** so a visitor can flag
  several times that work (auto-sorted to clock order) — framed as **requests, not a
  booked time** (real availability/booked-slot logic awaits a backend). The
  **address/location shows only on the confirmation**, once a visit is requested.
  Swappable to a real third-party scheduler later if OHRR adopts one.
- **Adopt** (`Adopt`, `AdoptRabbit`) — live adoptable rabbits via the Petfinder
  Netlify function, with sample fallback; per-rabbit detail pages. *(PR #11)* The
  sample rabbits now show **real, freely-licensed photos** (bundled in
  `public/sample-bunnies/`, mapped in `src/data/photos.ts`) instead of an emoji;
  `RabbitPhoto` falls back to the placeholder only if an image fails to load.
  Photo credits are listed on the Settings screen.
- **Happy Tails** (`Tails`, `TailDetail`) — adopter showcase with a bunny status
  timeline and a "follow" capability (`src/lib/follow.ts`). *(feat/tails-and-bunfest-logo)*
  Now uses **real freely-licensed photos** (distinct set from Adopt, in
  `public/sample-bunnies/tail-*`) and **words-only status badges** — the cheesy
  status emojis (💪/🎉/etc.) were removed per sponsor feedback ("no icons — they date it").
  *(feat/tails-share-and-nav)* "Share your Happy Tail" is now an **in-app form**
  (`ShareTail`, `/tails/share`, Netlify `happy-tail`) instead of a link to the website.
- **Bunny Services** (`Services`, `ServiceSignup`) — bonding-session requests and
  mobile vet-clinic sign-ups.
- **Learn** (`Learn`, `LearnTopic`) — rabbit-care content brought fully in-app
  (native pages, not external links).
- **Volunteer** (`Volunteer`, `VolunteerWay`, `VolunteerSignup`) *(PR #11)* —
  built out as a real in-app section. "Become a volunteer" now opens an in-app
  form (Netlify `volunteer-signup`), not the OHRR website. Each way to help
  (`/volunteer/:slug`: socialization, vet-transport, events, foster) has its own
  detail page with **template data** clearly labelled *Sample* — bunnies who need
  socializing (with photos), open 1-hr shifts, vet-transport runs, and outreach
  events — each routing into the shared sign-up flow. Content in `src/data/volunteer.ts`.
  *(feat/inapp-polish)* Every sign-up now carries a **stable role `code`**
  (SOCIALIZE / VET-TRANSPORT / EVENTS / FOSTER / GENERAL) plus the human role and
  the specific `item`, so the OHRR-side submission says exactly what someone signed
  up for; the sign-up form headlines the role instead of a generic title.
- **Support / Give** (`Give`) — consolidated giving directory.
- **Hop Shop** (`HopShop`, `/hop-shop`) *(feat/hop-shop)* — an in-app, **browse-only**
  shop (the "Shop the Hop Shop" link is now native, not outbound) showing **example
  inventory** of real rabbit products + OHRR merch (16 items across Hay & Food /
  Toys / Comfort & Litter / Apparel, with prices + In/Low stock + a category
  filter), the Hop Shop's hours & address, and a note that purchases happen in
  person. Sample data clearly labelled; real stock will come from the planned
  staff scan-a-product / set-quantity tool. Data in `src/data/hopshop.ts`.
- **Settings** (`Settings`, gear icon in both top bars) — app version/build info,
  optional email identity (`src/lib/profile.ts`), and a saved-data summary.
- **About** (`About`), **NotFound** (`*`). *(PR #11)* The blunt "Surrender a
  rabbit" button is reframed as a compassionate **"Need help with your rabbit?"**
  card that leads with reaching out; the owner-surrender path stays available but
  de-emphasized — now linking to the in-app Surrender page (below), not the website.
- **Surrender** (`Surrender`, `/surrender`) *(feat/inapp-polish)* — OHRR's owner-
  surrender process brought **fully in-app** (no more linking out for the info):
  supportive intro, the 6-step process, the $40/$60 surrender donation, what happens
  to the rabbit after intake, the Good-Samaritan-vs-owner distinction, contact, and
  the **verbatim full policies** (Surrender & Relinquishment + Admissions) in
  collapsible sections. Content in `src/data/surrender.ts`, from OHRR's policy PDFs.
- **Intake form** (`SurrenderForm`, `/surrender/form?type=owner|good-samaritan`)
  *(feat/surrender-intake-form)* — the relinquishment **intake form is now in the
  app** instead of linking to OHRR's website. One data-driven form (schema in
  `src/data/surrenderForm.ts`) handles both types: owner (contact + full rabbit
  profile — enclosure, behaviors, litter, diet, vet, spay/neuter, etc.) and Good
  Samaritan (find circumstances). It carries the **verbatim relinquishment
  agreement** with a required checkbox + typed signature + date, and posts to
  Netlify Forms (`surrender-intake`, registered in `index.html`). The Surrender
  page’s two form buttons open it in-app.
- **Top bar / header** *(PR #11, feat/header-help-search, feat/tails-share-and-nav)*:
  outbound website links removed; the right-side cluster is a shared `HeaderActions`
  (**Search · Help · Settings**) on **both** top bars. **Returning from BunFest to
  the OHRR app is now an "OHRR" home tab — the first item in the BunFest bottom tab
  bar** (with a divider), chosen by the sponsor over two rejected top-of-screen
  treatments. The BunFest header is now clean (no back strip).
- **Help** (`Help`, `/help`) *(feat/header-help-search → rebuilt in feat/help-faq-hub)*
  — the `?` icon opens a **FAQ + support hub**: a prominent "Call / Email OHRR"
  card, a filterable FAQ (~21 Qs across Adopting · Care · Giving · Volunteering &
  surrender · BunFest · Using the app), each answer with a one-tap jump into the
  matching in-app page. This replaced the original screen-by-screen "describer,"
  which the sponsor (rightly, per UX research) found low-value. Content in
  `src/data/help.ts`.
- **Search** (`Search`, `/search`) *(feat/header-help-search)* — the search icon
  opens a **global app search** (type **or voice** via the Web Speech API) over an
  index of screens, adoptable rabbits, care topics, vendors, Happy Tails, volunteer
  roles, giving options, and BunFest sessions; results are grouped and link straight
  to the page. Index in `src/data/search.ts`. (Page-specific search is a future add.)

- **Rescue Partners / Find a Rescue** (`Partners`, `PartnerDetail`)
  *(feat/rescue-partner-directory)* — the partner directory is now a real
  **find-a-rescue hub**: each org shows researched **contact info** (address, phone
  → dialer, email → mail app, and the website **as text** above a "Visit website"
  button — via the reusable `ContactLinks`), and the list has **search by
  name/state** (full name or 2-letter, via `US_STATES`) **+ region filter**
  (Midwest/Northeast/South). The same component is mounted in **two places** (a
  `base` prop): BunFest (`/bunfest/partners`) and the **OHRR host app**
  (`/rescues` "Find a Rescue", in the home hub) so anyone, anywhere, lands on OHRR
  as the hub. Contact data researched from each org's public site 2026-06-18
  (fields left blank where not published — not guessed). Data + `US_STATES` in
  `src/data/partners.ts`.

### Midwest BunFest sub-app (routes under `/bunfest`, distinct look & feel)
- **Home** (`BunfestHome`), **Schedule** (`Schedule`), **Vendors**
  (`Vendors`, `VendorDetail`), **Rescue Partners** (`Partners`, `PartnerDetail`),
  **Sponsors** (`Sponsors`), **Visit** (`Visit`), **Give**.
- **BunFest content native** (`BunfestPage`, `/bunfest/p/:id`) *(feat/bunfest-native)*
  — the festival is now its **own entity** in-app: the "At the festival" activities
  (Bunny Spa, Glamour Shots, Raffle & Silent Auction, Toymaking, Chillaxabun Lounge —
  Education Sessions points to the native Schedule) and the Visit info pages
  (Bringing Your Bunny, the 9-term Rabbit Attendance Agreement, Accommodations/host
  hotel) are **native screens** instead of links out to midwestbunfest.org. Content
  transcribed from the BunFest site 2026-06-18; includes the RHDV2 vaccination rule,
  pricing, and the host-hotel contact (via `ContactLinks`). **Ticket purchase stays
  external** (payment). Data in `src/data/bunfestPages.ts`.
- **BunFest reserve & raffle** *(feat/bunfest-reserve-raffle)* — interactive add-ons
  on the activity pages: **Bunny Spa / Glamour Shots** have an in-app **session
  reservation** (`ReserveSession`: service + 30-min time window + name/phone/bunny →
  OHRR confirms; pay at the table — no payment backend needed), and the **Raffle** has
  an in-app **ticket flow** (`RaffleTickets`: quantity → reserves numbered MWBF-#####
  tickets to pay for at the table). **Since 2026-09-17 this is a TEST feature:** hidden
  unless switched on in `/staff/settings`, and pricing comes only from
  `auction_settings` (staff-entered; nothing hard-coded).
  Post to Netlify (`spa-reservation`, `glamour-reservation`, `raffle-request`),
  clearly labelled "pay in person until in-app payment is set up."
- **Silent Auction gallery** (`SilentAuction`, `/bunfest/silent-auction`)
  *(feat/silent-auction)* — a browsable gallery (linked from the Raffle page) of
  auction items, each with **item number, photo, description, estimated value, and a
  donor credit**, plus a category filter. Built to hold the real lineup ahead of the
  event (bidding stays in-person, by sponsor's choice); ships with **example items**
  using real representative photos (Wikimedia, credited in Settings) and BunFest
  vendor/sponsor donors, and shows a "Photo coming" placeholder for items without a
  photo yet. Data in `src/data/silentAuction.ts`.
- **Sponsor & vendor contact treatment** *(feat/sponsor-vendor-contacts)* — the
  Sponsors page now shows each sponsor's **researched contact info** via
  `ContactLinks` (address, phone → dialer, email → mail, website **as text** + a
  button) instead of a bare "Visit" link — most useful for the local Central Ohio
  vets (MedVet Hilliard, Pataskala, Animal Care Unlimited, Norton Road, Central Ohio
  Compounding). Vendor detail uses the same treatment for the shop link (URL text +
  "Visit shop"). Contacts researched from public listings 2026-06-18. Vendor *shops*
  remain external by design.
- **Year logo / theme art** *(feat/tails-and-bunfest-logo)* — the real **2025
  Midwest BunFest logo** ("Compassion in Motion") now headlines the BunFest card on
  the OHRR home and the BunFest home hero, replacing the cartoon-bunny emoji, to
  flag the year's theme. Bundled at `public/bunfest-2025-logo.jpg` and referenced
  via `event.logo` / `event.logoYear` — swap the file + year when 2026 art lands.
- **Event Map** (`EventMap`, `/bunfest/map`) *(feat/event-map)* — a built-in
  interactive floor plan that replaces the old external map link. Models the real
  2025 two-room layout (Burgundy + Emerald) with stages, Hop Shop, Bunny Spa,
  Glamour Shots, Chillaxabun Lounge, Silent Auction, Raffle, MedVet, etc., and lays
  all 27 vendors into numbered booths (B1–B12 / E1–E15) with one or two 8-ft tables
  each (Burgundy left→right, Emerald top→bottom). **Booth positions are estimates,
  clearly labelled** — OHRR sets the final layout. Tap a booth → vendor detail;
  deep-linkable `?vendor=<id>`. Vendor list/detail show booth + room. Data in
  `src/data/floorplan.ts`. *(Source: the real 2025 map at
  midwestbunfest.org/event-map.html.)*
- **Plan-your-day on Schedule** *(PR #9/#10, live)* — save/unsave sessions
  (account-free, `localStorage` via `src/lib/savedSessions.ts`), an All/Saved
  filter, and an "Add to calendar" chooser (`CalendarSheet`) offering **Apple/iOS**
  (one `.ics`, all saved) or **Google Calendar** (per-session links) via
  `src/lib/ics.ts`.

### Staff backend (Supabase) — routes under `/staff` *(feat/staff-backend, in progress)*
A separate, capability-gated admin shell for OHRR staff/volunteers, distinct from
the public attendee app. Design = `docs/05-...md`; schema = the Drive
`06-hopshop-backend.sql`. **Roles** owner/admin/staff; **capabilities** like
`hopshop.products.create`, `hopshop.inventory.update`, `staff.invite`. Owners/admins
implicitly hold all; staff hold only what's granted. **Row-Level Security in Postgres
is the real gate** — the UI only hides/shows controls for convenience.

- **Schema migration** — `supabase/migrations/20260627052536_hopshop_backend.sql`
  version-controls the already-applied schema (organizations, memberships, the
  permissions catalog + presets, invite codes, audit log, Hop Shop products +
  inventory, all RLS + the SECURITY DEFINER RPCs). Idempotent. `supabase/README.md`
  documents apply + `npm run gen:types`.
- **TS types** — `src/lib/database.types.ts` (hand-authored to mirror the applied
  schema until `supabase gen types --linked` can run with the project ref).
- **Client + context** — `src/lib/supabase.ts` (env-gated client + `errMessage`),
  `src/lib/capabilities.ts` (capability catalog + presets, mirrors the seed),
  `src/lib/auth.tsx` (`AuthProvider`/`useAuth`: session, membership, effective
  capabilities, `can()`, `refresh()`, `signOut()`).
- **Sign-in** (`StaffSignIn`, `/staff/signin`) — Supabase Auth **email + password**
  (sign in / create account; handles the "confirm your email" case), plus a
  **"Forgot password?"** flow → `/staff/reset` (`StaffResetPassword`) that consumes
  the recovery link and sets a new password. *(Email+password confirmed by the owner;
  magic-link remains a small swap if ever wanted.)*
- **Owner bootstrap** (`StaffOnboard`, `/staff/start`) — "Enter master code" →
  `rpc('redeem_master_code')` → caller becomes **Owner**.
- **Dashboard** (`StaffHome`, `/staff`) — routes by state (→ signin / → start /
  → dashboard); shows role, what you can manage, and a staff member's granted access.
- **Hop Shop manager** (`HopShopManager`, `/staff/hopshop`) — list / **create / edit /
  delete** products + a **stock stepper** (upserts `hopshop_inventory`). Every control
  is gated by the matching `hopshop.*` capability via `can()`, **and** the DB enforces
  it (RLS). View-only for members without write caps.
- **Team** (`StaffTeam`, `/staff/team`) — owner/admin (or `staff.invite` /
  `staff.permissions.manage`): **invite a worker** (role + preset or custom caps →
  `create_invite_code` → copyable single-use code), **per-capability toggles** on each
  staff member (`set_membership_permission`), and **enable/disable** (`set_membership_status`).
  Members currently show by role + short user-id (Supabase hides other users' emails
  from the client — a small `list_org_members()` SECURITY DEFINER function is the
  follow-up to show names/emails).
- **Worker join** (`StaffJoin`, `/staff/join`) — enter invite code →
  `redeem_invite_code` → joins scoped to the invite's preset/caps. Linked from the
  master-code screen.
- **Shell + guard** — `StaffLayout` (own top bar, role label, sign-out) + a compact
  **dropdown section menu** ([PR #34]) that shows the current section and opens a list
  of all of them — replaced the row of tabs that clipped once there were 7, and scales
  to any number of sections with no horizontal scroll. + `RequireMembership` (redirects
  to signin/start as needed). Wired in `App.tsx`; `AuthProvider` wraps the app in
  `main.tsx`.
- **Verified** so far via typecheck + `build` + browser render (sign-in renders,
  guard redirects unauthenticated `/staff/hopshop` → signin, public app unaffected,
  no console errors). **Live end-to-end auth/RLS not yet exercised** — needs the real
  `VITE_SUPABASE_*` env to sign in and redeem the master code.
- **Still to build (this feature):** live end-to-end verification against the real
  Supabase project (sign in → redeem master code → manage Hop Shop → invite a worker
  → worker joins → toggle caps); optionally a `list_org_members()` function to show
  member names/emails on the Team screen; optionally an audit-log view (`audit.view`);
  and connecting the **public** Hop Shop view to the live tables. Code-splitting the
  staff bundle (it pushed the JS to ~707 kB / 199 kB gzip) is a nice-to-have.

### Structure
- `src/pages/*` — route components (listed above).
- `src/components/*` — `OhrrLayout`/`OhrrTopBar`/`TabBar` (host shell),
  `BunfestLayout`/`BunfestTopBar` (sub-app shell), `RabbitPhoto`, `ScrollToTop`,
  `ui.tsx`, `tailbits.tsx`, `icons.tsx`.
- `src/data/*` — content/data modules: `adoptables`, `care`, `content`, `event`,
  `floorplan` (BunFest rooms/zones + vendor booth assignments), `giving`, `help`
  (FAQ categories + support hub), `ohrr`, `search` (global search index),
  `partners`, `photos` (sample bunny images + credits), `services`, `sessions`,
  `sponsors`, `surrender` (in-app owner-surrender content + verbatim policies),
  `surrenderForm` (intake form schema + relinquishment agreement), `tails`,
  `vendors`, `volunteer` (ways + role codes + template shifts/runs/events/bunnies),
  `version`.
- `src/lib/*` — `adopt.ts` (Petfinder helpers), `follow.ts` (follow state),
  `savedSessions.ts` (saved BunFest sessions), `ics.ts` (calendar export + Google
  URLs), `profile.ts` (optional email identity + DB-sync seam).
- `docs/*` — design docs (00–03), `START-HERE.md`, + this progress log.

### Shipped PRs (history)
1. Import OHRR design docs + project README. (#1)
2. Scaffold Midwest BunFest companion v1. (#2)
3. OHRR app as host + branded redesign, BunFest as themed sub-app. (#3)
4. Adopt page: live OHRR rabbits from Petfinder, in-app. (#4)
5. Happy Tails: adopter showcase + status timeline + follow. (#5)
6. BunFest Partners & Vendors detail pages, content in-app. (closed; work landed
   via the redesign/services line)
7. Bunny Services: bonding + vet-clinic scheduling & sign-ups. (closed; landed)
8. OHRR Learn & Volunteer content fully in-app. (#8)

---

## Known gaps / cleanup

- **README "Status" is stale** — it still says "No application code written yet."
  (Fixed in the commit that adds this log.)
- **Drive design docs (00, 02, 03) are stale** — they describe the Discovery
  phase ("no code yet"). They remain accurate as the *original strategy*, but a
  reader should treat this progress log as the live status. Consider refreshing
  them once we confirm with the sponsor.
- **No automated tests / CI** yet.
- **Public dynamic features are still client-only / Netlify Forms** — service
  sign-ups, follow, saved sessions, etc. have no database persistence. Supabase is
  now wired for the **staff** side; extending it to attendee-facing persistence is a
  separate, later step.
- **Staff backend not yet verified live** — auth + RLS + the RPCs are coded and
  build clean, but end-to-end (sign in → redeem master code → manage Hop Shop) needs
  the real `VITE_SUPABASE_*` env to exercise against the live project.

---

## Next steps (candidate, from the roadmap)

These are the sponsor-requested directions captured in project memory + the
strategy doc; not yet scheduled:

- **Donation tax-receipt flow** *(sponsor request 2026-06-17 → ON HOLD by sponsor
  decision same day)* — the plan is to **wire a real donation processor**
  (Donorbox / Givebutter / Stripe) so gifts are paid in-app and the processor
  auto-emails an **official, verified** tax receipt. The sponsor chose to defer this
  until a processor is set up, and explicitly **did not** want the interim
  self-reported PDF "acknowledgment" (to avoid OHRR issuing receipts for unverified
  amounts). OHRR has **no processor set up yet** (or it's unknown). Resume when a
  processor + its account/keys are available. Today the Give pages just deep-link to
  OHRR's own donation page.
- **Raffle / reservation ticketing — explore further** *(sponsor feedback 2026-06-18:
  "keep it as a note to come back to")* — the sponsor likes the in-app reserve /
  get-a-ticket flow for the **raffle, Bunny Spa, and Glamour Shots** (and that it
  lets people buy more tickets easily); **keep the current implementation as-is** for
  now. To work out next: the **ticket-number process** — how raffle ticket numbers
  are generated, made unique/verifiable, and especially **how a digital ticket ties
  into the in-person drawing** (so an app-issued ticket can be entered/win in the
  bucket draw). Pairs with wiring **in-app payment** so "get tickets" / reservations
  become real purchases (see the donation-processor item above). Today both reserve
  numbered tickets to pay for in person (`RaffleTickets` / `ReserveSession`).
- **Petfinder go-live** — set the real Petfinder credentials in Netlify so Adopt
  shows live inventory instead of samples. (Answered a sponsor question 2026-06-17:
  the Adopt page already uses the Petfinder feed via `netlify/functions/petfinder.js`;
  it only shows samples because `PETFINDER_CLIENT_ID/SECRET/ORG_ID` aren't set in
  Netlify yet. We use Petfinder, not the OHRR website, because the site blocks
  automated fetching and has no API.)
- **Engagement / follow** — turn the client-only follow into something durable.
- **Bonding & vet scheduling** — back the Services sign-ups with real persistence
  + notifications.
- **Content in-app** — continue migrating OHRR/BunFest content natively.
- **Backend decision** — choose and wire a backend (Supabase is the documented
  candidate) to persist sign-ups, follows, and any registration. The Volunteer
  sign-ups (`volunteer-signup`) and Service sign-ups currently post to Netlify
  Forms; a real backend would let shifts/runs show true remaining capacity.
- ~~**Rabbit breed identifier / guide** *(sponsor request, 2026-06-17)*~~ — **built 2026-09-21**
  (`/learn/breeds`, see Current state).
- ~~**Dead external-link code cleanup**~~ — done 2026-09-21 (`learnLinks`, `surrenderForms`,
  `LinkCard` removed; `ExternalCard` is still used by Bunny Help and My Bunny).
- **Amazon Wish List — deep links to items** *(sponsor request, later)* — instead of
  one link to the list, link directly to individual items (open in the Amazon app).
- **Hop Shop inventory back end** *(sponsor request; needs backend)* — the public
  **browse-only** Hop Shop view is **built** (`/hop-shop`, example data), and the
  **staff Hop Shop manager** (`/staff/hopshop`, Supabase-backed CRUD + stock) is now
  built behind the access-control model. Still to do: connect the **public** Hop Shop
  view to the live `hopshop_products`/`hopshop_inventory` tables (it currently reads
  static sample data), and add the nicer **scan-a-product + photograph + set-quantity**
  staff flow + product photos (Supabase Storage) on top of the basic manager.
- **In-app mailing-list signup** *(sponsor request, later; needs email backend)* —
  replace the outbound link with an in-app signup that uses the device profile email
  and **validates via an emailed code** entered back in the app.
- **Swap template volunteer data for OHRR's real schedule** — the shifts, runs,
  events, and socialization bunnies in `src/data/volunteer.ts` are clearly-labelled
  samples; replace with OHRR's actual calendar (or back them with the database).
- **Verify [VERIFY] facts with OHRR** — current hours; BunFest first year + edition
  count (matters for any anniversary feature).

---

## Working protocol (do not skip)

1. **On start:** pull `main`; read the four Drive docs (start with
   `03-conversation-summary.md`) and this log.
2. **Work on a branch**, keep a draft PR open; commit + push after every
   meaningful change — never leave work only in the session.
3. **End of each work chunk:** update this file, push it, and copy it to the Drive
   "OHRR App Design" folder as `04-progress-log.md`.
4. **Before ending a turn:** everything committed + pushed and this log current,
   so a fresh session can resume from GitHub + Drive alone.

## 2026-09-17 — Home screen: more above the fold
Sponsor: "the app has just BunFest above the fold — we need more ideas and options on the phone screen." Home now opens with a compact **My Bunny** strip (your bunny's photo or a rotating sample, greeting by name, next reminder / due badge, and a one-line "Today's tip" from OHRR's care topics that changes daily), then the hero slides as a **swipeable row** (BunFest first with a countdown; the next card peeks), then **quick actions 3-across**. The blue header is slimmer (its Adopt/Donate buttons duplicated the tab bar). Same data as before; hero/featured slides come from `hero_slides`.

## 2026-09-17 — My Bunny grows up: fluffles, photos in IndexedDB, roles, archive
Sponsor: fosters, sponsors and the rescue itself should be able to keep every rabbit in their care in **My Bunny**, take photos with the phone camera, and keep records when a bunny leaves.

- **Camera:** the add/edit form now offers **Take a photo** (`<input capture="environment">`, opens the native camera) and **Choose from library**; same ≤512px JPEG downscale, preview and Remove.
- **Up to 100 bunnies** (`MAX_BUNNIES`, active bunnies only) with a friendly limit message on the add screen, the list and Home. To make that fit, **photos moved out of localStorage into IndexedDB** (`src/features/mybunny/photos.ts`: DB `ohrr-mybunny`, store `photos`, one data-URL record per bunny id, in-memory cache + `useBunnyPhoto` hook; every call is try/caught so a browser without IndexedDB just shows initials). Metadata stays in localStorage under **`ohrr.mybunny.v2`** with a `hasPhoto` flag. **One-time migration:** the v1 blob is read, its inline photos are written to IndexedDB, the JSON is re-saved as v2, and the v1 key is removed only once every photo landed (otherwise it retries next load).
- **Naming by count:** 1 → *My Bunny*, 2 → *My Bunnies*, 3+ → *My Fluffle* (with a dismissable one-line "why fluffle" note and a tooltip) — on the Home label, the list heading and the browser tab (`useDocumentTitle`). Route stays `/my-bunny`.
- **Home strip layouts** (`HomeCard.tsx`, same design language): 1 bunny = the existing strip; 2 = greeting "Good morning, Clover & Mochi" over two side-by-side photo tiles with a due pill, each opening that bunny; 3+ = "Good morning — 7 in your fluffle · 2 reminders due" over a scrollable row of round avatars (+ an Add tile while under the limit). Archived bunnies never appear.
- **List page:** count-aware heading; avatar row on top for 3+; **name search + role filter** once there are more than 8; each row shows avatar, name, age, role chip and the next reminder / due pill; a collapsed **Archived (N)** section.
- **Role per bunny** (required select, default *My pet*): `pet` / `foster` / `sponsored` / `resident`, shown as a chip on rows and the profile.
- **Archive:** on the profile, *Archive this bunny* → reason (Adopted / Rehomed / Passed away / Other) + date (default today) + note. Archived bunnies leave Home, the active list, the avatar rows and the due counts but keep every record; their profile shows a banner with reason/date and a **Restore** button (refused with the same friendly message if it would exceed the limit). Delete stays a separate confirmed action and also removes the IndexedDB photo.
- **Backup/Restore:** export embeds photos as `photoDataUrl` per bunny (same shape v1 used) and includes archived bunnies; import merges add-only as before and writes the new bunnies' photos back to IndexedDB (the result now counts photos).
- **Checks:** `node scripts/mybunny-check.ts` → 183 checks incl. title-by-count, v1→v2 migration stripping photos, `MAX_BUNNIES`, archive/restore vs due counts and active lists, and a backup round-trip with a photo and an archived bunny. `npm run build` clean. Verified in the browser: migration of a seeded v1 blob, all three Home layouts, list search/filter, archive → restore, photo save/delete/import via IndexedDB, and the 100-bunny states.
- Not done: no bulk archive, no per-bunny photo galleries (one photo each), no Netlify go-live poll this time (the OHRR Netlify team is out of deploy credits this month — pushes to `main` land in GitHub and will deploy when credits reset).

## 2026-09-17 — Capacitor: Android + iOS internal test builds
Sponsor wants the app on phones for internal testers (Google Play internal testing now; TestFlight from the Mac). Zero-cost rule kept: Capacitor 8 + its free official plugins only.

- **Scaffold:** `capacitor.config.ts` (appId `org.ohiohouserabbitrescue.app`, appName OHRR, webDir `dist`, `androidScheme: 'https'`, brand-blue splash/status-bar config, notification small icon), `android/` and `ios/` committed (each with its own `.gitignore`; root `.gitignore` also blocks keystores and `android/keystore.properties`; `.gitattributes` pins LF on gradlew/pbxproj/plist for Mac checkouts). Scripts `cap:sync`, `cap:android`, `cap:ios`, `cap:assets`.
- **`src/native/`** — `platform.ts` (`isNative`, shell init), `camera.ts` (`pickPhoto`), `reminderSchedule.ts` (pure: 28-bit notification ids, 09:00-local occurrence times, overdue → next 9 AM nudge; 22 new checks → 205 total), `notifications.ts` (schedule / cancel / isScheduled / resync; asks permission first), `browser.ts` (`openExternal` + one document click hook for outside http(s) / `target=_blank` links), `NativeBridge.tsx` (mounted in `main.tsx`: splash + status bar after first paint, link hook, Android back button, notification tap → bunny page). Plugins are imported lazily, so the web bundle only gains `@capacitor/core` (~11 KB).
- **My Bunny in the app:** camera / library buttons call the native picker (same 512px downscale; `downscaleImage` now also takes a data URL); "Add to my phone's calendar" → **"Remind me on this phone"** toggle per reminder + "Remind me about all N"; Mark done re-schedules, edit re-syncs, delete / archive / remove-bunny cancel; copy on the list and empty state follows. "Back up" is disabled in the app with a note (blob downloads can't reach Files — a share-sheet export is a later build); BunFest CalendarSheet hides the .ics option in the app.
- **Native config:** Android manifest — CAMERA (photo picker needs no storage permission, so READ_MEDIA_IMAGES deliberately not declared), POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED, portrait-only; iOS Info.plist — NSCamera / NSPhotoLibrary(/Add) usage strings, portrait-only, arm64, `ITSAppUsesNonExemptEncryption=false`; versions 0.1.0 / versionCode 1 / MARKETING_VERSION 0.1.0.
- **Icons + splash:** `scripts/make-native-assets.py` (Pillow) builds `resources/` from `public/ohrr-mark.png` — the mark in a white disc on brand blue (the mark is drawn for a white background, so no chroma-keying) — plus the Android status-bar icon `ic_stat_ohrr` (white silhouette). `npm run cap:assets` generated the adaptive/legacy launcher icons, splash drawables and the iOS AppIcon / Splash sets (committed).
- **Android build done here:** JDK 21 + Android SDK 36 were present, so `gradlew bundleRelease` / `assembleDebug` ran: **`ohrr-0.1.0-vc1-release.aab`** (signed, `jarsigner -verify` OK) and **`ohrr-0.1.0-vc1-debug.apk`** in Drive `07-OHRR App/Mobile builds/android/`. Test keystore `ohrr-test.keystore` + `README.txt` (passwords, keep-forever rule) in `…/Mobile builds/keys/`; `android/app/build.gradle` signs release when the gitignored `android/keystore.properties` exists (`keystore.properties.example` committed).
- **Handoff:** `docs/HANDOFF.md` and Drive `07-OHRR App/OHRR Mobile Build Handoff.docx` (same content, generated from one source with the `docx` npm package): where things are, prerequisites (Mac: Xcode 16.4+, Node 22, no CocoaPods; Android Studio + JDK 21), numbered iPhone steps (clone → `npm install` → `npm run cap:sync` → `npm run cap:ios` → Team / bundle id → Run → Archive → TestFlight internal), Android steps (Studio or gradle → Play Console internal testing, versionCode rule, keystore rule), rebuild after a change, tester checklist, what's OFF (raffle-ticket flag, Petfinder proxy, Netlify-form posts, in-app Back up, .ics), public-release checklist (Apple org enrolment + D-U-N-S + nonprofit fee waiver, Play org verification / 14-day closed test, privacy URL after board review, remove noindex, listing text, screenshots), troubleshooting.
- **Verified:** `npm run build` clean (dist works — checked at localhost:4173: web pages still show the calendar buttons and no native UI; with a fake Android bridge injected, the native "Remind me on this phone" rows render and outside links are intercepted), `npx tsc --noEmit` clean, `npx cap sync` OK, `node scripts/mybunny-check.ts` 205 checks (also fixed its stale Netlify UID expectation from the Cloudflare move).
- Not done / for the Mac: iOS build + TestFlight (needs Xcode). Not attempted: share-sheet backup export, push notifications, a Cloudflare replacement for the Netlify form posts (pre-existing gap, documented in the handoff).
