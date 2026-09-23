// Counter → Add a new item. The item first, the code second:
//
//   photo → name → price → how many → saved (it gets an OHRR number, its SKU)
//   → "Has it got a barcode?"  scan the maker's barcode on the packet, so
//                              scanning the packet rings it up, or
//     "Print a label"          an OHRR label for things with no barcode.
//
// One question per screen, Back always top-left, the button that matters at
// the bottom. Needs signal (the photo and the item are saved straight away).
import { Suspense, lazy, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { isNative } from '../../../native/platform'
import { pickPhoto, type PhotoSource } from '../../../native/camera'
import { dataUrlToBlob, uploadItemPhoto } from '../../scan/api'
import { shortCode } from '../../scan/codes'
import { BigButton, BigInput, Busy, ErrorBox, MoneyInput, StepShell, Stepper } from '../../scan/ScanUI'
import { money, toCents } from '../local'
import { addItem, linkCode } from '../sales'
import { useCounterOrg } from '../CounterShell'

const Scanner = lazy(() => import('../../scan/Scanner'))

type Step = 'photo' | 'name' | 'price' | 'qty' | 'saving' | 'done' | 'barcode' | 'typeBarcode' | 'linked'
const ORDER: Step[] = ['photo', 'name', 'price', 'qty']

export default function CounterAdd() {
  const navigate = useNavigate()
  const { orgId, offline } = useCounterOrg()
  const [step, setStep] = useState<Step>('photo')
  const [photo, setPhoto] = useState<{ preview: string | null; url: string | null }>({ preview: null, url: null })
  const [photoBusy, setPhotoBusy] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [qty, setQty] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ id: string; code: string } | null>(null)
  const [barcode, setBarcode] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<Promise<string> | null>(null)

  const n = ORDER.indexOf(step) + 1
  const back = () => {
    const i = ORDER.indexOf(step)
    if (i > 0) setStep(ORDER[i - 1])
    else navigate('/staff/counter')
  }

  const usePhoto = async (src: Blob | string) => {
    if (!orgId) return
    setError(null)
    setPhotoBusy(true)
    try {
      const preview = typeof src === 'string' ? src : URL.createObjectURL(src)
      setPhoto({ preview, url: null })
      const blob = typeof src === 'string' ? await dataUrlToBlob(src) : src
      const p = uploadItemPhoto(blob, orgId)
      uploadRef.current = p
      const url = await p
      if (uploadRef.current === p) setPhoto({ preview, url })
    } catch (err) {
      setPhoto({ preview: null, url: null })
      setError(`The photo didn’t save: ${errMessage(err)}`)
    } finally {
      setPhotoBusy(false)
    }
  }
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await usePhoto(file)
  }
  const pick = async (source: PhotoSource) => {
    if (!isNative) {
      ;(source === 'camera' ? cameraRef : libraryRef).current?.click()
      return
    }
    try {
      const dataUrl = await pickPhoto(source)
      if (dataUrl) await usePhoto(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t get that photo.')
    }
  }

  const save = async () => {
    if (!orgId) return
    const cents = toCents(price)
    if (cents === null) return
    setError(null)
    setStep('saving')
    try {
      const url = uploadRef.current ? await uploadRef.current.catch(() => null) : null
      setSaved(await addItem(orgId, { name: name.trim(), priceCents: cents, quantity: qty, photoUrl: url }))
      setStep('done')
    } catch (err) {
      setError(errMessage(err))
      setStep('qty')
    }
  }

  const onBarcode = async (raw: string) => {
    if (!orgId || !saved) return
    setError(null)
    try {
      await linkCode(orgId, saved.id, raw)
      setBarcode(raw)
      setStep('linked')
    } catch (err) {
      setError(errMessage(err))
      setStep('done')
    }
  }

  const reset = () => {
    setPhoto({ preview: null, url: null })
    uploadRef.current = null
    setName('')
    setPrice('')
    setQty(1)
    setSaved(null)
    setBarcode(null)
    setTyped('')
    setError(null)
    setStep('photo')
  }

  if (offline) {
    return (
      <StepShell title="Add a new item" onBack={() => navigate('/staff/counter')} backLabel="Counter">
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-base text-amber-900">
          Adding an item needs signal — the photo and the item are saved straight away. Selling still works without it: use “Something else” for now.
        </p>
      </StepShell>
    )
  }

  if (step === 'photo') {
    return (
      <StepShell
        title="Take a photo"
        help="A clear photo makes it easy to find at the till."
        step={n}
        of={ORDER.length}
        onBack={back}
        backLabel="Counter"
        footer={
          <BigButton onClick={() => setStep('name')} disabled={photoBusy}>
            {photo.preview ? 'Next' : 'Skip the photo'}
          </BigButton>
        }
      >
        <div className="space-y-4">
          {photo.preview ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              <img src={photo.preview} alt="" className="h-64 w-full object-cover" />
              {photoBusy && <p className="px-4 py-2 text-center text-sm font-bold text-slate-500">Saving the photo…</p>}
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400">
              <Icon name="camera" size={56} />
            </div>
          )}
          <ErrorBox>{error}</ErrorBox>
          <BigButton onClick={() => void pick('camera')} tone="blue" icon="camera" disabled={photoBusy}>
            {photo.preview ? 'Take another photo' : 'Open the camera'}
          </BigButton>
          <BigButton onClick={() => void pick('library')} tone="outline" disabled={photoBusy}>
            Choose from my photos
          </BigButton>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Take a photo" />
          <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-label="Choose a photo" />
        </div>
      </StepShell>
    )
  }

  if (step === 'name') {
    return (
      <StepShell
        title="What is it called?"
        help="The name people see at the till and in the Hop Shop."
        step={n}
        of={ORDER.length}
        onBack={back}
        footer={
          <BigButton onClick={() => setStep('price')} disabled={!name.trim()}>
            Next
          </BigButton>
        }
      >
        <BigInput value={name} onChange={setName} placeholder="Timothy hay, 2 lb" ariaLabel="The item’s name" autoFocus onEnter={() => name.trim() && setStep('price')} />
      </StepShell>
    )
  }

  if (step === 'price') {
    const cents = toCents(price)
    return (
      <StepShell
        title="How much is it?"
        help="The price at the till."
        step={n}
        of={ORDER.length}
        onBack={back}
        footer={
          <BigButton onClick={() => setStep('qty')} disabled={cents === null}>
            Next
          </BigButton>
        }
      >
        <MoneyInput value={price} onChange={setPrice} ariaLabel="Price" autoFocus />
      </StepShell>
    )
  }

  if (step === 'qty') {
    return (
      <StepShell
        title="How many are there?"
        help="Count what’s on the shelf. Each sale takes one off."
        step={n}
        of={ORDER.length}
        onBack={back}
        footer={
          <BigButton onClick={() => void save()} icon="check">
            Save the item
          </BigButton>
        }
      >
        <div className="space-y-4">
          <Stepper value={qty} onChange={setQty} ariaLabel="How many" />
          <ErrorBox>{error}</ErrorBox>
        </div>
      </StepShell>
    )
  }

  if (step === 'saving') return <Busy label="Saving the item…" />

  if (step === 'barcode' || step === 'typeBarcode') {
    const digits = typed.replace(/[^0-9]/g, '')
    return (
      <StepShell title="Scan its barcode" help="The barcode printed on the packet. Scanning the packet will then ring this item up." onBack={() => setStep('done')}>
        {step === 'barcode' ? (
          <Suspense fallback={null}>
            <Scanner onResult={(raw) => void onBarcode(raw)} onTypeInstead={() => setStep('typeBarcode')} />
          </Suspense>
        ) : (
          <div className="space-y-4">
            <p className="text-base text-slate-600">Type the numbers printed under the barcode.</p>
            <BigInput value={typed} onChange={setTyped} placeholder="0 12345 67890 5" inputMode="numeric" ariaLabel="The barcode numbers" autoFocus onEnter={() => digits.length >= 8 && void onBarcode(digits)} />
            <BigButton onClick={() => void onBarcode(digits)} disabled={digits.length < 8} icon="check">
              Add this barcode
            </BigButton>
            <BigButton onClick={() => setStep('barcode')} tone="plain" icon="camera">
              Use the camera instead
            </BigButton>
          </div>
        )}
      </StepShell>
    )
  }

  // done / linked
  return (
    <StepShell
      title={step === 'linked' ? 'Barcode added' : 'Saved!'}
      onBack={() => navigate('/staff/counter')}
      backLabel="Counter"
      footer={
        <div className="space-y-2">
          <BigButton onClick={reset} icon="plus">
            Add another item
          </BigButton>
          <BigButton onClick={() => navigate('/staff/counter')} tone="plain">
            Done
          </BigButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3">
          {photo.preview ? (
            <img src={photo.preview} alt="" className="h-20 w-20 rounded-xl object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
              <Icon name="bag" size={32} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block font-display text-lg font-extrabold text-ink">{name}</span>
            <span className="block text-base text-slate-600">
              {money(toCents(price) ?? 0)} · {qty} on the shelf
            </span>
            {saved && (
              <span className="mt-0.5 block font-mono text-sm font-bold tracking-wider text-brand-blue">Item number {shortCode(saved.code)}</span>
            )}
          </span>
        </div>
        <ErrorBox>{error}</ErrorBox>

        {step === 'linked' ? (
          <p className="rounded-2xl bg-green-50 px-4 py-3 text-base font-semibold text-green-800">
            Scanning barcode {barcode} now rings up {name}.
          </p>
        ) : (
          <div className="space-y-3 rounded-2xl border-2 border-slate-200 p-4">
            <p className="font-display text-lg font-extrabold text-ink">Next: how will the till find it?</p>
            <BigButton onClick={() => setStep('barcode')} tone="blue" icon="scan">
              It has a barcode — scan it
            </BigButton>
            <Link
              to={`/staff/items/tags?code=${encodeURIComponent(saved?.code ?? '')}&name=${encodeURIComponent(name)}`}
              className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-blue/50 bg-white px-5 font-display text-lg font-extrabold text-brand-blue"
            >
              <Icon name="printer" size={20} /> No barcode — print a label
            </Link>
            <p className="text-sm text-slate-500">Or skip it: the item can always be found by name at the till.</p>
          </div>
        )}
      </div>
    </StepShell>
  )
}
