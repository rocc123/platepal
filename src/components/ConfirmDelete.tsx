import { useState } from 'react'

type ConfirmDeleteProps = {
  label: string
  prompt: string
  disabled?: boolean
  onConfirm: () => void
}

// Deleting can't be undone, so the first tap only asks.
export function ConfirmDelete({ label, prompt, disabled = false, onConfirm }: ConfirmDeleteProps) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button type="button" className="btn-danger" disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }

  return (
    <div className="confirm-delete" role="alertdialog" aria-label={prompt}>
      <p>
        {prompt} <span>This can’t be undone.</span>
      </p>
      <div className="row-actions two">
        <button type="button" className="btn-danger solid" disabled={disabled} onClick={onConfirm}>
          Yes, delete
        </button>
        <button type="button" className="btn-secondary" onClick={() => setAsking(false)}>
          Keep it
        </button>
      </div>
    </div>
  )
}
