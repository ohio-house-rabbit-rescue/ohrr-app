// Small helpers for staff pages whose lists open an editor in place: the row that just opened
// (or was just saved) is scrolled into view, so the next thing to do is on the screen.
// A row is marked with data-row="<id>" on a wrapper div.
import { bringIntoView } from './bringIntoView'

/**
 * Bring the element marked data-row="<id>" into view (after the screen has settled).
 * align 'top' for a tall panel that just opened, 'auto' for a short row that was just saved.
 */
export function showRow(id: string, opts: { align?: 'auto' | 'top'; keyboard?: 'away' | 'keep' } = {}) {
  window.setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-row="${id.replace(/"/g, '')}"]`)
    bringIntoView(el, opts)
  }, 100)
}
