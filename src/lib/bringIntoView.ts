// "Take me to the next thing": after a step is done (a save, a photo, a box started) the next button
// or panel is scrolled to where it is easy to see, and the on-screen keyboard is put away so it can't
// cover it (OHRR 2026-11-03: "new item is saved, keyboard pops up so the print button is below the
// keyboard — the screen centers on the button, and if possible the keyboard is put away").
//
//   bringIntoView(el)                         a short panel sits in the middle of the screen, a tall one starts
//                                             just under the top bar, so its first lines are on screen
//   bringIntoView(el, { align: 'top' })       always start under the top bar (a panel that is still filling up
//                                             below its first lines, like a list that loads)
//   bringIntoView(el, { keyboard: 'keep' })   leave the keyboard alone (the next field is about to be typed in)
//
// Putting the keyboard away is a blur of the field being typed in; the screen settles after the keyboard has
// closed, so the scroll waits for that.
const TOP_BAR = 80

/** Close the on-screen keyboard, if a text box has it open. */
export function putKeyboardAway() {
  const a = document.activeElement
  if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement) a.blur()
}

export function bringIntoView(
  el: HTMLElement | null | undefined,
  opts: { align?: 'auto' | 'top'; keyboard?: 'away' | 'keep'; delay?: number } = {},
) {
  const away = (opts.keyboard ?? 'away') === 'away'
  if (away) putKeyboardAway()
  // The keyboard takes a moment to close and give the screen back.
  const wait = opts.delay ?? (away ? 260 : 120)
  window.setTimeout(() => {
    if (!el || !el.isConnected) return
    const r = el.getBoundingClientRect()
    const room = window.innerHeight - 220
    if (opts.align !== 'top' && r.height < room) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      window.scrollTo({ top: Math.max(0, r.top + window.scrollY - TOP_BAR), behavior: 'smooth' })
    }
  }, wait)
}

/** A message that just appeared (an error, a "saved" note): scrolled into view only if it is off screen or behind the top bar / footer. */
export function ensureVisible(el: HTMLElement | null | undefined) {
  window.setTimeout(() => {
    if (!el || !el.isConnected) return
    const r = el.getBoundingClientRect()
    if (r.top < TOP_BAR || r.bottom > window.innerHeight - 140) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 120)
}

/**
 * Any button tapped while a text box has the keyboard open puts the keyboard away (Save, Next, Print, Start …),
 * so the result of the tap isn't left behind it. A tap that moves the cursor to another box leaves that box alone.
 */
export function keyboardAwayOnButtons() {
  // The field being typed in when the finger went down: on a phone a tapped button may not take focus,
  // so the field would still hold the keyboard when the click arrives.
  let typing: HTMLElement | null = null
  const isField = (e: Element | null): e is HTMLInputElement | HTMLTextAreaElement =>
    e instanceof HTMLTextAreaElement || (e instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'range', 'button', 'submit'].includes(e.type))
  document.addEventListener(
    'pointerdown',
    () => {
      const a = document.activeElement
      typing = isField(a) ? a : null
    },
    true,
  )
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target
      const field = typing
      typing = null
      if (!field || !(target instanceof Element)) return
      const button = target.closest('button, [role="button"], a')
      if (!button || button.contains(field)) return
      // A button that wants the keyboard kept (a clear x, a microphone) says so with data-keep-keyboard.
      if (button.closest('[data-keep-keyboard]')) return
      window.setTimeout(() => {
        if (document.activeElement === field) field.blur()
      }, 80)
    },
    true,
  )
}
