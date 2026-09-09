type DetectedBarcode = { rawValue: string }

type DetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>
}

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const

function detectorClass(): DetectorCtor | null {
  const ctor = (window as Window & { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  return ctor ?? null
}

export function canUseLiveCamera() {
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia)
}

export function eanChecksumOk(digits: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false
  let sum = 0
  const body = digits.slice(0, -1)
  const check = Number(digits.slice(-1))
  for (let i = 0; i < body.length; i++) {
    const n = Number(body[body.length - 1 - i])
    sum += i % 2 === 0 ? n * 3 : n
  }
  return (10 - (sum % 10)) % 10 === check
}

export function productCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return null
  if ((digits.length === 12 || digits.length === 13 || digits.length === 14) && !eanChecksumOk(digits)) {
    return null
  }
  return digits
}

function isZxingMiss(err: unknown) {
  const name = err instanceof Error ? err.name : ''
  return name === 'NotFoundException' || name === 'ChecksumException' || name === 'FormatException'
}

async function detectWithNative(source: ImageBitmapSource): Promise<string | null> {
  const Ctor = detectorClass()
  if (!Ctor) return null
  const detector = new Ctor({ formats: [...NATIVE_FORMATS] })
  const codes = await detector.detect(source)
  for (const code of codes) {
    const value = productCode(code.rawValue)
    if (value) return value
  }
  return null
}

function scaleSize(width: number, height: number, maxEdge: number) {
  const longEdge = Math.max(width, height)
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function sourceToCanvas(source: ImageBitmapSource, maxEdge: number): Promise<HTMLCanvasElement | null> {
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return source
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const draw = (width: number, height: number, paint: () => void) => {
    const size = scaleSize(width, height, maxEdge)
    canvas.width = size.width
    canvas.height = size.height
    paint()
  }

  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    if (!source.videoWidth) return null
    draw(source.videoWidth, source.videoHeight, () => {
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    })
    return canvas
  }

  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    const width = source.naturalWidth || source.width
    const height = source.naturalHeight || source.height
    if (!width) return null
    draw(width, height, () => {
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    })
    return canvas
  }

  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    draw(source.width, source.height, () => {
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    })
    return canvas
  }

  if (typeof ImageData !== 'undefined' && source instanceof ImageData) {
    canvas.width = source.width
    canvas.height = source.height
    ctx.putImageData(source, 0, 0)
    return canvas
  }

  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    const bitmap = await createImageBitmap(source)
    try {
      draw(bitmap.width, bitmap.height, () => {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      })
    } finally {
      bitmap.close()
    }
    return canvas
  }

  return null
}

async function detectWithZxing(source: ImageBitmapSource, tryHarder: boolean): Promise<string | null> {
  const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
  ])
  if (tryHarder) hints.set(DecodeHintType.TRY_HARDER, true)

  const reader = new BrowserMultiFormatOneDReader(hints)
  const canvas = await sourceToCanvas(source, tryHarder ? 1600 : 720)
  if (!canvas) return null
  try {
    return productCode(reader.decodeFromCanvas(canvas).getText())
  } catch (err) {
    if (isZxingMiss(err)) return null
    throw err
  }
}

export async function detectBarcodeInSource(
  source: ImageBitmapSource,
  options?: { tryHarder?: boolean },
): Promise<string | null> {
  const tryHarder = Boolean(options?.tryHarder)
  const native = await detectWithNative(source)
  if (native) return native
  const liveVideo =
    !tryHarder && typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement
  if (liveVideo && detectorClass()) return null
  return detectWithZxing(source, tryHarder)
}

export async function openBarcodeCamera(): Promise<MediaStream> {
  if (!canUseLiveCamera()) {
    throw Object.assign(new Error('This home-screen app cannot open a live camera. Take a photo of the barcode instead.'), {
      name: 'NotSupportedError',
    })
  }

  const attempts: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: { facingMode: 'environment' } },
    { audio: false, video: true },
  ]

  let last: unknown
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      last = err
    }
  }
  throw last instanceof Error ? last : new Error('Could not open the camera.')
}

export function messageForCameraError(err: unknown) {
  const name = err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow camera for Plate Pal, or take a photo of the barcode instead.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera found. Take a photo of the barcode instead.'
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The camera is already in use. Close other apps and try again, or take a photo instead.'
  }
  if (name === 'SecurityError' || name === 'NotSupportedError') {
    return 'The camera is blocked in this browser. Take a photo of the barcode instead.'
  }
  return err instanceof Error ? err.message : 'Could not open the camera. Take a photo of the barcode instead.'
}

export async function waitForVideoFrame(video: HTMLVideoElement) {
  if (video.readyState >= 2 && video.videoWidth > 0) return
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Camera started but no picture arrived. Take a photo of the barcode instead.'))
    }, 8000)
    const done = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadeddata', done)
      resolve()
    }
    video.addEventListener('loadeddata', done)
  })
}
