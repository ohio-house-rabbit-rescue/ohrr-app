// The Rescue Rabbit Guardians — the OHRR Legacy Fund's thank-you list
// (update 29, table `guardians`). As on the live site: one group (a planned
// gift, or $1,000 or more in a calendar year), thanked by name a year at a
// time. Staff keep it under Staff → Rescue Rabbit Guardians; until update 29
// has been run, the Legacy Fund screen shows the 2026 names from the live
// site's graphic. The website has the same file (src/lib/guardians.ts).
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export interface Guardian {
  id: string
  year: number
  display_name: string
  sort_name: string
  is_published: boolean
}

export interface GuardianYear {
  year: number
  names: Guardian[]
}

/** The 2026 list from the live site's graphic, [name, sort under]. */
const GUARDIANS_2026: [string, string][] = [
  ['Elizabeth Aino', 'Aino Elizabeth'],
  ['Joanne Allsop', 'Allsop Joanne'],
  ['Barb Armitage & Robert Shapter', 'Armitage Barb'],
  ['Ryan Ballantyne', 'Ballantyne Ryan'],
  ['Kim Banks', 'Banks Kim'],
  ['Bob & Inger Barron', 'Barron Bob & Inger'],
  ['Pat Barron', 'Barron Pat'],
  ['Pam Beegle', 'Beegle Pam'],
  ['Bellala Family', 'Bellala'],
  ['Nancy Betz', 'Betz Nancy'],
  ['Diane & Dirk Cantrell', 'Cantrell Diane & Dirk'],
  ['Ivy Conklan', 'Conklan Ivy'],
  ['Leslye Creek', 'Creek Leslye'],
  ['Kim Eplin', 'Eplin Kim'],
  ['Ruth Fassinger', 'Fassinger Ruth'],
  ['Katie Feick', 'Feick Katie'],
  ['David Fisher', 'Fisher David'],
  ['Kat Fliehman', 'Fliehman Kat'],
  ['Laura Ann Froehlich', 'Froehlich Laura Ann'],
  ['Andrea Garcia', 'Garcia Andrea'],
  ['Shauna Hann', 'Hann Shauna'],
  ['Beverly & James Harris', 'Harris Beverly & James'],
  ['Hayes Family', 'Hayes'],
  ['Dave & June Hinkle', 'Hinkle Dave & June'],
  ['Dan Kosinski', 'Kosinski Dan'],
  ['Anthony Leicher', 'Leicher Anthony'],
  ['Susan Martin', 'Martin Susan'],
  ['Beverly May', 'May Beverly'],
  ['Frank McMillan', 'McMillan Frank'],
  ['Lindsay & Aaron McPherson', 'McPherson Lindsay & Aaron'],
  ['Miglin Family', 'Miglin'],
  ['Mia Ng', 'Ng Mia'],
  ['Mary Beth Parisi', 'Parisi Mary Beth'],
  ['Holly & Matthew Renzi', 'Renzi Holly & Matthew'],
  ['Wendy Risner', 'Risner Wendy'],
  ['Todd & Lisa Rutherford', 'Rutherford Todd & Lisa'],
  ['Susanne St. Clair', 'St. Clair Susanne'],
  ['Adam & Kimberly Stang', 'Stang Adam & Kimberly'],
  ['Ann Stringer', 'Stringer Ann'],
  ['Vuppala Family', 'Vuppala'],
  ['Rosie Wendt', 'Wendt Rosie'],
  ['Heather & Jarod Whitaker', 'Whitaker Heather & Jarod'],
  ['Marissa White', 'White Marissa'],
  ['Karen & Carl Winstead', 'Winstead Karen & Carl'],
  ['Julie & Katie Wolfe', 'Wolfe Julie & Katie'],
  ['Wolff Family', 'Wolff'],
  ['Kevin Worobey', 'Worobey Kevin'],
]

export const BUNDLED_GUARDIANS: Guardian[] = GUARDIANS_2026.map(([display_name, sort_name], i) => ({
  id: `bundled-${i}`,
  year: 2026,
  display_name,
  sort_name,
  is_published: true,
}))

/**
 * Where a name sorts: by surname, as the live site's list does —
 * "Bob & Inger Barron" under Barron, "Barb Armitage & Robert Shapter" under
 * Armitage, "Hayes Family" under Hayes, "Susanne St. Clair" under St. Clair.
 */
export function guessSortName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ')
  const family = /^(.*)\s+family$/i.exec(n)
  if (family) return family[1]
  const first = n.split(/\s+(?:&|and)\s+/i)[0]
  const w = (first.includes(' ') ? first : n).split(' ')
  let i = w.length - 1
  while (i > 0 && /^(st\.?|van|von|de|del|della|di|da|le|la)$/i.test(w[i - 1])) i--
  return [...w.slice(i), ...w.slice(0, i)].join(' ')
}

const key = (g: Guardian) => (g.sort_name || guessSortName(g.display_name)).toLowerCase()
export function sortGuardians(list: Guardian[]): Guardian[] {
  return [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
}

/** Newest year first, names in order. */
export function byYear(list: Guardian[]): GuardianYear[] {
  const years = [...new Set(list.map((g) => g.year))].sort((a, b) => b - a)
  return years.map((year) => ({ year, names: sortGuardians(list.filter((g) => g.year === year)) }))
}

/** The published list, by year. Falls back to the bundled 2026 names. */
export function useGuardians(): GuardianYear[] | null {
  const [years, setYears] = useState<GuardianYear[] | null>(null)
  useEffect(() => {
    let alive = true
    const fallback = () => alive && setYears(byYear(BUNDLED_GUARDIANS))
    if (!isSupabaseConfigured) {
      fallback()
      return
    }
    supabase
      .from('guardians')
      .select('id, year, display_name, sort_name, is_published')
      .eq('is_published', true)
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data || data.length === 0) fallback()
        else setYears(byYear(data))
      })
    return () => {
      alive = false
    }
  }, [])
  return years
}
