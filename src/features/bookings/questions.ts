// Questions on a booking form, kept by staff as plain text on the booking type
// (Staff → Bookings → Set up → "Questions on the form", update 43):
//
//   Your rabbit's name *
//   Spayed or neutered? * | Yes | No | Booked in
//
// One question per line. Choices follow a "|". A "*" at the end of the
// question means it must be answered. The answers go into the booking's
// answer, one "Question: answer" line each, so the roster, the CSV and the
// staff emails show them with no other change.
//
// The website's src/lib/bookingQuestions.ts is a copy — keep the two in sync.

export interface BookingQuestion {
  label: string
  options: string[]
  required: boolean
}

/** Longest answer to one question (the whole answer is kept to 500 characters). */
export const ANSWER_MAX = 80

export function parseQuestions(text: string | null | undefined): BookingQuestion[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.split('|').map((p) => p.trim()))
    .filter((parts) => parts[0])
    .slice(0, 8)
    .map(([first, ...rest]) => {
      const required = first.endsWith('*')
      return { label: required ? first.slice(0, -1).trim() : first, options: rest.filter(Boolean), required }
    })
}

/**
 * The text saved as the booking's answer: a line per answered question, then
 * the reply to the type's own question (ask_reason) when there is one.
 */
export function answerText(questions: BookingQuestion[], values: string[], askReason: string | null, reply: string): string {
  const lines = questions
    .map((q, i) => [q.label.replace(/[?:]\s*$/, ''), (values[i] ?? '').trim()] as const)
    .filter(([, v]) => v)
    .map(([label, v]) => `${label}: ${v}`)
  const r = reply.trim()
  if (r) lines.push(lines.length && askReason ? `${askReason.replace(/[?:]\s*$/, '').replace(/\s*\(.*\)$/, '')}: ${r}` : r)
  return lines.join('\n')
}
