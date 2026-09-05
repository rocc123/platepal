import { useEffect, useRef, useState } from 'react'
import { canDetectBarcodes, detectBarcodeInSource } from '../lib/barcode'
import { itemFromHit, lookupBarcode } from '../lib/foods'
import type { MealItem } from '../lib/types'

export function BarcodePicker({ onPick }: { onPick: (item: MealItem, assumptions: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!scanning) return
    const video = videoRef.current
    if (!video) return
    const el = video
    let cancelled = false

    async function run() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        el.srcObject = stream
        await el.play()
        const tick = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const found = await detectBarcodeInSource(videoRef.current)
            if (found) {
              setCode(found)
              await lookup(found)
              return
            }
          } catch {
            // keep scanning
          }
          window.setTimeout(() => {
            void tick()
          }, 250)
        }
        void tick()
      } catch {
        if (!cancelled) {
          setError('Camera permission was denied. Type the barcode instead.')
          setScanning(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      el.srcObject = null
    }
  }, [scanning])

  async function lookup(raw: string) {
    setBusy(true)
    setError(null)
    try {
      const hit = await lookupBarcode(raw)
      onPick(
        itemFromHit(hit),
        `Open Food Facts, per ${hit.grams}g. Edit if your portion is different.`,
      )
      setCode('')
      setScanning(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Barcode lookup failed.')
    } finally {
      setBusy(false)
    }
  }

  async function fromPhoto(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.')
      return
    }
    if (!canDetectBarcodes()) {
      setError('This browser cannot read barcodes from a photo. Type the number instead.')
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      const found = await detectBarcodeInSource(bitmap)
      bitmap.close()
      if (!found) {
        setError('No barcode found in that photo.')
        return
      }
      setCode(found)
      await lookup(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo.')
    }
  }

  return (
    <div className="lookup">
      <label className="field">
        <span>Barcode (Open Food Facts)</span>
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Scan or type the number"
        />
      </label>
      {scanning ? <video ref={videoRef} className="scan-video" muted playsInline /> : null}
      <div className="row-actions two">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void lookup(code)}>
          {busy ? 'Looking up…' : 'Look up'}
        </button>
        {scanning ? (
          <button type="button" className="btn-secondary" onClick={() => setScanning(false)}>
            Stop camera
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => {
              if (!canDetectBarcodes()) {
                setError('This browser cannot scan barcodes. Type the number instead.')
                return
              }
              setError(null)
              setScanning(true)
            }}
          >
            Scan
          </button>
        )}
      </div>
      <label className="photo-btn file-btn">
        Use a barcode photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void fromPhoto(file)
          }}
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}
