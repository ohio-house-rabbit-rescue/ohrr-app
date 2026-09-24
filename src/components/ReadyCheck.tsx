// "Is a rabbit right for us?" — the two-minute check (2026-09-24), the app's
// copy of the website's ReadyCheck. OHRR's research: rabbits are given up
// almost always for human reasons, so teaching people before they buy keeps
// rabbits out of rescues and in their homes. Every question and every "why"
// line is taken from OHRR's own article (care_articles `is-a-rabbit-right-for-us`,
// which staff edit under Care guides & pages) — if that article's facts change,
// change these (and the website's) to match. Nothing is stored or sent; the
// answers stay on this screen.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { btn } from './ui'

type Answer = 'yes' | 'unsure' | 'no'

const QUESTIONS: { id: string; q: string; why: string }[] = [
  {
    id: 'years',
    q: 'Can you care for a rabbit for 10 years or more?',
    why: 'A rabbit lives 10 years or more. That is a middle-schooler’s whole childhood.',
  },
  {
    id: 'space',
    q: 'Is there room indoors for a space at least 4 feet by 4 feet, with time out of the pen every day?',
    why: 'Rabbits live indoors, with time out of the pen every day. A hutch in the yard is not a home.',
  },
  {
    id: 'adult',
    q: 'Will an adult own the daily care: hay every day, the litter box, and noticing if the rabbit stops eating?',
    why: 'A rabbit that stops eating is an emergency. If the plan is “the kids will take care of it,” a rabbit is not the right pet yet.',
  },
  {
    id: 'handling',
    q: 'Are you happy with a pet that mostly doesn’t like being picked up?',
    why: 'Rabbits are prey animals: fragile and easily startled. They show love by sitting near you, not by cuddling on demand.',
  },
  {
    id: 'proofing',
    q: 'Are you ready to bunny-proof cords, baseboards and carpet corners?',
    why: 'Rabbits chew and dig. Cords, baseboards and carpet corners need bunny-proofing.',
  },
  {
    id: 'vet',
    q: 'Can you get to a rabbit-savvy vet, and budget for set-up, monthly supplies and a yearly check-up?',
    why: 'Not every vet treats rabbits. There is a set-up to buy, hay, pellets, greens and litter every month, and a check-up every year.',
  },
  {
    id: 'home',
    q: 'Will your home, and your plans, have room for a rabbit for years to come?',
    why: 'Rabbits are given up almost always for human reasons: a move, a new baby, a home that was never set up for a rabbit.',
  },
]

const LABEL: Record<Answer, string> = { yes: 'Yes', unsure: 'Not sure', no: 'No' }

export default function ReadyCheck() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const done = QUESTIONS.every((x) => answers[x.id])
  const notYet = QUESTIONS.filter((x) => answers[x.id] && answers[x.id] !== 'yes')

  const pick = (id: string, a: Answer) => setAnswers((prev) => ({ ...prev, [id]: a }))

  return (
    <section id="check" className="rounded-2xl border border-brand-blue/20 bg-white p-4 shadow-sm">
      <h2 className="font-display text-xl font-black text-ink">The two-minute check</h2>
      <p className="mt-1 text-sm text-slate-600">Seven honest questions. Your answers stay on your screen.</p>

      <ol className="mt-4 space-y-4">
        {QUESTIONS.map((x, i) => (
          <li key={x.id} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
            <p className="text-[15px] font-semibold leading-snug text-ink">
              {i + 1}. {x.q}
            </p>
            {/* Three even buttons across the phone, 44px tall */}
            <div className="mt-2.5 grid grid-cols-3 gap-2" role="group" aria-label={`Answer to question ${i + 1}`}>
              {(Object.keys(LABEL) as Answer[]).map((a) => {
                const on = answers[x.id] === a
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(x.id, a)}
                    className={`min-h-[44px] rounded-full px-2 text-sm font-bold transition active:scale-[.98] ${
                      on
                        ? a === 'yes'
                          ? 'bg-brand-blue text-white shadow-sm'
                          : 'bg-brand-orange text-ink shadow-sm'
                        : 'border border-slate-300 bg-white text-slate-600 hover:border-brand-blue hover:text-brand-blue'
                    }`}
                  >
                    {LABEL[a]}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ol>

      {done && notYet.length === 0 && (
        <div className="mt-5 rounded-2xl bg-brand-blue-50 p-4">
          <p className="font-display text-lg font-extrabold leading-snug text-ink">
            It sounds like a rabbit could be right for you.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            Come and meet them. OHRR’s rabbits come already spayed or neutered and vaccinated, which is one of the best
            reasons to adopt rather than buy.
          </p>
          <div className="mt-3 grid gap-2">
            <Link to="/adopt" className={`${btn.primary} min-h-[44px] w-full`}>
              Meet the rabbits
            </Link>
            <Link to="/adopt/apply" className={`${btn.outline} min-h-[44px] w-full`}>
              Start an application
            </Link>
          </div>
        </div>
      )}

      {done && notYet.length > 0 && (
        <div className="mt-5 rounded-2xl bg-brand-orange-50 p-4">
          <p className="font-display text-lg font-extrabold leading-snug text-ink">Not yet is a kind answer.</p>
          <p className="mt-1 text-sm text-slate-700">These are worth sorting out before a rabbit comes home:</p>
          <ul className="mt-3 space-y-2.5">
            {notYet.map((x) => (
              <li key={x.id} className="text-sm leading-relaxed text-slate-700">
                <strong className="text-ink">{x.q}</strong> {x.why}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            The best way to find out is to spend time with rabbits first. A socialization shift at the Adoption Center is an
            hour of quiet company that helps a rescued rabbit get ready for a home.
          </p>
          <div className="mt-3 grid gap-2">
            <Link to="/book/bunny-socialization" className={`${btn.primary} min-h-[44px] w-full`}>
              Book a socialization shift
            </Link>
            <Link to="/learn" className={`${btn.outline} min-h-[44px] w-full bg-white`}>
              Read the care guides
            </Link>
          </div>
        </div>
      )}

      {Object.keys(answers).length > 0 && (
        <button
          type="button"
          onClick={() => setAnswers({})}
          className="mt-3 inline-flex min-h-[44px] items-center text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          Start over
        </button>
      )}
    </section>
  )
}
