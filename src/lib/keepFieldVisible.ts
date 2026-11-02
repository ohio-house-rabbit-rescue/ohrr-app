// When someone taps a text box on a phone, the keyboard opens a moment later and
// shrinks the screen. The box they are typing in must not end up hidden behind the
// keyboard, the sticky Save bar at the bottom, or the top bar. This watches every
// focus and, once the keyboard has settled, scrolls the box into the free space
// between the top bar and the Save bar (marked data-keyboard-footer).
const TEXTY = new Set(['text', 'search', 'email', 'tel', 'url', 'number', 'password', 'date', 'time', 'datetime-local', ''])
const TOP_BAR = 130
const GAP = 16

function ensureVisible(el: HTMLElement) {
  if (document.activeElement !== el) return
  const vv = window.visualViewport
  let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight
  const footer = document.querySelector<HTMLElement>('[data-keyboard-footer]')
  if (footer) bottom = Math.min(bottom, footer.getBoundingClientRect().top)
  const r = el.getBoundingClientRect()
  if (r.bottom + GAP > bottom) window.scrollBy({ top: r.bottom + GAP - bottom, behavior: 'instant' })
  else if (r.top < TOP_BAR) window.scrollBy({ top: r.top - TOP_BAR - GAP, behavior: 'instant' })
}

export function keepFieldVisible() {
  document.addEventListener('focusin', (e) => {
    const el = e.target
    if (!(el instanceof HTMLElement)) return
    const ok = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXTY.has(el.type))
    if (!ok) return
    // The keyboard takes a moment to open and resize the screen: check again as it settles.
    for (const ms of [120, 400, 800]) window.setTimeout(() => ensureVisible(el), ms)
  })
}
