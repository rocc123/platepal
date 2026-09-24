import { useState, type ChangeEvent } from 'react'
import { isImageFile } from '../lib/imageFile'

type PhotoPickerProps = {
  previewUrl: string | null
  onPick: (file: File) => void
  onClear: () => void
}

const LIBRARY_ACCEPT = 'image/*,.heic,.heif,.jpg,.jpeg,.png,.webp'

export function PhotoPicker({ previewUrl, onPick, onClear }: PhotoPickerProps) {
  const [error, setError] = useState<string | null>(null)

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!isImageFile(file)) {
      setError('That file is not a photo. Choose a picture from your camera roll.')
      return
    }
    setError(null)
    onPick(file)
  }

  return (
    <div className="photo">
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="Selected meal" />
          <button type="button" className="btn-secondary" onClick={onClear}>
            Remove photo
          </button>
        </>
      ) : (
        <div className="photo-actions">
          <label className="photo-btn file-btn">
            <strong>Take a photo</strong>
            <span>Open the camera</span>
            <input type="file" accept="image/*" capture="environment" onChange={onChange} />
          </label>
          <label className="photo-btn file-btn">
            <strong>Upload from phone</strong>
            <span>Camera roll or files</span>
            <input type="file" accept={LIBRARY_ACCEPT} onChange={onChange} />
          </label>
        </div>
      )}
      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}
