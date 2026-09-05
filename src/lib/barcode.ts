type DetectedBarcode = { rawValue: string }

type DetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>
}

function detectorClass(): DetectorCtor | null {
  const ctor = (window as Window & { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  return ctor ?? null
}

export function canDetectBarcodes() {
  return Boolean(detectorClass())
}

export async function detectBarcodeInSource(source: ImageBitmapSource): Promise<string | null> {
  const Ctor = detectorClass()
  if (!Ctor) return null
  const detector = new Ctor({
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
  })
  const codes = await detector.detect(source)
  const value = codes.map((c) => c.rawValue.replace(/\s/g, '')).find((raw) => /\d{8,}/.test(raw))
  return value ?? null
}
