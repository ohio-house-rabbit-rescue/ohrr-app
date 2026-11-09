// The printed handout: the Welcome, Getting started, the money parts, every level as a checklist, and the flow
// charts, all made from the same content as the on-screen guide so the two never drift. Unlisted and not
// indexed, outside the app's frame so a print or a PDF shows only the handout. `?part=welcome` prints just the
// first pages. Identical in the app and the website.
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GUIDE_ROUTES, WELCOME_PHOTO } from './guideEnv'
import { FlowChart } from './FlowChart'
import GuideQr from './GuideQr'
import { APP_ADDRESS, FLOWS, INSTALL_POINTS, INSTALL_TITLE, LEVELS, MONEY_POINTS, PROGRAM_NAME, PROMISES, START, STUCK_TEXT, WINS, fill, type GuideLevel, type GuideStep } from './walkthrough'

const H2 = 'font-display text-2xl font-black text-ink break-after-avoid'

function PrintStep({ n, step }: { n: number; step: GuideStep }) {
  const route = step.go ? GUIDE_ROUTES[step.go.route] : null
  const vars = { title: route?.title ?? '' }
  const phoneOnly = Boolean(route?.match.startsWith('!'))
  return (
    <li className="break-inside-avoid border-b border-slate-200 py-3">
      <div className="flex gap-3">
        <span className="mt-1 h-5 w-5 shrink-0 rounded border-2 border-slate-500" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-base font-bold leading-snug text-ink">
            {n}. {step.practice ? fill(step.do, vars).replace(/\bbelow\b/, 'in the guide on your phone') : fill(step.do, vars)}
          </p>
          {step.practice && <p className="text-sm italic text-slate-600">Do this on the practice screen in the guide. It is pretend and saves nothing.</p>}
          {route && (
            <p className="text-sm text-slate-600">
              Where: {route.title}
              {route.external ? ` (${route.to})` : ''}
              {phoneOnly ? ' — on the phone app only, so skip it here.' : ''}
            </p>
          )}
          <p className="text-sm leading-relaxed text-slate-700">
            <span className="font-bold">You should see:</span> {fill(step.see, vars)}
          </p>
        </div>
      </div>
    </li>
  )
}

function PrintLevel({ level }: { level: GuideLevel }) {
  return (
    <section className="space-y-2 pt-6">
      <h2 className={H2}>
        Level {level.n}: {level.title}
        {level.money ? ' (money)' : ''}
      </h2>
      <p className="text-base leading-relaxed text-slate-600 break-after-avoid">
        {level.goal} About {level.minutes} minutes.
      </p>
      <ol className="list-none p-0">
        {level.steps.map((s, i) => (
          <PrintStep key={s.key} n={i + 1} step={s} />
        ))}
      </ol>
    </section>
  )
}

export default function GuidePrint() {
  const [params] = useSearchParams()
  const welcomeOnly = params.get('part') === 'welcome'

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    const before = document.title
    document.title = `${PROGRAM_NAME} · ${welcomeOnly ? 'Welcome' : 'Guide'} · OHRR`
    return () => {
      meta.remove()
      document.title = before
    }
  }, [welcomeOnly])

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white px-6 py-6 text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">This page is made to be printed. Use Print, then choose “Save as PDF” if you want a file.</p>
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-[44px] items-center rounded-full bg-brand-blue px-5 text-sm font-bold text-white">
          Print
        </button>
      </div>

      <img src={WELCOME_PHOTO} alt="A rescued rabbit at Ohio House Rabbit Rescue" className="h-56 w-full rounded-3xl object-cover" />
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-black leading-tight text-ink">{PROGRAM_NAME}</h1>
        <p className="text-lg leading-relaxed text-slate-600">
          A friendly, step-by-step walk through the OHRR staff app. Short levels, five to fifteen minutes each, at your own pace, and you can start the moment you’re on the team.
        </p>
      </div>

      <section className="space-y-2 break-inside-avoid rounded-2xl border-2 border-slate-300 px-4 py-3">
        <h2 className={H2}>How to use this paper</h2>
        <ul className="list-disc space-y-1 pl-6 text-base leading-relaxed text-slate-700">
          <li>This paper is the same as the guide inside the app. Follow along in the app on your phone: each step there has a button that takes you to the right page, and the practice screens only exist there.</li>
          <li>To find the guide, open the app, sign in, and on the Staff home screen tap Start here.</li>
          <li>Use the boxes on this paper to keep your place. The app also remembers which steps you checked.</li>
          <li>If a step says to look, only look: it changes nothing. A step that asks you to type or tap something says so, and says what you should see.</li>
          <li>If a step says to ask a team lead, ask the person who invited you, or anyone on the OHRR team who has used the app longer.</li>
        </ul>
      </section>

      <section className="flex items-start gap-4 break-inside-avoid rounded-2xl border-2 border-slate-300 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className={H2}>{INSTALL_TITLE}</h2>
          <p className="text-lg font-bold text-ink">The app’s address: {APP_ADDRESS}</p>
          <ul className="list-disc space-y-1 pl-6 text-base leading-relaxed text-slate-700">
            {INSTALL_POINTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="w-36 shrink-0 text-center">
          <GuideQr value={`https://${APP_ADDRESS}/welcome`} size={120} alt={`QR code for the ${PROGRAM_NAME} welcome page`} />
          <p className="mt-1 text-xs text-slate-600">Point a phone camera here to open the welcome page.</p>
        </div>
      </section>

      <section className="space-y-2 break-inside-avoid">
        <h2 className={H2}>What’s in it for you</h2>
        <ul className="list-disc space-y-1 pl-6 text-base leading-relaxed text-slate-700">
          {WINS.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 break-inside-avoid">
        <h2 className={H2}>Three promises</h2>
        <ol className="list-none space-y-2 p-0">
          {PROMISES.map((p, i) => (
            <li key={p.title}>
              <p className="font-display text-lg font-extrabold text-ink">
                {i + 1}. {p.title}
              </p>
              <p className="text-base leading-relaxed text-slate-600">{p.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2 break-inside-avoid">
        <h2 className={H2}>About the money parts</h2>
        <p className="text-base leading-relaxed text-slate-600">Lots of people feel nervous here, so in plain words, and they come late in the guide:</p>
        <ul className="list-disc space-y-2 pl-6 text-base leading-relaxed text-slate-700">
          {MONEY_POINTS.map((p) => (
            <li key={p.title}>
              <span className="font-bold text-ink">{p.title}.</span> {p.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className={H2}>Getting started</h2>
        <ol className="list-none space-y-2 p-0">
          {START.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-base leading-relaxed text-slate-700">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-500 font-black">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <FlowChart flow={FLOWS[0]} links={false} />
      </section>

      {!welcomeOnly && (
        <>
          <section className="space-y-2 print:break-before-page">
            <h2 className={H2}>All the levels</h2>
            <p className="text-base leading-relaxed text-slate-600">
              Check each box when you’ve done the step. Every step says what you should see when it worked. If a page isn’t on your menu, skip that step and come back to it later.
            </p>
          </section>
          {LEVELS.filter((l) => !l.soon).map((level) => (
            <PrintLevel key={level.key} level={level} />
          ))}

          <section className="space-y-4 print:break-before-page">
            <h2 className={H2}>Flow charts</h2>
            <p className="text-base leading-relaxed text-slate-600">The big picture of each job. Boxes marked “Money” are the ones that touch money.</p>
            {FLOWS.slice(1).map((flow) => (
              <div key={flow.key} className="space-y-2 break-inside-avoid">
                <h3 className="font-display text-xl font-black text-ink break-after-avoid">{flow.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{flow.intro}</p>
                <FlowChart flow={flow} links={false} />
              </div>
            ))}
          </section>

          <section className="space-y-2 break-inside-avoid">
            <h2 className={H2}>Stuck?</h2>
            <p className="text-base leading-relaxed text-slate-600">{STUCK_TEXT}</p>
          </section>
        </>
      )}
    </div>
  )
}
