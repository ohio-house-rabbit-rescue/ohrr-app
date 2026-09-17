// Browser-free checks for the My Bunny pure modules (ics + storage helpers).
// Run with:  node scripts/mybunny-check.ts   (Node ≥ 22.6 strips the types)
// Exits non-zero on the first failed assertion.

import {
  escapeText,
  foldLine,
  formatLocalDateTime,
  formatLocalEnd,
  rruleFor,
  buildCalendar,
  reminderEvent,
  buildReminderIcs,
  buildAllRemindersIcs,
  reminderFilename,
  googleCalendarUrl,
} from '../src/features/mybunny/ics.ts'
import {
  addDays,
  daysBetween,
  dueStatus,
  describeDue,
  formatInterval,
  advance,
  isUpcoming,
  ageMonths,
  formatAge,
  gramsToLbOz,
  lbOzToGrams,
  formatWeight,
  formatWeightDelta,
  sanitize,
  parseData,
  mergeData,
  dueCount,
  remindersFor,
  collectionTitle,
  isIsoDate,
  extractPhotos,
  activeBunnies,
  archivedBunnies,
  atBunnyLimit,
  applyArchive,
  applyRestore,
  buildBackup,
  parseBackup,
  addBunny,
  archiveBunny,
  restoreBunny,
  getMyBunny,
  nextReminder,
  MAX_BUNNIES,
  LIMIT_MESSAGE,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  type Bunny,
  type Reminder,
  type MyBunnyData,
} from '../src/features/mybunny/storage.ts'

let checks = 0
/** JSON with object keys sorted at every level, so comparisons ignore key order. */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, (val as Record<string, unknown>)[k]]))
      : val,
  )
}
function eq<T>(actual: T, expected: T, label: string) {
  checks += 1
  const a = canon(actual)
  const e = canon(expected)
  if (a !== e) {
    console.error(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`)
    process.exit(1)
  }
}
function ok(cond: boolean, label: string) {
  eq(cond, true, label)
}

/* ------------------------------------------------------------------ ics */

eq(escapeText('a,b;c\\d\nline2\r\nline3'), 'a\\,b\\;c\\\\d\\nline2\\nline3', 'escapeText')

const long = 'DESCRIPTION:' + 'x'.repeat(200)
const folded = foldLine(long)
const physical = folded.split('\r\n')
ok(physical.length === 3, 'fold splits into 3 physical lines')
ok(physical.every((l) => Buffer.byteLength(l, 'utf8') <= 75), 'each folded line ≤ 75 octets')
ok(physical.slice(1).every((l) => l.startsWith(' ')), 'continuation lines start with a space')
eq(physical.join('').replace(/\r\n /g, ''), long.slice(0, 75) + ' ' + long.slice(75, 149) + ' ' + long.slice(149), 'fold preserves content')
// unfolding (drop CRLF+space) restores the original
eq(folded.replace(/\r\n /g, ''), long, 'unfolding restores original')

// multi-byte: 40 × "é" (2 bytes each) = 80 bytes; must not split a char
const accented = 'SUMMARY:' + 'é'.repeat(40)
const foldedAcc = foldLine(accented)
ok(foldedAcc.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75), 'utf-8 fold ≤ 75 octets')
eq(foldedAcc.replace(/\r\n /g, ''), accented, 'utf-8 fold never splits a character')
ok(!foldedAcc.includes('�'), 'no replacement chars')

eq(formatLocalDateTime('2026-09-17', 9, 0), '20260917T090000', 'formatLocalDateTime')
eq(formatLocalEnd('2026-09-17', 9, 0, 30), '20260917T093000', 'formatLocalEnd')
eq(formatLocalEnd('2026-12-31', 23, 45, 30), '20270101T001500', 'formatLocalEnd rolls over midnight/year')
eq(rruleFor(42), 'RRULE:FREQ=DAILY;INTERVAL=42', 'rrule daily')
eq(rruleFor(365), 'RRULE:FREQ=YEARLY', 'rrule yearly')

const nails: Reminder = {
  id: 'r1',
  bunnyId: 'b1',
  type: 'nails',
  title: 'Nail trim',
  intervalDays: 42,
  nextDue: '2026-10-29',
  notes: 'Use the small clippers; treats after, please',
}
const booster: Reminder = { id: 'r2', bunnyId: 'b1', type: 'rhdv2', title: 'RHDV2 vaccine booster', intervalDays: 365, nextDue: '2027-03-01' }
const oneOff: Reminder = { id: 'r3', bunnyId: 'b1', type: 'custom', title: 'Pick up meds', intervalDays: null, nextDue: '2026-09-20' }

const ev = reminderEvent(nails, 'Clover')
eq(ev.summary, 'Nail trim — Clover (OHRR app)', 'summary format')
eq(ev.uid, 'r1@mybunny.ohrr-app.netlify.app', 'uid per reminder')
eq(ev.alarms, ['-PT0M'], 'non-yearly alarm')
eq(reminderEvent(booster, 'Clover').alarms, ['-P1D', '-PT0M'], 'yearly gets day-before + at-time alarms')

const now = new Date('2026-09-17T13:15:00Z')
const ics = buildReminderIcs(nails, 'Clover', now)
ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:'), 'calendar header')
ok(ics.endsWith('END:VCALENDAR\r\n'), 'calendar footer with CRLF')
ok(!/[^\r]\n/.test(ics), 'every newline is CRLF')
ok(ics.includes('\r\nDTSTAMP:20260917T131500Z\r\n'), 'DTSTAMP is UTC')
ok(ics.includes('\r\nDTSTART:20261029T090000\r\n'), 'DTSTART floating 09:00 local')
ok(ics.includes('\r\nDTEND:20261029T093000\r\n'), 'DTEND +30 min')
ok(ics.includes('\r\nRRULE:FREQ=DAILY;INTERVAL=42\r\n'), 'RRULE present')
ok(ics.includes('\r\nSUMMARY:Nail trim — Clover (OHRR app)\r\n'), 'SUMMARY')
// long lines are folded on output, so unfold (drop CRLF+space) before matching content
const unfolded = ics.replace(/\r\n /g, '')
ok(unfolded.includes('\r\nDESCRIPTION:Use the small clippers\\; treats after\\, please\\n\\nRepeats every 42 days.'), 'DESCRIPTION escaped + notes')
ok(unfolded.includes('https://ohrr-app.netlify.app/my-bunny'), 'link back to the app')
ok(ics !== unfolded, 'at least one line was folded')
ok(ics.includes('\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\n'), 'VALARM block')
ok(ics.includes('\r\nTRIGGER:-PT0M\r\n'), 'VALARM trigger')
ok(ics.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75), 'all output lines ≤ 75 octets')

const all = buildAllRemindersIcs([nails, booster, oneOff], 'Clover', now)
eq((all.match(/BEGIN:VEVENT/g) ?? []).length, 3, 'bundle has 3 VEVENTs')
eq((all.match(/BEGIN:VCALENDAR/g) ?? []).length, 1, 'bundle has 1 VCALENDAR')
ok(!all.includes('UID:r3@') === false, 'one-off included in bundle')
ok(!/UID:r3@[\s\S]*?RRULE/.test(all.slice(all.indexOf('UID:r3@'), all.indexOf('END:VEVENT', all.indexOf('UID:r3@')))), 'one-off has no RRULE')

eq(reminderFilename(nails, 'Clover'), 'nail-trim-clover.ics', 'filename slug')
eq(reminderFilename({ ...nails, title: 'RHDV2 vaccine booster!' }, 'Señor Flops'), 'rhdv2-vaccine-booster-senor-flops.ics', 'filename slug normalises accents')

const g = new URL(googleCalendarUrl(ev))
eq(g.searchParams.get('dates'), '20261029T090000/20261029T093000', 'google dates')
eq(g.searchParams.get('recur'), 'RRULE:FREQ=DAILY;INTERVAL=42', 'google recur')
eq(g.searchParams.get('text'), 'Nail trim — Clover (OHRR app)', 'google text')

/* -------------------------------------------------------------- storage */

eq(addDays('2026-01-30', 1), '2026-01-31', 'addDays')
eq(addDays('2026-02-28', 1), '2026-03-01', 'addDays month roll')
eq(addDays('2026-12-31', 1), '2027-01-01', 'addDays year roll')
eq(daysBetween('2026-03-07', '2026-03-09'), 2, 'daysBetween across US DST change')
eq(daysBetween('2026-09-17', '2026-09-10'), -7, 'daysBetween negative')

const today = '2026-09-17'
eq(dueStatus('2026-09-16', today), 'overdue', 'dueStatus overdue')
eq(dueStatus('2026-09-17', today), 'today', 'dueStatus today')
eq(dueStatus('2026-09-24', today), 'soon', 'dueStatus soon (7d)')
eq(dueStatus('2026-09-25', today), 'later', 'dueStatus later (8d)')
eq(describeDue('2026-09-16', today), 'Overdue by 1 day', 'describeDue 1 day')
eq(describeDue('2026-09-14', today), 'Overdue by 3 days', 'describeDue 3 days')
eq(describeDue('2026-09-17', today), 'Due today', 'describeDue today')
eq(describeDue('2026-09-18', today), 'Due tomorrow', 'describeDue tomorrow')
eq(describeDue('2026-09-22', today), 'Due in 5 days', 'describeDue in 5 days')
ok(describeDue('2026-08-01', today).startsWith('Overdue since '), 'describeDue long overdue → since date')
ok(describeDue('2026-11-01', today).startsWith('Due '), 'describeDue far future → date')

eq(formatInterval(null), 'Doesn’t repeat', 'interval none')
eq(formatInterval(42), 'Every 6 weeks', 'interval 6 weeks')
eq(formatInterval(365), 'Yearly', 'interval yearly')
eq(formatInterval(3), 'Every 3 days', 'interval 3 days')
eq(formatInterval(7), 'Weekly', 'interval weekly')

const advanced = advance({ ...nails, nextDue: '2026-09-10' }, today)
eq(advanced.nextDue, addDays(today, 42), 'advance: overdue repeating rolls forward from the done date')
eq(advanced.lastDone, today, 'advance records lastDone')
const doneOneOff = advance(oneOff, today)
eq(doneOneOff.nextDue, oneOff.nextDue, 'advance one-off keeps date')
eq(isUpcoming(doneOneOff), false, 'done one-off is not upcoming')
eq(isUpcoming(oneOff), true, 'pending one-off is upcoming')
eq(isUpcoming(advanced), true, 'repeating stays upcoming')

eq(ageMonths({ birthday: '2024-06-10' }, today), 27, 'ageMonths from birthday')
eq(formatAge({ birthday: '2024-06-10' }, today), '2 yrs 3 mo', 'formatAge yrs+mo')
eq(formatAge({ birthday: '2025-09-17' }, today), '1 yr', 'formatAge exactly 1 yr')
eq(formatAge({ birthday: '2026-02-20' }, today), '6 mo', 'formatAge months')
eq(formatAge({ birthday: '2026-08-10' }, today), '5 wks', 'formatAge weeks')
eq(formatAge({ approxAgeMonths: 30, approxAgeAsOf: '2026-03-17' }, today), 'about 3 yrs', 'approx age keeps counting')
eq(formatAge({}, today), null, 'no age known')

eq(gramsToLbOz(1905), { lb: 4, oz: 3.2 }, 'gramsToLbOz')
eq(gramsToLbOz(453), { lb: 1, oz: 0 }, 'gramsToLbOz 453 g = 15.98 oz rounds to 16.0 and carries into 1 lb')
eq(gramsToLbOz(454), { lb: 1, oz: 0 }, 'gramsToLbOz 1 lb')
eq(lbOzToGrams(4, 3.2), 1905, 'lbOzToGrams')
eq(gramsToLbOz(lbOzToGrams(2, 8)), { lb: 2, oz: 8 }, 'lb/oz round-trip')
eq(formatWeight(1905, 'lb'), '4 lb 3.2 oz', 'formatWeight lb')
eq(formatWeight(1905, 'g'), '1,905 g', 'formatWeight g')
eq(formatWeight(200, 'lb'), '7.1 oz', 'formatWeight under 1 lb')
eq(formatWeightDelta(-40, 'g'), '−40 g', 'delta g')
eq(formatWeightDelta(34, 'lb'), '+1.2 oz', 'delta oz')
eq(formatWeightDelta(1, 'lb'), null, 'delta below resolution')

// sanitize: garbage in → valid dataset out, orphans dropped
const messy = {
  bunnies: [
    { id: 'b1', name: '  Clover ', photoDataUrl: 'javascript:alert(1)', sex: 'female', birthday: 'nope', approxAgeMonths: 14.6 },
    { id: '', name: 'no id' },
    'string',
  ],
  reminders: [
    { id: 'r1', bunnyId: 'b1', type: 'nails', title: 'Nail trim', intervalDays: 42, nextDue: '2026-10-29' },
    { id: 'r9', bunnyId: 'ghost', type: 'nails', title: 'Orphan', intervalDays: 42, nextDue: '2026-10-29' },
    { id: 'r2', bunnyId: 'b1', type: 'weird', title: 'Custom-ish', intervalDays: 0, nextDue: '2026-10-29' },
  ],
  weights: { b1: [{ date: '2026-09-01', grams: 1900 }, { date: '2026-08-01', grams: 1850.4 }, { date: 'x', grams: 1 }, { date: '2026-09-01', grams: 1910 }], ghost: [] },
  prefs: { weightUnit: 'stone' },
}
const clean = sanitize(messy)
eq(clean.bunnies.length, 1, 'sanitize drops invalid bunnies')
eq(clean.bunnies[0].name, 'Clover', 'sanitize trims name')
eq(clean.bunnies[0].hasPhoto, undefined, 'sanitize rejects non-data-URL photo (no hasPhoto)')
eq(extractPhotos(messy), {}, 'extractPhotos ignores non-data-URL photo')
eq(clean.bunnies[0].role, 'pet', 'missing role → pet')
eq(clean.bunnies[0].birthday, undefined, 'sanitize drops malformed birthday')
eq(clean.bunnies[0].approxAgeMonths, 15, 'sanitize rounds approx age')
eq(clean.reminders.map((r) => r.id), ['r1', 'r2'], 'sanitize drops orphan reminders')
eq(clean.reminders[1].type, 'custom', 'unknown type → custom')
eq(clean.reminders[1].intervalDays, null, 'interval 0 → null')
eq(clean.weights.b1, [{ date: '2026-08-01', grams: 1850 }, { date: '2026-09-01', grams: 1910 }], 'weights sorted, deduped by date (last wins), rounded')
eq(clean.weights.ghost, undefined, 'orphan weights dropped')
eq(clean.prefs.weightUnit, 'lb', 'bad unit → lb')
eq(parseData('{not json').bunnies, [], 'parseData survives bad JSON')
eq(parseData(null).version, 2, 'parseData null → empty v2')

// merge: same ids replaced, new ones added, weights unioned
const current: MyBunnyData = {
  version: 2,
  bunnies: [{ id: 'b1', name: 'Clover', role: 'pet', createdAt: 'x' }],
  reminders: [nails],
  weights: { b1: [{ date: '2026-09-01', grams: 1900 }] },
  health: [{ id: 'h1', bunnyId: 'b1', date: '2026-09-01', noticed: 'Soft poops', resolved: true, createdAt: 'x' }],
  prefs: { weightUnit: 'g' },
}
const incoming: MyBunnyData = {
  version: 2,
  bunnies: [
    { id: 'b1', name: 'Clover B.', role: 'pet', createdAt: 'y' },
    { id: 'b2', name: 'Pip', role: 'foster', createdAt: 'z' },
  ],
  reminders: [{ ...nails, title: 'Nail trim (backup)' }, booster],
  weights: { b1: [{ date: '2026-08-01', grams: 1850 }], b2: [{ date: '2026-09-10', grams: 1200 }] },
  health: [
    { id: 'h1', bunnyId: 'b1', date: '2026-09-01', noticed: 'SHOULD NOT OVERWRITE', resolved: false, createdAt: 'y' },
    { id: 'h2', bunnyId: 'b2', date: '2026-09-12', noticed: 'Not eating hay', topicSlug: 'hay-pellets', topicTitle: 'Hay', resolved: false, createdAt: 'z' },
  ],
  prefs: { weightUnit: 'lb' },
}
const merged = mergeData(current, incoming)
eq(merged.data.bunnies.map((b) => b.name), ['Clover', 'Pip'], 'merge is add-only: local record kept, new one added')
eq(merged.data.reminders.map((r) => r.title), ['Nail trim', 'RHDV2 vaccine booster'], 'merge keeps local reminder, adds new')
eq(merged.data.weights.b1.map((w) => w.date), ['2026-08-01', '2026-09-01'], 'merge unions weights')
eq(merged.data.weights.b2.length, 1, 'merge adds weights for a new bunny')
eq(merged.data.prefs.weightUnit, 'g', 'merge keeps local prefs')
eq(merged.data.health.map((h) => h.noticed), ['Soft poops', 'Not eating hay'], 'merge keeps local health note, adds new')
eq(merged.result, { bunnies: 1, reminders: 1, weights: 2, health: 1 }, 'merge result counts only what was added')
eq(mergeData(merged.data, incoming).result, { bunnies: 0, reminders: 0, weights: 0, health: 0 }, 'restoring the same backup twice adds nothing')
// health notes sanitize: orphan + missing fields dropped
const hs = sanitize({ bunnies: [{ id: 'b1', name: 'C' }], health: [
  { id: 'h1', bunnyId: 'b1', date: '2026-09-01', noticed: '  Hiding ', resolved: 'yes' },
  { id: 'h2', bunnyId: 'ghost', date: '2026-09-01', noticed: 'x' },
  { id: 'h3', bunnyId: 'b1', date: 'bad', noticed: 'x' },
] })
eq(hs.health.length, 1, 'sanitize drops orphan / malformed health notes')
eq(hs.health[0].noticed, 'Hiding', 'sanitize trims health note text')
eq(hs.health[0].resolved, false, 'non-boolean resolved → false')
eq(sanitize({ bunnies: [] }).health, [], 'old data without health → []')

// due counting + ordering
const ds: MyBunnyData = {
  version: 2,
  bunnies: [{ id: 'b1', name: 'Clover', role: 'pet', createdAt: 'x' }],
  reminders: [
    { ...nails, nextDue: '2026-09-10' },
    { ...booster, nextDue: '2026-09-17' },
    { ...oneOff, nextDue: '2026-09-01', lastDone: '2026-09-01' }, // completed one-off: ignored
    { id: 'r4', bunnyId: 'b1', type: 'hay', title: 'Hay restock', intervalDays: 14, nextDue: '2026-09-30' },
  ],
  weights: {},
  health: [],
  prefs: { weightUnit: 'lb' },
}
eq(dueCount(ds, today), { overdue: 1, today: 1, total: 2 }, 'dueCount ignores completed one-offs')
eq(remindersFor(ds, 'b1').map((r) => r.id), ['r1', 'r2', 'r4', 'r3'], 'remindersFor: upcoming by date, completed last')

/* ------------------------------------------------------- count-based title */

eq(collectionTitle(0), 'My Bunny', 'title: none yet → My Bunny')
eq(collectionTitle(1), 'My Bunny', 'title: 1 → My Bunny')
eq(collectionTitle(2), 'My Bunnies', 'title: 2 → My Bunnies')
eq(collectionTitle(3), 'My Fluffle', 'title: 3 → My Fluffle')
eq(collectionTitle(100), 'My Fluffle', 'title: 100 → My Fluffle')

/* ------------------------------------------------ v1 → v2 photo migration */

const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
eq(STORAGE_KEY, 'ohrr.mybunny.v2', 'store key is v2')
eq(LEGACY_STORAGE_KEY, 'ohrr.mybunny.v1', 'legacy key is v1')
const v1blob = {
  version: 1,
  bunnies: [
    { id: 'b1', name: 'Clover', photoDataUrl: PHOTO, sex: 'female', createdAt: 'x' },
    { id: 'b2', name: 'Pip', createdAt: 'y' },
  ],
  reminders: [{ id: 'r1', bunnyId: 'b1', type: 'nails', title: 'Nail trim', intervalDays: 42, nextDue: '2026-10-29' }],
  weights: { b1: [{ date: '2026-09-01', grams: 1900 }] },
  prefs: { weightUnit: 'g' },
}
const v1text = JSON.stringify(v1blob)
const migrated = parseData(v1text)
eq(migrated.version, 2, 'v1 blob loads as v2')
eq(migrated.bunnies.map((b) => b.hasPhoto), [true, undefined], 'v1 photo → hasPhoto flag; none → no flag')
ok(!v1text.includes('hasPhoto'), 'v1 fixture really had no hasPhoto')
ok(!JSON.stringify(migrated).includes('data:image'), 'v2 JSON carries no photo data')
ok(!('photoDataUrl' in migrated.bunnies[0]), 'photoDataUrl is stripped from the record')
eq(extractPhotos(v1blob), { b1: PHOTO }, 'extractPhotos pulls the v1 photo by bunny id (what goes into IndexedDB)')
eq(migrated.bunnies.map((b) => b.role), ['pet', 'pet'], 'v1 bunnies default to role pet')
eq(migrated.reminders.length, 1, 'v1 reminders survive')
eq(migrated.weights.b1?.length, 1, 'v1 weights survive')
eq(migrated.prefs.weightUnit, 'g', 'v1 prefs survive')
eq(sanitize({ bunnies: [{ id: 'b1', name: 'C', hasPhoto: true }] }).bunnies[0].hasPhoto, true, 'v2 hasPhoto flag is kept')
eq(sanitize({ bunnies: [{ id: 'b1', name: 'C', hasPhoto: 'yes' }] }).bunnies[0].hasPhoto, undefined, 'non-boolean hasPhoto dropped')
eq(sanitize({ bunnies: [{ id: 'b1', name: 'C', role: 'resident' }] }).bunnies[0].role, 'resident', 'role kept')
eq(sanitize({ bunnies: [{ id: 'b1', name: 'C', role: 'owner' }] }).bunnies[0].role, 'pet', 'unknown role → pet')

/* ------------------------------------------------------------ archive */

const fluffle: MyBunnyData = {
  version: 2,
  bunnies: [
    { id: 'b1', name: 'Clover', role: 'pet', createdAt: 'x' },
    { id: 'b2', name: 'Pip', role: 'foster', createdAt: 'y' },
    { id: 'b3', name: 'Mochi', role: 'sponsored', createdAt: 'z' },
  ],
  reminders: [
    { id: 'r1', bunnyId: 'b1', type: 'nails', title: 'Nail trim', intervalDays: 42, nextDue: '2026-09-10' },
    { id: 'r2', bunnyId: 'b2', type: 'hay', title: 'Hay restock', intervalDays: 14, nextDue: '2026-09-17' },
    { id: 'r3', bunnyId: 'b3', type: 'vet', title: 'Vet check-up', intervalDays: 365, nextDue: '2026-09-01' },
  ],
  weights: { b2: [{ date: '2026-09-01', grams: 1200 }] },
  health: [{ id: 'h1', bunnyId: 'b2', date: '2026-09-02', noticed: 'Sneezing', resolved: false, createdAt: 'y' }],
  prefs: { weightUnit: 'lb' },
}
eq(dueCount(fluffle, today), { overdue: 2, today: 1, total: 3 }, 'all three count before archiving')
eq(activeBunnies(fluffle).map((b) => b.id), ['b1', 'b2', 'b3'], 'all active before archiving')
eq(collectionTitle(activeBunnies(fluffle).length), 'My Fluffle', 'three active → fluffle')

const arch = applyArchive(fluffle, 'b2', { reason: 'adopted', date: '2026-09-15', note: '  Went home with the Lees  ' })
eq(arch.bunnies[1].archived, { reason: 'adopted', date: '2026-09-15', note: 'Went home with the Lees' }, 'archive stored (note trimmed)')
eq(activeBunnies(arch).map((b) => b.id), ['b1', 'b3'], 'archived bunny leaves the active list')
eq(archivedBunnies(arch).map((b) => b.id), ['b2'], 'archived bunny is in the archived list')
eq(collectionTitle(activeBunnies(arch).length), 'My Bunnies', 'two active → My Bunnies')
eq(dueCount(arch, today), { overdue: 2, today: 0, total: 2 }, 'archived bunny’s due-today reminder is not counted')
eq(dueCount(arch, today, 'b2'), { overdue: 0, today: 0, total: 0 }, 'per-bunny count is zero while archived')
eq(remindersFor(arch, 'b2').length, 1, 'archived bunny keeps its reminders')
eq(nextReminder(arch, 'b2')?.id, 'r2', 'archived bunny’s reminders still readable on its profile')
eq(arch.weights.b2?.length, 1, 'archived bunny keeps its weight log')
eq(arch.health.length, 1, 'archived bunny keeps its health notes')
eq(applyArchive(fluffle, 'b1', { reason: 'whatever' as never, date: 'bad' }).bunnies[0].archived?.reason, 'other', 'bad reason → other')
ok(isIsoDate(applyArchive(fluffle, 'b1', { reason: 'passed', date: 'bad' }).bunnies[0].archived?.date), 'bad date → a real date (today)')
const restored = applyRestore(arch, 'b2')
eq(restored.bunnies[1].archived, undefined, 'restore clears the archive')
eq(activeBunnies(restored).length, 3, 'restore puts the bunny back in the active list')
eq(dueCount(restored, today).total, 3, 'restore counts the reminders again')
// sanitize round-trips the archive and drops a malformed one
eq(sanitize(JSON.parse(JSON.stringify(arch))).bunnies[1].archived, arch.bunnies[1].archived, 'archive survives sanitize')
eq(sanitize({ bunnies: [{ id: 'b1', name: 'C', archived: { reason: 'adopted', date: 'nope' } }] }).bunnies[0].archived, undefined, 'archive without a valid date is dropped')
// mergeData keeps archived bunnies from a backup
const mergedArch = mergeData(current, arch)
eq(mergedArch.data.bunnies.find((b) => b.id === 'b2')?.archived?.reason, 'adopted', 'merge preserves an archived bunny')
eq(mergedArch.result.bunnies, 2, 'merge added the two new bunnies (one archived)')

/* --------------------------------------------- backup round-trip (photos) */

const withPhoto: MyBunnyData = {
  ...arch,
  bunnies: arch.bunnies.map((b) => (b.id === 'b1' ? { ...b, hasPhoto: true } : b)),
}
const backupText = buildBackup(withPhoto, { b1: PHOTO })
const backupRaw = JSON.parse(backupText)
eq(backupRaw.app, 'ohrr-app/my-bunny', 'backup is tagged')
eq(backupRaw.version, 2, 'backup is v2')
eq(backupRaw.bunnies[0].photoDataUrl, PHOTO, 'backup embeds the photo as a data URL')
eq(backupRaw.bunnies[1].photoDataUrl, undefined, 'bunnies without a photo have none embedded')
eq(backupRaw.bunnies[1].archived.reason, 'adopted', 'backup includes the archived bunny')
const rt = parseBackup(backupText)
eq(rt.photos, { b1: PHOTO }, 'import recovers the photo (for IndexedDB)')
eq(rt.data.bunnies, withPhoto.bunnies, 'import recovers every bunny record, hasPhoto flag and archive intact')
eq(rt.data.reminders, withPhoto.reminders, 'import recovers reminders')
eq(rt.data.weights, withPhoto.weights, 'import recovers weights')
eq(rt.data.health, withPhoto.health, 'import recovers health notes')
ok(!JSON.stringify(rt.data).includes('data:image'), 'imported metadata carries no photo bytes')
let threw = false
try {
  parseBackup('{"nope":true}')
} catch {
  threw = true
}
ok(threw, 'parseBackup rejects a non-backup file')

/* ------------------------------------------ live store: limit + archive */

eq(MAX_BUNNIES, 100, 'MAX_BUNNIES is 100')
eq(getMyBunny().bunnies.length, 0, 'store starts empty under node (no localStorage)')
const made: Bunny[] = []
for (let i = 0; i < MAX_BUNNIES; i += 1) made.push(addBunny({ name: `Bun ${i + 1}`, role: i % 2 ? 'foster' : 'pet' }))
eq(getMyBunny().bunnies.length, MAX_BUNNIES, 'can add exactly MAX_BUNNIES')
ok(atBunnyLimit(getMyBunny()), 'atBunnyLimit at MAX_BUNNIES')
let limitErr = ''
try {
  addBunny({ name: 'One too many', role: 'pet' })
} catch (e) {
  limitErr = e instanceof Error ? e.message : String(e)
}
eq(limitErr, LIMIT_MESSAGE, 'the 101st add is refused with the friendly message')
eq(getMyBunny().bunnies.length, MAX_BUNNIES, 'nothing was added past the limit')
archiveBunny(made[0].id, { reason: 'rehomed', date: today })
ok(!atBunnyLimit(getMyBunny()), 'archiving one frees a slot (archived bunnies don’t count)')
eq(activeBunnies(getMyBunny()).length, MAX_BUNNIES - 1, 'active count drops after archive')
eq(archivedBunnies(getMyBunny()).length, 1, 'archived count rises after archive')
const extra = addBunny({ name: 'Newcomer', role: 'resident' })
eq(getMyBunny().bunnies.length, MAX_BUNNIES + 1, 'a new bunny can be added once one is archived')
let restoreErr = ''
try {
  restoreBunny(made[0].id)
} catch (e) {
  restoreErr = e instanceof Error ? e.message : String(e)
}
eq(restoreErr, LIMIT_MESSAGE, 'restoring past the limit is refused with the same message')
ok(Boolean(getMyBunny().bunnies.find((b) => b.id === made[0].id)?.archived), 'refused restore leaves the bunny archived')
eq(getMyBunny().bunnies.find((b) => b.id === extra.id)?.role, 'resident', 'role is stored as given')

console.log(`OK — ${checks} checks passed`)
