// Printing labels straight to OHRR's Bluetooth label printer (Phomemo PM-249-WF;
// first reported as a PM-344-WF, which speaks exactly the same way).
//
// One code path everywhere, through @capacitor-community/bluetooth-le:
//   Android and iPhone apps   the phone's own Bluetooth (the printer is picked
//                             once and remembered)
//   Chrome on Android, and Chrome / Edge on a laptop   Web Bluetooth (the
//                             browser asks which printer each time the page is
//                             opened — browsers don't let a page remember it)
//   Safari on iPhone          no Bluetooth for web pages; the App Store app is
//                             the way there
//
// The printer listens on service FF00; the job is written to FF02 in pieces no
// bigger than the connection allows, without waiting for replies.
import { BleClient, ConnectionPriority } from '@capacitor-community/bluetooth-le'
import { isNative } from '../../../native/platform'

const SERVICE = '0000ff00-0000-1000-8000-00805f9b34fb'
const PRINT_CHAR = '0000ff02-0000-1000-8000-00805f9b34fb'
const DEVICE_KEY = 'ohrr.labels.btPrinter'

export interface BtPrinter {
  deviceId: string
  name: string
}

/** Whether this device can reach a Bluetooth printer from here. */
export function bluetoothAvailable(): boolean {
  if (isNative) return true
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

let ready = false
let connected: BtPrinter | null = null
/** Bytes per write; found on the first write and kept for the connection. */
let pieceSize = 0

async function init() {
  if (ready) return
  await BleClient.initialize({ androidNeverForLocation: true })
  ready = true
}

export function rememberedPrinter(): BtPrinter | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    return raw ? (JSON.parse(raw) as BtPrinter) : null
  } catch {
    return null
  }
}

function remember(p: BtPrinter | null) {
  try {
    if (p) localStorage.setItem(DEVICE_KEY, JSON.stringify(p))
    else localStorage.removeItem(DEVICE_KEY)
  } catch {
    /* private mode */
  }
}

export const connectedPrinter = () => connected

/**
 * Ask which printer to use: the phone lists the label printers it can see
 * (names starting PM-), or, with `anyName`, every Bluetooth device nearby.
 * Must run straight from a tap — browsers only open the list then.
 */
export async function choosePrinter(anyName = false): Promise<BtPrinter> {
  await init()
  if (isNative && !(await BleClient.isEnabled())) {
    try {
      await BleClient.requestEnable()
    } catch {
      /* iPhone: the system asks by itself */
    }
  }
  const d = await BleClient.requestDevice(anyName ? { optionalServices: [SERVICE] } : { namePrefix: 'PM-', optionalServices: [SERVICE] })
  await disconnect()
  const p = { deviceId: d.deviceId, name: d.name || 'Label printer' }
  await open(p)
  remember(p)
  return p
}

async function open(p: BtPrinter) {
  await BleClient.connect(p.deviceId, () => {
    if (connected?.deviceId === p.deviceId) connected = null
  })
  connected = p
  pieceSize = 0
  if (isNative) {
    try {
      // Most phones agree a bigger packet size than the 23-byte minimum; each write can be that size less 3.
      const mtu = await BleClient.getMtu(p.deviceId)
      if (mtu > 23) pieceSize = Math.min(mtu - 3, 512)
    } catch {
      /* use the trial below */
    }
    try {
      await BleClient.requestConnectionPriority(p.deviceId, ConnectionPriority.CONNECTION_PRIORITY_HIGH)
    } catch {
      /* iPhone: not needed */
    }
  }
}

/**
 * Connected to a printer, or null when a printer still has to be chosen. In
 * the apps the one chosen before is reconnected without asking.
 */
export async function ensurePrinter(): Promise<BtPrinter | null> {
  if (connected) return connected
  if (!isNative) return null
  const saved = rememberedPrinter()
  if (!saved) return null
  await init()
  try {
    await open(saved)
    return connected
  } catch {
    return null
  }
}

export async function disconnect() {
  const p = connected
  connected = null
  if (p) {
    try {
      await BleClient.disconnect(p.deviceId)
    } catch {
      /* already gone */
    }
  }
}

/** Forget the printer on this device (the next print asks again). */
export async function forgetPrinter() {
  await disconnect()
  remember(null)
}

/** Send one job, reporting progress 0..1. */
export async function sendJob(job: Uint8Array, onProgress?: (done: number) => void): Promise<void> {
  const p = connected
  if (!p) throw new Error('The label printer isn’t connected.')
  const write = (piece: Uint8Array) =>
    BleClient.writeWithoutResponse(p.deviceId, SERVICE, PRINT_CHAR, new DataView(piece.buffer, piece.byteOffset, piece.byteLength))
  let at = 0
  if (!pieceSize) {
    // Browsers don't say the packet size: try a big piece, and drop to the
    // 20-byte minimum if it is refused.
    try {
      await write(job.subarray(0, 180))
      pieceSize = 180
      at = Math.min(180, job.length)
    } catch {
      pieceSize = 20
    }
  }
  let lastReport = 0
  let pieces = 0
  while (at < job.length) {
    const end = Math.min(at + pieceSize, job.length)
    await write(job.subarray(at, end))
    at = end
    if (onProgress && at - lastReport > 4096) {
      lastReport = at
      onProgress(at / job.length)
    }
    // Let the page breathe (and the browser's Bluetooth queue drain) now and then.
    if (++pieces % 32 === 0) await new Promise((r) => setTimeout(r, 0))
  }
  onProgress?.(1)
}
