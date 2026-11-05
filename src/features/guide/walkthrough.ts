// The guided start: a self-guided trail for staff who are new to the app (OHRR, 2026-11-04).
// John will not be in the room, so the pages teach, encourage and sell on their own: short levels,
// a "you should see" line on every step, a tick box, a Done screen. Money comes last.
//
// ONE content file for the app and the website — keep the two copies identical. A step names a page by
// a route key (`go`); each repo maps keys to its own paths and page titles in guideEnv.ts. `{title}` in a
// step's text becomes that page's real title in the repo showing it.
//
// Every "see" line quotes words that are really on the screen. When a screen changes, change its line here.

export const PROGRAM_NAME = 'Hop Into the App'

/** The Staff → Features switch (an app_settings row, {"enabled": boolean}). */
export const GUIDE_FLAG = 'walkthrough_enabled'

export type RouteKey =
  | 'account'
  | 'my-hours'
  | 'announcements'
  | 'post-queue'
  | 'inbox'
  | 'bookings'
  | 'calls'
  | 'rabbits'
  | 'adopt-page'
  | 'tails'
  | 'scan'
  | 'items'
  | 'hopshop'
  | 'shelf'
  | 'reorder'
  | 'deliveries'

/** A pretend screen that saves nothing (practice.tsx). */
export type PracticeKey = 'hours' | 'announcement' | 'receive' | 'scan'

export interface GuideStep {
  key: string
  /** What to do, in one or two short sentences. */
  do: string
  /** What you should see when it worked. */
  see: string
  go?: { route: RouteKey; label: string }
  practice?: PracticeKey
}

export interface GuideLevel {
  key: string
  n: number
  title: string
  /** One line: what you get out of it. */
  goal: string
  minutes: number
  /** Not written yet: shown on the Trail as "coming next". */
  soon?: boolean
  /** Touches money: shown with a plain note, and opened only when you are ready. */
  money?: boolean
  steps: GuideStep[]
}

export const LEVELS: GuideLevel[] = [
  {
    key: 'mine',
    n: 1,
    title: 'Make it yours',
    goal: 'See your name, your level and exactly what you can do.',
    minutes: 5,
    steps: [
      {
        key: 'open',
        do: 'Open {title}.',
        see: 'A page titled “{title}” with your name at the top.',
        go: { route: 'account', label: 'Open {title}' },
      },
      {
        key: 'access',
        do: 'Scroll down to “Your level and access.”',
        see: 'Your level, and the list of what you can do. Anything not on that list is hidden from you, so there is nothing to click by mistake.',
        go: { route: 'account', label: 'Open {title}' },
      },
      {
        key: 'name',
        do: 'Under “How you appear,” check your Name and Title. Fix them if you like, then tap Save. If they already look right, there is nothing to do.',
        see: 'After Save, a note that starts with “Saved.” Leave “Show me on the About page” alone unless you want to be on the public About page.',
        go: { route: 'account', label: 'Open {title}' },
      },
      {
        key: 'hours',
        do: 'Try logging volunteer hours on the practice screen below. Nothing there is saved.',
        see: 'A green line saying your practice hours were logged. On the real page you tap Log hours to open the form, then Log it to save.',
        practice: 'hours',
        go: { route: 'my-hours', label: 'Open My volunteer hours (the real one)' },
      },
    ],
  },
  {
    key: 'appear',
    n: 2,
    title: 'Make something appear',
    goal: 'See how a notice reaches everyone’s phone, without posting anything real.',
    minutes: 5,
    steps: [
      {
        key: 'practice',
        do: 'Practice posting a notice below. Type a title and a message, then tap Post announcement.',
        see: 'Your notice shows at the top of the pretend phone screen. In the real app it shows on the home screen right away. Nothing here is saved.',
        practice: 'announcement',
      },
      {
        key: 'look',
        do: 'Open {title} and just look. Do not post anything yet.',
        see: 'A page titled “{title}.” A notice saved as a draft stays hidden until someone publishes it.',
        go: { route: 'announcements', label: 'Open {title}' },
      },
      {
        key: 'queue',
        do: 'Open {title} and look at the list.',
        see: 'A page titled “{title}” with the posts in a list.',
        go: { route: 'post-queue', label: 'Open {title}' },
      },
    ],
  },
  {
    key: 'daily',
    n: 3,
    title: 'The daily check',
    goal: 'Know where new sign-ups and messages show up.',
    minutes: 5,
    steps: [
      {
        key: 'inbox',
        do: 'Open {title}.',
        see: 'A page titled “{title}” with the requests and sign-ups people sent from the app and the website. On the staff home screen, an orange number on Inbox means something is new.',
        go: { route: 'inbox', label: 'Open {title}' },
      },
      {
        key: 'bookings',
        do: 'Open {title} and look at what is waiting. You are only looking, so nothing changes.',
        see: 'A page titled “{title}.”',
        go: { route: 'bookings', label: 'Open {title}' },
      },
      {
        key: 'calls',
        do: 'Open {title} and look. Do not send anything.',
        see: 'A page titled “{title}.”',
        go: { route: 'calls', label: 'Open {title}' },
      },
    ],
  },
  {
    key: 'rabbits',
    n: 4,
    title: 'Our rabbits',
    goal: 'See your own rabbits the way the public sees them.',
    minutes: 5,
    steps: [
      {
        key: 'staff',
        do: 'Open {title} and find a rabbit you know. You are only looking: Hide, Remove and the Mark buttons change what the public sees right away, so leave them alone for now.',
        see: 'A page titled “{title}” with a card for each rabbit: a photo, the name, and a status label. A rabbit hidden from the public has a label that starts with “Hidden.”',
        go: { route: 'rabbits', label: 'Open {title}' },
      },
      {
        key: 'public',
        do: 'Open {title} and find the same rabbit, the way an adopter would.',
        see: 'A page titled “{title}” listing the rabbits that are not hidden. A rabbit marked Hidden on the staff page is not listed here.',
        go: { route: 'adopt-page', label: 'Open {title}' },
      },
      {
        key: 'tails',
        do: 'Open {title} and read one story.',
        see: 'A page titled “{title}” with the adoption stories people sent in. Most arrive through the Inbox.',
        go: { route: 'tails', label: 'Open {title}' },
      },
    ],
  },
  {
    key: 'receive',
    n: 5,
    title: 'Receive and scan',
    goal: 'See how a donation becomes an item with its own code that anyone can scan.',
    minutes: 5,
    steps: [
      {
        key: 'practice-receive',
        do: 'Practice receiving a donated item below. Type what it is, then tap Save.',
        see: 'A pretend label with a number that starts DON-. In the real app you take a photo first, and the next free number is made for you. Nothing here is saved.',
        practice: 'receive',
      },
      {
        key: 'practice-scan',
        do: 'Practice scanning that label below. Tap Scan the label.',
        see: 'A “Found it” card with the item’s name. A real label works the same way: scan it, and the item comes up. Nothing here is saved.',
        practice: 'scan',
      },
      {
        key: 'scan',
        do: 'Open {title} and look. You do not need to scan anything today.',
        see: 'A page titled “{title}” with a place to scan a label or type its code. If your phone asks to use the camera, that is normal; you can type the code instead.',
        go: { route: 'scan', label: 'Open {title}' },
      },
      {
        key: 'items',
        do: 'Open {title} and read the top of the page.',
        see: 'A page titled “{title}” that explains what lives here: donations, auction lots and raffle prizes, everything with an OHRR code.',
        go: { route: 'items', label: 'Open {title}' },
      },
    ],
  },
  {
    key: 'shop',
    n: 6,
    title: 'Hop Shop: look around',
    goal: 'See stock, prices and deliveries. Numbers only, nothing sold.',
    minutes: 5,
    steps: [
      {
        key: 'open',
        do: 'Open {title} and read the top of the page. If you see a Sell button, leave it for Level 7.',
        see: 'A page titled “{title}.” Stock, prices and photos here go live on the public Hop Shop as soon as they are saved, which is why today is for looking only.',
        go: { route: 'hopshop', label: 'Open {title}' },
      },
      {
        key: 'shelf',
        do: 'Open the list of what the shop carries and use the search box to find one item. Do not tap Edit, Delete or the stock buttons.',
        see: 'Each item shows its name, its SKU code, its price on the right, and a Stock line. The search box finds items by name or SKU.',
        go: { route: 'shelf', label: 'Open the shop’s item list' },
      },
      {
        key: 'reorder',
        do: 'Open the reorder list and look. You are only reading it.',
        see: 'The items that are at or below their reorder point, or the words “Nothing to reorder.” when none are.',
        go: { route: 'reorder', label: 'Open the reorder list' },
      },
      {
        key: 'deliveries',
        do: 'Open {title} and read down the list. You do not need to open a delivery today.',
        see: 'A page titled “{title}” listing every invoice added to stock, with what it cost and what the shipping was.',
        go: { route: 'deliveries', label: 'Open {title}' },
      },
    ],
  },
  {
    key: 'sell',
    n: 7,
    title: 'Practice selling',
    goal: 'Ring up a pretend sale. The cash box and card reader work exactly as they do now.',
    minutes: 10,
    soon: true,
    money: true,
    steps: [],
  },
  { key: 'bunfest', n: 8, title: 'BunFest season', goal: 'Run the big event from the app.', minutes: 10, soon: true, steps: [] },
  { key: 'website', n: 9, title: 'The new website', goal: 'The finale: the website opens to the public.', minutes: 5, soon: true, steps: [] },
]

/** The id progress is saved under. */
export const stepId = (level: GuideLevel, step: GuideStep) => `${level.key}.${step.key}`

/** The marker saved when someone taps "Hide this". */
export const HIDDEN_ID = '_hidden'

export const levelIds = (level: GuideLevel) => level.steps.map((s) => stepId(level, s))

/** Fill {title} (and any other {word}) in a step's text. */
export const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)

/** A plain-language note about money, shown on the Welcome page and above the money levels. */
export const MONEY_POINTS = [
  {
    title: 'Looking at numbers',
    text: 'Prices, stock and totals. You only read them. Nothing can change.',
  },
  {
    title: 'Writing down a sale',
    text: 'Selling in the app only records a sale after the cash box or the card reader has handled the money, exactly as you do today. The app never takes a payment itself.',
  },
  {
    title: 'Charging a card',
    text: 'Two features can charge a card: the online auction and online bidding at BunFest. Both are switched off right now, and each is switched on deliberately, by someone with permission. Nothing in this guide switches either one on, and the practice screens never touch a card.',
  },
] as const

/** May this person open the page a step points at? `openable` is null while the menu is still loading (then: yes). An empty `match` is a public page: always. */
export const canOpen = (openable: readonly string[] | null, match: string) => !match || openable === null || openable.some((p) => p === match || p.split('?')[0] === match)

/** The steps of a level this person can actually do: practice steps always, "open a page" steps only if the page is on their menu. */
export function stepsFor(level: GuideLevel, openable: readonly string[] | null, matchOf: (route: RouteKey) => string): GuideStep[] {
  return level.steps.filter((s) => s.practice || !s.go || canOpen(openable, matchOf(s.go.route)))
}

export interface LevelStatus {
  total: number
  done: number
  complete: boolean
}

export function levelStatus(level: GuideLevel, done: ReadonlySet<string>, openable: readonly string[] | null, matchOf: (route: RouteKey) => string): LevelStatus {
  const steps = stepsFor(level, openable, matchOf)
  const n = steps.filter((s) => done.has(stepId(level, s))).length
  return { total: steps.length, done: n, complete: steps.length > 0 && n === steps.length }
}

/** The address the "Stuck?" box writes to. One line to change. */
export const HELP_EMAIL = 'ohrrcontact@ohiohouserabbitrescue.org'
