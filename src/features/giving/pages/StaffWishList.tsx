// Staff → Wish list items (update 32): items from OHRR's Amazon wish list,
// each with its own Amazon link, shown on the Support page ("Most needed"
// first, then in the order here) with a "Buy on Amazon" button. Amazon won't
// let a program read the list, so the links are pasted in by hand. The website
// has the desktop mirror.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage, supabase } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import {
  cleanAmazonLink,
  isAmazonUrl,
  sortWishItems,
  wishTableMissing,
  WISH_ITEM_COLUMNS,
  type WishListItem,
} from '../wishList'

const BAD_LINK = 'That doesn’t look like an Amazon link.'
const LINK_HINT = 'On Amazon, open the item from OHRR’s list, tap Share → Copy link, and paste it here.'

interface Draft {
  name: string
  link: string
  note: string
  mostNeeded: boolean
  shown: boolean
}

const EMPTY: Draft = { name: '', link: '', note: '', mostNeeded: false, shown: true }

/** A draft ready to save, or the reason it isn't. */
function checkDraft(d: Draft): { ok: true; name: string; url: string; note: string | null } | { ok: false; error: string } {
  const name = d.name.trim().replace(/\s+/g, ' ')
  if (!name) return { ok: false, error: 'Give the item a name.' }
  const url = cleanAmazonLink(d.link)
  if (!isAmazonUrl(url)) return { ok: false, error: BAD_LINK }
  return { ok: true, name: name.slice(0, 160), url, note: d.note.trim().slice(0, 300) || null }
}

function ItemFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const linkLooksWrong = draft.link.trim() !== '' && !isAmazonUrl(cleanAmazonLink(draft.link))
  return (
    <>
      <label className="block text-sm font-semibold text-slate-700">
        Item
        <input
          className={staffInput}
          value={draft.name}
          maxLength={160}
          placeholder="e.g. Oxbow Western Timothy Hay, 90 oz"
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Amazon link
        <span className="block text-xs font-normal text-slate-500">{LINK_HINT}</span>
        <input
          className={staffInput}
          value={draft.link}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://a.co/d/…"
          onChange={(e) => onChange({ ...draft, link: e.target.value })}
        />
        {linkLooksWrong && <span className="mt-1 block text-xs font-semibold text-red-600">{BAD_LINK}</span>}
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Note <span className="font-normal text-slate-400">(optional)</span>
        <input
          className={staffInput}
          value={draft.note}
          maxLength={300}
          placeholder="e.g. The big bags last longest"
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
        />
      </label>
      <div className="flex flex-wrap gap-x-5">
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-slate-300 text-brand-blue"
            checked={draft.mostNeeded}
            onChange={(e) => onChange({ ...draft, mostNeeded: e.target.checked })}
          />
          Most needed
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-slate-300 text-brand-blue"
            checked={draft.shown}
            onChange={(e) => onChange({ ...draft, shown: e.target.checked })}
          />
          Show on the site
        </label>
      </div>
    </>
  )
}

export default function StaffWishList() {
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [rows, setRows] = useState<WishListItem[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('wish_list_items').select(WISH_ITEM_COLUMNS).eq('org_id', orgId)
    if (error) {
      if (wishTableMissing(error)) setMissing(true)
      else setError(errMessage(error))
      setRows([])
      return
    }
    setRows(data ?? [])
  }, [orgId])
  useEffect(() => {
    if (orgId) void load()
  }, [orgId, load])

  // The Support page's order: "Most needed" first, then this list's order.
  const list = useMemo(() => sortWishItems(rows ?? []), [rows])

  if (!can('giving.wishlist'))
    return (
      <Screen>
        <p className="text-sm text-slate-600">You don’t have access to the wish list items.</p>
      </Screen>
    )

  const start = () => {
    setBusy(true)
    setError(null)
    setMsg(null)
  }
  const done = async (text: string) => {
    await load()
    setBusy(false)
    setMsg(text)
  }
  const fail = (e: unknown) => {
    setBusy(false)
    setError(errMessage(e))
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const c = checkDraft(draft)
    if (!c.ok) return setError(c.error)
    start()
    // New items go to the end of their group.
    const last = (rows ?? []).reduce((m, r) => Math.max(m, r.sort_order), 0)
    const { error } = await supabase.from('wish_list_items').insert({
      org_id: orgId,
      name: c.name,
      amazon_url: c.url,
      note: c.note,
      most_needed: draft.mostNeeded,
      is_published: draft.shown,
      sort_order: last + 10,
      created_by: user?.id ?? null,
    })
    if (error) return fail(/amazon_url/i.test(error.message) ? new Error(BAD_LINK) : error)
    setDraft(EMPTY)
    await done(`Added ${c.name}.`)
  }

  const saveEdit = async () => {
    if (!editing) return
    const c = checkDraft(editing.draft)
    if (!c.ok) return setError(c.error)
    start()
    const { error } = await supabase
      .from('wish_list_items')
      .update({
        name: c.name,
        amazon_url: c.url,
        note: c.note,
        most_needed: editing.draft.mostNeeded,
        is_published: editing.draft.shown,
      })
      .eq('id', editing.id)
    if (error) return fail(/amazon_url/i.test(error.message) ? new Error(BAD_LINK) : error)
    setEditing(null)
    await done('Saved.')
  }

  /** Up or down within its group ("Most needed" or the rest), renumbering the group. */
  const move = async (item: WishListItem, dir: -1 | 1) => {
    const group = list.filter((x) => x.most_needed === item.most_needed)
    const i = group.findIndex((x) => x.id === item.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= group.length) return
    const next = [...group]
    ;[next[i], next[j]] = [next[j], next[i]]
    // 10, 20, 30… within the group (the two groups never mix: most-needed sorts first).
    const changes = next.map((x, k) => ({ id: x.id, from: x.sort_order, to: (k + 1) * 10 })).filter((c) => c.from !== c.to)
    start()
    for (const c of changes) {
      const { error } = await supabase.from('wish_list_items').update({ sort_order: c.to }).eq('id', c.id)
      if (error) return fail(error)
    }
    await load()
    setBusy(false)
  }

  const remove = async (item: WishListItem) => {
    if (!window.confirm(`Take “${item.name}” off the wish list items?`)) return
    start()
    const { error } = await supabase.from('wish_list_items').delete().eq('id', item.id)
    if (error) return fail(error)
    await done(`Removed ${item.name}.`)
  }

  const shown = list.filter((x) => x.is_published).length

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Wish list items</h1>
        <p className="mt-1 text-sm text-slate-600">
          Items from OHRR’s Amazon wish list, each with its own “Buy on Amazon” button on{' '}
          <Link to="/support" className="font-semibold text-brand-blue underline underline-offset-2">
            the Support page
          </Link>{' '}
          and the website — “Most needed” first. The button to the whole list stays. Amazon’s photos can’t be used, so
          items show by name.
        </p>
      </div>

      {missing && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm leading-relaxed text-slate-700">
            Wish list items switch on with <strong>update 32</strong> (RUN-THIS-IN-SUPABASE.sql in the Drive). Until then
            the Support page shows the button to the whole list, as it does now.
          </p>
        </Card>
      )}

      {rows === null && !error && <Spinner />}
      {rows && !missing && (
        <>
          <form onSubmit={add}>
            <Card className="space-y-3">
              <p className="font-display text-lg font-extrabold text-ink">Add an item</p>
              <ItemFields draft={draft} onChange={setDraft} />
              <button type="submit" disabled={busy || !draft.name.trim() || !draft.link.trim()} className={`${btn.primary} w-full disabled:opacity-60`}>
                <Icon name="plus" size={16} /> {busy ? 'Saving…' : 'Add'}
              </button>
            </Card>
          </form>

          <FormError>{error}</FormError>
          {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{msg}</p>}

          <Card className="!p-0">
            <p className="border-b border-slate-100 px-4 py-3 font-display text-lg font-extrabold text-ink">
              {list.length} {list.length === 1 ? 'item' : 'items'}
              {list.length > shown && <span className="ml-2 text-sm font-semibold text-slate-500">({list.length - shown} hidden)</span>}
            </p>
            {list.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">
                No items yet. Until there are, the Support page shows only the button to the whole list.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((item) => {
                  const group = list.filter((x) => x.most_needed === item.most_needed)
                  const pos = group.findIndex((x) => x.id === item.id)
                  if (editing?.id === item.id)
                    return (
                      <li key={item.id} className="space-y-2 bg-slate-50/60 px-4 py-3">
                        <ItemFields draft={editing.draft} onChange={(d) => setEditing({ id: item.id, draft: d })} />
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button type="button" disabled={busy} onClick={() => void saveEdit()} className={`${btn.blue} disabled:opacity-60`}>
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </li>
                    )
                  return (
                    <li key={item.id} className="px-4 py-2">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 py-1.5">
                          <p className={`text-sm font-semibold ${item.is_published ? 'text-ink' : 'text-slate-400 line-through'}`}>{item.name}</p>
                          {item.note && <p className="text-xs text-slate-500">{item.note}</p>}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {item.most_needed && <Badge tone="orange">Most needed</Badge>}
                            {!item.is_published && <Badge tone="slate">Hidden</Badge>}
                            <a
                              href={item.amazon_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-brand-blue"
                            >
                              Check the link <Icon name="external" size={11} />
                            </a>
                          </div>
                        </div>
                        <span className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            aria-label={`Move ${item.name} up`}
                            disabled={busy || pos <= 0}
                            onClick={() => void move(item, -1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <Icon name="chevron" size={16} className="-rotate-90" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${item.name} down`}
                            disabled={busy || pos >= group.length - 1}
                            onClick={() => void move(item, 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <Icon name="chevron" size={16} className="rotate-90" />
                          </button>
                        </span>
                      </div>
                      <span className="-ml-2 flex text-sm font-bold">
                        <button
                          type="button"
                          className="min-h-[40px] px-2 text-brand-blue"
                          onClick={() =>
                            setEditing({
                              id: item.id,
                              draft: {
                                name: item.name,
                                link: item.amazon_url,
                                note: item.note ?? '',
                                mostNeeded: item.most_needed,
                                shown: item.is_published,
                              },
                            })
                          }
                        >
                          Edit
                        </button>
                        <button type="button" className="min-h-[40px] px-2 text-red-600 disabled:opacity-60" disabled={busy} onClick={() => void remove(item)}>
                          Remove
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </Screen>
  )
}
