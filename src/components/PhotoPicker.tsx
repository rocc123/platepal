import { useId, useState } from 'react'

type PhotoPickerProps = {
  previewUrl: string | null
  onPick: (file: File) => void
  onClear: () => void
}

export function PhotoPicker({ previewUrl, onPick, onClear }: PhotoPickerProps) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="photo">
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          if (!file.type.startsWith('image/')) {
            setError('That file is not an image.')
            return
          }
          setError(null)
          onPick(file)
        }}
      />
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="Selected meal" />
          <button type="button" className="btn-secondary" onClick={onClear}>
            Remove photo
          </button>
        </>
      ) : (
        <label className="photo-btn" htmlFor={id}>
          Take or pick a photo
        </label>
      )}
      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}
