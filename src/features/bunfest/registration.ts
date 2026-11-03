// BunFest bunny registration (update 52): owners register the rabbits they are bringing, with the
// RHDV2 vaccine date and a photo of the proof, and agree to the attendance agreement.
//
//   public   register_bunfest()               open to anyone, only ever inserts, ties it to the year's BunFest
//   staff    list_bunfest_registrations()     the list, newest first, bunnies inside
//            set_bunny_proof_checked()        "proof checked at the door" on or off
//            delete_bunfest_registration()    remove one
//
// Until update 52 is run the functions don't exist; callers get NEEDS_52 as the message.
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export const NEEDS_52 = 'Bunny registration needs database update 52 — it is in RUN-THIS-IN-SUPABASE.sql.'

export const ACTIVITIES = [
  { key: 'spa', label: 'Bunny Spa' },
  { key: 'glamour', label: 'Glamour Shots' },
  { key: 'lounge', label: 'Bunny Lounge' },
  { key: 'other', label: 'Something else' },
] as const
export type ActivityKey = (typeof ACTIVITIES)[number]['key']
export const activityLabel = (k: string) => ACTIVITIES.find((a) => a.key === k)?.label ?? k

export const SEXES = [
  { key: 'female', label: 'Girl' },
  { key: 'male', label: 'Boy' },
  { key: 'unknown', label: 'Not sure' },
] as const
export type Sex = (typeof SEXES)[number]['key']
export const sexLabel = (k: string) => SEXES.find((s) => s.key === k)?.label ?? k

export interface BunnyEntry {
  name: string
  age: string
  sex: Sex | ''
  breedColor: string
  rhdv2Date: string
  proofUrl: string
}
export const blankBunny = (): BunnyEntry => ({ name: '', age: '', sex: '', breedColor: '', rhdv2Date: '', proofUrl: '' })

export interface Registration {
  ownerName: string
  email: string
  phone: string
  activities: ActivityKey[]
  note: string
  bunnies: BunnyEntry[]
  agreed: boolean
}

type Fn = 'register_bunfest' | 'list_bunfest_registrations' | 'set_bunny_proof_checked' | 'delete_bunfest_registration'

async function call<T>(fn: Fn, args: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('This build isn’t connected to OHRR yet.')
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: Fn,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
  const { data, error } = await rpc(fn, args)
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? '')) throw new Error(NEEDS_52)
    throw new Error(error.message || 'That didn’t go through.')
  }
  return data as T
}

/** Send one registration. Resolves when it is saved; throws the reason in plain words otherwise. */
export async function registerBunnies(r: Registration): Promise<{ id: string; bunnies: number }> {
  return call('register_bunfest', {
    p_name: r.ownerName.trim(),
    p_email: r.email.trim(),
    p_phone: r.phone.trim(),
    p_activities: r.activities,
    p_note: r.note.trim(),
    p_agreed: r.agreed,
    p_bunnies: r.bunnies.map((b) => ({
      name: b.name.trim(),
      age: b.age.trim(),
      sex: b.sex || 'unknown',
      breed_color: b.breedColor.trim(),
      rhdv2_date: b.rhdv2Date,
      proof_url: b.proofUrl,
    })),
  })
}

export interface RegisteredBunny {
  id: string
  name: string
  age: string | null
  sex: Sex
  breed_color: string | null
  rhdv2_date: string | null
  proof_url: string | null
  proof_checked_at: string | null
}
export interface RegistrationRow {
  id: string
  event_id: string | null
  event_title: string | null
  event_starts_at: string | null
  owner_name: string
  email: string
  phone: string | null
  activities: string[]
  note: string | null
  agreed_at: string
  created_at: string
  bunnies: RegisteredBunny[]
}

export async function listRegistrations(orgId: string): Promise<RegistrationRow[]> {
  return (await call<RegistrationRow[]>('list_bunfest_registrations', { p_org: orgId })) ?? []
}

export async function setProofChecked(bunnyId: string, checked: boolean): Promise<void> {
  await call('set_bunny_proof_checked', { p_id: bunnyId, p_checked: checked })
}

export async function deleteRegistration(id: string): Promise<void> {
  await call('delete_bunfest_registration', { p_id: id })
}
