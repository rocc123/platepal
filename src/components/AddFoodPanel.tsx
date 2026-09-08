import { useEffect, useState } from 'react'
import { analyzeMeal, resizeImageToJpeg } from '../lib/analyze'
import { blankMealItem } from '../lib/mealItems'
import type { MealItem } from '../lib/types'
import { BarcodePicker } from './BarcodePicker'
import { FoodSearch } from './FoodSearch'
import { MethodRow, type Helper } from './MethodRow'
import { PhotoPicker } from './PhotoPicker'

export function AddFoodPanel({
  onAdd,
  onClose,
}: {
  onAdd: (items: MealItem[]) => void
  onClose: () => void
}) {
  const [helper, setHelper] = useState<Helper | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function toggleHelper(next: Helper) {
    setHelper((current) => (current === next ? null : next))
    setError(null)
  }

  function pickFile(next: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(next)
    setPreviewUrl(URL.createObjectURL(next))
    setHelper('photo')
    setError(null)
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
  }

  async function onAnalyzePhoto() {
    if (!file || analyzing) return
    setAnalyzing(true)
    setError(null)
    try {
      const resized = await resizeImageToJpeg(file)
      const result = await analyzeMeal({
        imageBase64: resized.base64,
        mimeType: 'image/jpeg',
      })
      onAdd(result.items.length ? result.items : [blankMealItem()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyze failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="add-food-panel">
      <p className="helper-copy">
        Add another food the same way as the first — photo, lookup, barcode, or a blank row. A
        composed dish can stay one food.
      </p>
      <MethodRow helper={helper} fileAdded={Boolean(file)} onToggle={toggleHelper} />

      {helper === 'photo' ? (
        <div className="helper-panel nested">
          <p className="helper-copy">
            A plated side or a recipe card both work. We add whatever we find; you can still edit
            the numbers.
          </p>
          <PhotoPicker previewUrl={previewUrl} onPick={pickFile} onClear={clearFile} />
          <button
            type="button"
            className="btn"
            disabled={!file || analyzing}
            onClick={() => void onAnalyzePhoto()}
          >
            {analyzing ? 'Reading the plate…' : 'Analyze this photo'}
          </button>
        </div>
      ) : null}

      {helper === 'search' ? (
        <div className="helper-panel nested">
          <p className="helper-copy">Pick a USDA food and we add it to this meal.</p>
          <FoodSearch
            label="Search USDA"
            onPick={(item) => {
              onAdd([item])
            }}
          />
        </div>
      ) : null}

      {helper === 'barcode' ? (
        <div className="helper-panel nested">
          <p className="helper-copy">
            Scan with the camera, take a barcode photo, or type the number.
          </p>
          <BarcodePicker
            onPick={(item) => {
              onAdd([item])
            }}
          />
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="row-actions two">
        <button
          type="button"
          className="btn-secondary"
          disabled={analyzing}
          onClick={() => onAdd([blankMealItem()])}
        >
          Blank row
        </button>
        <button type="button" className="btn-secondary" disabled={analyzing} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
