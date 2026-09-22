// A breed field that suggests as you type and still takes anything.
//
// Most rabbits are a mix or a guess, so a fixed dropdown would be wrong; but
// typing "Netherland Dwarf" on a phone is a chore. This offers OHRR's breed
// guide as suggestions (plus the honest answers people actually give) and
// accepts whatever is typed, including a breed nobody has heard of.
import { useId } from 'react'
import { BREEDS } from '../data/breeds'

/** The guide's breeds, plus the answers that aren't a breed at all. */
export const BREED_SUGGESTIONS: string[] = [
  ...BREEDS.map((b) => b.name),
  'Mixed breed',
  'Lop mix',
  'Dwarf mix',
  'Not sure',
]

export default function BreedInput({
  value,
  onChange,
  className,
  placeholder = 'Start typing — e.g. Holland Lop, mixed, not sure',
  id,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  id?: string
}) {
  const listId = `breeds-${useId().replace(/:/g, '')}`
  return (
    <>
      <input
        id={id}
        className={className}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {BREED_SUGGESTIONS.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </>
  )
}
