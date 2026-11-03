// Who may open the design screens: Founders and Developers, and staff who were given
// the "Web page admin" task (site.design). Board and the other owner/admin roles hold
// every task implicitly, so they are NOT counted unless they are a Founder or Developer:
// the database makes the same call (can_edit_design, update 54).
import { useAuth } from './auth'
import { useAllAccess } from './allAccess'
import { DESIGN_CAPABILITY } from './design'
import type { Capability } from './capabilities'

export function useCanDesign(): { ready: boolean; can: boolean } {
  const { membership, capabilities } = useAuth()
  const { ready, allAccess } = useAllAccess()
  if (!membership) return { ready: true, can: false }
  const granted = membership.role === 'staff' && capabilities.has(DESIGN_CAPABILITY as Capability)
  return { ready, can: allAccess || granted }
}
