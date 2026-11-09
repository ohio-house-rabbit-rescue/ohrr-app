// One level: its steps, a check box (or "skip for now") for each, and the Done screen. Identical in the app and the website.
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { StaffTitle } from '../../components/StaffTitle'
import { DONE_PHOTOS, GUIDE_ROUTES, LEVEL_PATH, MONEY_PATH, NEXT_PATH, PHONE_APP_URL, TRAIL_PATH } from './guideEnv'
import { useOpenablePaths } from './guideTiles'
import { rememberReturn } from './guideReturn'
import { useGuideProgress } from './useGuide'
import { LEVELS, STUCK_TEXT, canOpen, fill, levelAfter, levelStatus, stepId, skipId, type GuideLevel as Level } from './walkthrough'
import { GuideGate, matchOf } from './GuideTrail'
import { PracticeScreen } from './Practice'
import { BLUE_BTN, GuidePage, InstallCard, ORANGE_BTN, OUTLINE_BTN, ProgressBar } from './guideUi'

export default function GuideLevelPage() {
  const { level: key } = useParams()
  const level = LEVELS.find((l) => l.key === key)
  return (
    <GuideGate>
      {level && !level.soon ? (
        <LevelBody level={level} />
      ) : (
        <GuidePage>
          <StaffTitle title="That level isn’t written yet" />
          <Link to={TRAIL_PATH} className={BLUE_BTN}>
            Back to all levels
          </Link>
        </GuidePage>
      )}
    </GuideGate>
  )
}

function LevelBody({ level }: { level: Level }) {
  const progress = useGuideProgress()
  const openable = useOpenablePaths()
  const st = levelStatus(level, progress.done, openable, matchOf)
  const next = levelAfter(level, openable, matchOf)
  const photo = DONE_PHOTOS[(level.n - 1) % DONE_PHOTOS.length]
  let shown = 0
  // A page (address) already linked by an earlier step in this level is not linked again.
  const linked = new Set<string>()
  const here = { to: LEVEL_PATH(level.key), label: `Level ${level.n}: ${level.title}` }

  // The way on, always there: to the next level that has something for this person, or to "What next?".
  const nextLink = (cls: string, text: string) =>
    next ? (
      <Link to={LEVEL_PATH(next.key)} className={cls}>
        {text}
      </Link>
    ) : (
      <Link to={NEXT_PATH} className={cls}>
        What next?
      </Link>
    )

  return (
    <GuidePage>
      <Link to={TRAIL_PATH} className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
        <Icon name="arrowLeft" size={18} /> All levels
      </Link>
      <StaffTitle title={`Level ${level.n}: ${level.title}`}>
        <p>
          {level.goal} About {level.minutes} minutes. Check each step when you’ve done it, or skip it for now; your choices are saved.
        </p>
      </StaffTitle>
      {level.key === 'mine' && <InstallCard />}
      {!st.na && <ProgressBar done={st.done} total={st.total} label={`Level ${level.n} steps done`} />}

      {st.na && (
        <Card className="space-y-3 border-dashed bg-slate-50/70">
          <p className="font-display text-lg font-extrabold text-ink">This level isn’t part of your job</p>
          <p className="text-base leading-relaxed text-slate-600">
            Everything in it opens pages that aren’t on your menu, so there is nothing for you to do here. If you’d like those pages, ask a team lead to switch them on for you. You can still read the steps below.
          </p>
          {nextLink(ORANGE_BTN, `Go on to Level ${next?.n}: ${next?.title}`)}
        </Card>
      )}

      <ol className="space-y-4">
        {level.steps.map((step) => {
          const route = step.go ? GUIDE_ROUTES[step.go.route] : null
          const vars = { title: route?.title ?? '' }
          const locked = Boolean(step.go) && !step.practice && !canOpen(openable, matchOf(step.go!.route))
          const id = stepId(level, step)
          const ticked = progress.done.has(id)
          const skipped = !ticked && progress.done.has(skipId(id))
          if (locked) {
            const phoneOnly = matchOf(step.go!.route).startsWith('!')
            return (
              <li key={step.key}>
                <Card className="space-y-2 border-dashed bg-slate-50/70">
                  <p className="text-base font-bold text-slate-600">{fill(step.do, vars)}</p>
                  <p className="text-sm leading-relaxed text-slate-500">
                    {phoneOnly
                      ? 'This part is on the phone app, so you can skip it here.'
                      : 'This page isn’t on your menu, so you can skip this step. If you’d like it, ask a team lead to switch it on for you.'}
                  </p>
                  {phoneOnly && PHONE_APP_URL && (
                    <a href={PHONE_APP_URL} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center text-base font-bold text-brand-blue underline underline-offset-2">
                      Open the phone app
                    </a>
                  )}
                </Card>
              </li>
            )
          }
          shown += 1
          const canGo = step.go && canOpen(openable, matchOf(step.go.route))
          const again = Boolean(step.go) && linked.has(route!.to)
          if (step.go) linked.add(route!.to)
          return (
            <li key={step.key}>
              <Card className={`space-y-3 ${ticked ? 'border-emerald-200 bg-emerald-50/40' : skipped ? 'border-dashed bg-slate-50/70' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 font-black text-brand-blue-dark" aria-hidden="true">
                    {shown}
                  </span>
                  <p className="pt-1 text-base font-bold leading-snug text-ink">{fill(step.do, vars)}</p>
                </div>
                {step.practice && <PracticeScreen kind={step.practice} />}
                {canGo && step.go && again && <p className="text-sm text-slate-500">Still on the “{route!.title}” page from the step above.</p>}
                {canGo && step.go && !again && (
                  route!.external ? (
                    <a href={route!.to} target="_blank" rel="noopener" className={step.practice ? OUTLINE_BTN : ORANGE_BTN}>
                      {fill(step.go.label, vars)}
                    </a>
                  ) : (
                    <Link to={route!.to} onClick={() => rememberReturn(here.to, here.label)} className={step.practice ? OUTLINE_BTN : ORANGE_BTN}>
                      {fill(step.go.label, vars)}
                    </Link>
                  )
                )}
                {canGo && step.go && !again && route!.note && <p className="text-sm text-slate-500">{route!.note}</p>}
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">You should see</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{fill(step.see, vars)}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base font-bold text-ink">
                    <input type="checkbox" checked={ticked} onChange={(e) => progress.setStep(id, e.target.checked)} className="h-6 w-6 rounded accent-emerald-600" />
                    I did this
                  </label>
                  {!ticked && (
                    <button
                      type="button"
                      onClick={() => progress.setSkip(id, !skipped)}
                      className="min-h-[44px] px-1 text-sm font-bold text-slate-500 underline underline-offset-2"
                    >
                      {skipped ? 'Skipped. Undo' : 'Skip for now'}
                    </button>
                  )}
                </div>
              </Card>
            </li>
          )
        })}
      </ol>

      {st.complete ? (
        <Card className="space-y-4 border-emerald-200 text-center">
          <img src={photo} alt="" className="mx-auto h-40 w-40 rounded-full object-cover" loading="lazy" />
          <h2 className="font-display text-2xl font-black text-ink">You finished Level {level.n}</h2>
          <p className="text-base leading-relaxed text-slate-600">{doneLine(level)}</p>
          {nextLink(ORANGE_BTN, `Next up: Level ${next?.n}, ${next?.title}`)}
          <Link to={TRAIL_PATH} className={OUTLINE_BTN}>
            See all levels
          </Link>
        </Card>
      ) : st.settled ? (
        <Card className="space-y-4 border-emerald-200 text-center">
          <h2 className="font-display text-2xl font-black text-ink">You’re through Level {level.n}</h2>
          <p className="text-base leading-relaxed text-slate-600">
            You skipped {st.skipped} {st.skipped === 1 ? 'step' : 'steps'} for now. They stay here if you want them later.
          </p>
          {nextLink(ORANGE_BTN, `Next up: Level ${next?.n}, ${next?.title}`)}
          <Link to={TRAIL_PATH} className={OUTLINE_BTN}>
            See all levels
          </Link>
        </Card>
      ) : (
        !st.na && (
          <div className="space-y-3 text-center">
            <p className="px-1 text-sm text-slate-500">
              Nothing on this page posts anything or charges anyone.{' '}
              <Link to={MONEY_PATH} className="font-bold text-brand-blue underline underline-offset-2">
                What the app does with money
              </Link>
            </p>
            {next && nextLink(OUTLINE_BTN, `Skip ahead to Level ${next.n}`)}
          </div>
        )
      )}

      <Card className="space-y-2 bg-slate-50/70">
        <p className="font-display text-lg font-extrabold text-ink">Stuck?</p>
        <p className="text-base leading-relaxed text-slate-600">{STUCK_TEXT}</p>
      </Card>
    </GuidePage>
  )
}

function doneLine(level: Level): string {
  switch (level.key) {
    case 'mine':
      return 'You know where your name, your level and your hours live. That’s the whole “make it yours” level.'
    case 'appear':
      return 'You’ve seen how a notice gets from a form to everyone’s phone, and you didn’t post a thing.'
    case 'daily':
      return 'That’s the daily check: new sign-ups, bookings and calls, all in one pass. It gets quicker every time.'
    case 'rabbits':
      return 'You’ve seen your rabbits on the staff page and on the public Adopt page, side by side. That’s how you know a change worked.'
    case 'receive':
      return 'You know how an item gets its code and how a scan finds it again. Real receiving works the same way, with a photo first.'
    case 'sell':
      return 'You’ve rung up a pretend sale, start to finish, and nothing was recorded. The real thing is the same taps, once the cash box or card reader has taken the money.'
    case 'bunfest':
      return 'You’ve seen how BunFest hangs together: the program, the bunny list and the raffle table. You sold a pretend raffle ticket, and nothing was recorded.'
    case 'website':
      return 'You’ve seen the public pages, and you know the app and the website show the same rabbits because they read one shared list.'
    case 'shop':
      return 'You’ve looked at the shop’s stock, its reorder list and its deliveries, and you changed nothing. That’s the whole look-around.'
    default:
      return 'Nicely done.'
  }
}
