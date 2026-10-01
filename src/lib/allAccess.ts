// Founders and Developers: the two all-access levels, and the only people who
// may switch features on and off (Staff → Features; the database enforces it
// from update 38). The level comes from my_level(); until that answers, the
// membership role stands in (founders and developers are owners underneath).
import { useAuth } from './auth'
import { useMyLevel } from './staffLevels'

export function useAllAccess(): { ready: boolean; allAccess: boolean } {
  const { user, membership } = useAuth()
  const { ready, level } = useMyLevel(user?.id, membership?.orgId)
  if (!membership) return { ready: true, allAccess: false }
  if (ready) return { ready: true, allAccess: level === 'founder' || level === 'developer' }
  return { ready: false, allAccess: membership.role === 'owner' }
}
