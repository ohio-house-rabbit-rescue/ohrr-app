// The Welcome page, before anyone signs in (unlisted, not indexed): what the guided start is, what's in it for
// you, and how to begin. It is the pitch for staff who have the app and may not be sure about it. Identical in
// the app and the website.
import { useEffect } from 'react'
import { Card } from '../../components/ui'
import { JOIN, SIGN_IN, WELCOME_PHOTO } from './guideEnv'
import { MONEY_POINTS, PROGRAM_NAME } from './walkthrough'
import { GuidePage, ORANGE_BTN, OUTLINE_BTN } from './guideUi'

function Go({ to, className, children }: { to: { href: string; external: boolean }; className: string; children: React.ReactNode }) {
  // A plain link works in both places, and the website's join page lives on the app.
  return (
    <a href={to.href} className={className} {...(to.external ? { rel: 'noopener' } : {})}>
      {children}
    </a>
  )
}

const WINS = [
  'See your own name, your level and exactly what you can do, in about five minutes.',
  'Watch a notice travel from a form to everyone’s phone, without posting a thing.',
  'Learn where new sign-ups and messages land, so nothing gets missed.',
  'Every level ends with a “you did it,” and there are more to come.',
]

const PROMISES = [
  { title: 'Practice means practice', text: 'Anything that sells, charges a card or that the public can see happens on a pretend screen that says so at the top and saves nothing.' },
  { title: 'Go at your pace', text: 'Stop any time. Your ticks are saved to your account and you pick up where you left off, on any phone or computer.' },
  { title: 'Stuck is fine', text: 'Every level has an “Email for help” link. Nobody is checking your progress.' },
]

const START = [
  'Open the invitation you were sent, by email or QR code.',
  'Create your sign-in, or sign in if you already have an OHRR account.',
  'On the Staff home screen, tap Start here.',
]

export default function Welcome() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    const before = document.title
    document.title = `${PROGRAM_NAME} · OHRR`
    return () => {
      meta.remove()
      document.title = before
    }
  }, [])

  return (
    <GuidePage outside>
      <img src={WELCOME_PHOTO} alt="A rescued rabbit at Ohio House Rabbit Rescue" className="h-56 w-full rounded-3xl object-cover" />
      <div className="space-y-2 px-1">
        <h1 className="font-display text-3xl font-black leading-tight text-ink">{PROGRAM_NAME}</h1>
        <p className="text-lg leading-relaxed text-slate-600">
          A friendly, step-by-step walk through the OHRR staff app. Short levels, about five minutes each, at your own pace, and you can start the moment you’re on the team.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Go to={JOIN} className={ORANGE_BTN}>
          I have my invitation
        </Go>
        <Go to={SIGN_IN} className={OUTLINE_BTN}>
          I already have an account
        </Go>
      </div>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-black text-ink">What’s in it for you</h2>
        <ul className="space-y-2">
          {WINS.map((w) => (
            <li key={w} className="flex gap-2 text-base leading-relaxed text-slate-700">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-orange" aria-hidden="true" />
              {w}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-black text-ink">Three promises</h2>
        <ol className="space-y-3">
          {PROMISES.map((p, i) => (
            <li key={p.title}>
              <p className="font-display text-lg font-extrabold text-ink">
                {i + 1}. {p.title}
              </p>
              <p className="text-base leading-relaxed text-slate-600">{p.text}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="space-y-3 border-brand-blue/20 bg-brand-blue-50/50">
        <h2 className="font-display text-xl font-black text-ink">About the money parts</h2>
        <p className="text-base leading-relaxed text-slate-600">Lots of people feel nervous here, so in plain words, and they come late in the guide:</p>
        <ul className="space-y-2">
          {MONEY_POINTS.map((p) => (
            <li key={p.title} className="text-base leading-relaxed text-slate-700">
              <span className="font-bold text-ink">{p.title}.</span> {p.text}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-black text-ink">Getting started</h2>
        <ol className="space-y-3">
          {START.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-base leading-relaxed text-slate-700">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 font-black text-brand-blue-dark" aria-hidden="true">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <Go to={JOIN} className={ORANGE_BTN}>
          I have my invitation
        </Go>
      </Card>
    </GuidePage>
  )
}
