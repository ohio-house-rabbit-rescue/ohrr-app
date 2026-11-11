// One plain note kept on this phone or computer: "someone on the OHRR team has signed in here before."
// No name, no email, nothing private. The public side reads it to offer the team their way back to the Staff
// side, while a visitor's device, which never has the note, shows nothing about a Staff side at all
// (OHRR, 2026-11-03: the staff area stays out of visitors' sight). Identical in the app and the website.
const KEY = 'ohrr.team.device'

export function markTeamDevice(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* private window: they are simply asked the long way round */
  }
}

export function isTeamDevice(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
