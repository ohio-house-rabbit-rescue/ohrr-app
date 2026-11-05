// The guided start: a self-guided trail for staff who are new to the app (OHRR, 2026-11-04).
// John will not be in the room, so the pages teach, encourage and sell on their own: short levels,
// a "you should see" line on every step, a tick box, a Done screen. Money comes late.
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
  | 'money'
  | 'sell'
  | 'sell-today'
  | 'events'
  | 'bunfest-content'
  | 'bunny-registrations'
  | 'raffle'
  | 'public-events'
  | 'public-shop'
  | 'other-site'

/** A pretend screen that saves nothing (practice.tsx). */
export type PracticeKey = 'hours' | 'announcement' | 'receive' | 'scan' | 'sell-basket' | 'sell-pay' | 'raffle'

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
    money: true,
    steps: [
      {
        key: 'money',
        do: 'Read “{title}” first. It is short.',
        see: 'A page titled “{title}” that says in plain words what the app does with money, and what it does not do.',
        go: { route: 'money', label: 'Open {title}' },
      },
      {
        key: 'practice-basket',
        do: 'Practice filling a basket below. Tap the items a pretend customer is buying, and use the plus and minus buttons.',
        see: 'Each item you tap is added to the basket with its price, and the big button at the bottom shows the total, like “Take payment · $11.50.” Nothing here is saved, and the items and prices are pretend.',
        practice: 'sell-basket',
      },
      {
        key: 'practice-pay',
        do: 'Practice taking payment below. Pretend the customer paid cash and handed you $20.00: type 20 in the box, then tap Paid cash. Or tap Paid by card.',
        see: 'For cash, the change shows as you type. Then a green check and “Sale recorded.” In the real app a sale is recorded the moment you tap Paid by card or Paid cash, and the shop’s stock goes down, so you tap only after the cash box or card reader has already taken the money. If you ever tap Paid by mistake, tell a team lead. Nothing here is saved.',
        practice: 'sell-pay',
      },
      {
        key: 'sell',
        do: 'Open {title} on the phone app and look around. “Ring up a sale” opens the real basket, and nothing is recorded until you tap Paid by card or Paid cash, so you can look and go back.',
        see: 'A page titled “{title}” with big buttons, and a switch that says what this phone is for today: The Hop Shop or BunFest. The first time, it asks you to name this phone, for example Hop Shop till. Type a name and tap Save, or leave it for later.',
        go: { route: 'sell', label: 'Open {title}' },
      },
      {
        key: 'today',
        do: 'Open {title} and look at the totals.',
        see: 'A page titled “{title}” with Cash, Card, Sales and Total, then a list of what sold. If you are not allowed to see totals it says so, and that is fine.',
        go: { route: 'sell-today', label: 'Open {title}' },
      },
    ],
  },
  {
    key: 'bunfest',
    n: 8,
    title: 'BunFest season',
    goal: 'See how BunFest runs from the app: the program, the bunnies, the raffle table and the door.',
    minutes: 10,
    money: true,
    steps: [
      {
        key: 'events',
        do: 'Open {title} and look at the list. Leave “New event” alone for now: an event can show on the public pages as soon as it is saved.',
        see: 'A page titled “{title}” listing OHRR’s events.',
        go: { route: 'events', label: 'Open {title}' },
      },
      {
        key: 'content',
        do: 'Open {title} and read the top of the page. Look around, but change nothing.',
        see: 'A page titled “{title}” that describes what visitors see in the app and on the website: the program, the vendors and the rescues.',
        go: { route: 'bunfest-content', label: 'Open {title}' },
      },
      {
        key: 'bunnies',
        do: 'Open {title} and look at the list. Leave “Proof checked at the door” for the day of the event.',
        see: 'A page titled “{title}” with the bunnies people registered. On the day, you look at the vaccine proof, tap “Proof checked at the door,” and the bunny shows “Proof checked.” The list has owners’ names and contact details, so it is for the team only.',
        go: { route: 'bunny-registrations', label: 'Open {title}' },
      },
      {
        key: 'practice-raffle',
        do: 'Practice selling raffle tickets at the table below. Choose how many, then tap Sell.',
        see: 'A green card with the ticket numbers, like A-0101 – A-0103, and the words “Write these on the stubs, or hand them the numbers.” In the real app the tickets are recorded as paid the moment you tap Sell, so you tap only after the cash is in your hand. If you ever tap Sell by mistake, tell a team lead. The price and the numbers here are pretend, and nothing is saved.',
        practice: 'raffle',
      },
      {
        key: 'raffle',
        do: 'Open {title} and look. You are only looking: leave selling, “Mark paid,” “Void” and drawing winners alone today.',
        see: 'A page titled “{title}” with a place to “Sell at the table” and a count of the reservations still “to pay.” Drawing the winners belongs to a BunFest manager.',
        go: { route: 'raffle', label: 'Open {title}' },
      },
      {
        key: 'door',
        do: 'On the phone app, open {title}, then tap “BunFest” under “This phone is for.” Look, then tap “The Hop Shop” to put it back. Do not open Door tickets today.',
        see: 'Three big buttons: “Door tickets,” “Ring up a sale” and “Raffle tickets.” Door tickets is where receipts are checked and tickets are sold at the door. That is for the day of the event.',
        go: { route: 'sell', label: 'Open {title}' },
      },
    ],
  },
  {
    key: 'website',
    n: 9,
    title: 'The new website',
    goal: 'See the public pages, and see that the app and the website show the same rabbits.',
    minutes: 5,
    steps: [
      {
        key: 'events',
        do: 'Open {title}, the page a visitor sees.',
        see: 'A page titled “{title}” with OHRR’s events. They come from the Events list you saw in Level 8, so a change made there shows up here.',
        go: { route: 'public-events', label: 'Open {title}' },
      },
      {
        key: 'shop',
        do: 'Open {title}, the page a visitor sees.',
        see: 'A page titled “{title}” about the shop at the Adoption Center. This is how the public sees the shop you looked around in Level 6.',
        go: { route: 'public-shop', label: 'Open {title}' },
      },
      {
        key: 'other',
        do: 'Open {title} in a new tab and find a rabbit you saw on the staff list that is not marked Hidden.',
        see: 'The same rabbit, with the same name and photos. The app and the website read one shared list, so a change in one shows up in the other.',
        go: { route: 'other-site', label: 'Open {title}' },
      },
    ],
  },
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
    text: 'Selling in the app, at the Hop Shop or at the BunFest door and raffle table, writes down a sale after you have taken the money with the cash box or the card reader, exactly as you do today. The app never takes a payment itself.',
  },
  {
    title: 'Charging a card',
    text: 'Two features can charge a card: the online auction and online bidding at BunFest. Both are switched off right now, and each is switched on deliberately, by someone with permission. Nothing in this guide switches either one on, and the practice screens never touch a card.',
  },
] as const

/** May this person open the page a step points at? `openable` is null while the menu is still loading (then: yes). An empty `match` is a public page: always. A `match` starting with “!” is a page this site does not have (Sell is on the phone app): never. */
export const canOpen = (openable: readonly string[] | null, match: string) => !match.startsWith('!') && (!match || openable === null || openable.some((p) => p === match || p.split('?')[0] === match))

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

