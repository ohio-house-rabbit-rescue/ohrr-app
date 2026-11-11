// The words of a team invite. Email it, Text it, Share and Send again all use these, so every invite says the
// same short thing and carries one link only: the join link with the code in it. Written for someone who reads
// a few plain lines and no more. Identical in the app and the website.

/**
 * While Supabase's "Confirm email" switch is ON, a new person gets a second email after making their password,
 * and has to tap the link in it. The invite says so. Set this to false the day OHRR switches Confirm email off.
 */
export const SECOND_EMAIL_STEP = true

export const INVITE_SUBJECT = 'Your invitation to the OHRR app'

export interface InviteWords {
  /** The join link with the code in it. The only link in the message. */
  link: string
  /** Who it is for, if known. */
  name?: string | null
  /** Who is sending it, if known: the last line before the rescue's name. */
  from?: string | null
  /** The day the link stops working, already written out ("Nov 25"), if known. */
  linkUntil?: string | null
  /** The last day of their access, already written out, if it has an end. */
  accessUntil?: string | null
}

const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? ''

/** The small last line: when the link stops working, and when their access ends if it does. */
function smallPrint(w: InviteWords): string {
  const link = w.linkUntil ? `The link works until ${w.linkUntil}.` : 'The link works for 14 days.'
  return w.accessUntil ? `${link} Your access runs until ${w.accessUntil}.` : link
}

/** The email: three or four numbered steps, plain text, nothing else to read. */
export function inviteEmailBody(w: InviteWords): string {
  const hi = firstName(w.name)
  const steps = [
    `Tap this link:\n${w.link}`,
    'Make a password. Use this email address.',
    ...(SECOND_EMAIL_STEP ? ['A second email will come. Tap the link in it.'] : []),
    'Tap "Start the guide." It shows you around in short steps. Nothing you do in it can break anything.',
  ]
  return [
    `Hi${hi ? ` ${hi}` : ''},`,
    'You’re invited to the OHRR team app. It is where we keep the bunnies, the Hop Shop, volunteer hours and BunFest in one place.',
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    'Stuck? Just reply to this email.',
    `${w.from?.trim() ? `${w.from.trim()}\n` : ''}Ohio House Rabbit Rescue`,
    smallPrint(w),
  ].join('\n\n')
}

/** A text message or a share: one or two lines and the link. */
export function inviteShortText(w: InviteWords): string {
  const hi = firstName(w.name)
  return `${hi ? `Hi ${hi}. ` : ''}You’re invited to the OHRR team app. Tap this link, then make a password with your email address: ${w.link}`
}

/**
 * What to tell someone whose invitation didn't go through, in plain words with what to do next. `raw` is the
 * message redeem_invite_code raised (update 55). `dead` = the code itself is finished, so stop offering it.
 */
export function inviteProblem(raw: string, signedInAs?: string | null): { text: string; dead: boolean; wrongEmail: boolean } {
  const as = signedInAs ? ` You are signed in as ${signedInAs}.` : ''
  if (/different email/i.test(raw))
    return {
      text: `This invitation was sent to a different email address.${as} Sign in with the email the invitation came to, or ask the person who invited you for a new one.`,
      dead: false,
      wrongEmail: true,
    }
  if (/expired/i.test(raw))
    return { text: 'This invitation has run out. They work for 14 days. Ask the person who invited you to send a new one.', dead: true, wrongEmail: false }
  if (/fully used/i.test(raw))
    return {
      text: `This invitation was already used.${as} If you used it before, sign in with the email it was sent to. If not, ask the person who invited you for a new one.`,
      dead: true,
      wrongEmail: false,
    }
  if (/invalid code/i.test(raw))
    return {
      text: 'We don’t know that invitation code. Open your invite email and tap the link in it again, or ask the person who invited you for a new one.',
      dead: true,
      wrongEmail: false,
    }
  if (/switched off/i.test(raw))
    return { text: 'Your access is on hold. Ask the person who invited you to switch it back on. You don’t need a new invitation.', dead: false, wrongEmail: false }
  if (/not authenticated/i.test(raw))
    return { text: 'Please sign in first, then tap the link in your invite email again.', dead: false, wrongEmail: false }
  if (/failed to fetch|network|load failed/i.test(raw))
    return { text: 'No connection just now. Check your Wi-Fi or signal, then try again.', dead: false, wrongEmail: false }
  return { text: raw, dead: false, wrongEmail: false }
}

/** A mailto: link that opens the sender's own mail app with the invite written. */
export function inviteMailto(email: string, w: InviteWords): string {
  return `mailto:${email}?subject=${encodeURIComponent(INVITE_SUBJECT)}&body=${encodeURIComponent(inviteEmailBody(w))}`
}
