// The staff pages this person may open, as the paths staffTiles.ts lists them — so the Trail can say "ask for this
// one" instead of sending someone to a button they do not have. App-specific (the website has its own).
import { useStaffTiles } from '../staff/staffTiles'

/** null while the menu is still being worked out. */
export function useOpenablePaths(): string[] | null {
  const { tiles } = useStaffTiles()
  return tiles.map((t) => t.to)
}
