export type Helper = 'photo' | 'search' | 'barcode'

export function MethodRow({
  helper,
  fileAdded = false,
  onToggle,
}: {
  helper: Helper | null
  fileAdded?: boolean
  onToggle: (next: Helper) => void
}) {
  return (
    <div className="method-row" role="group" aria-label="Optional helpers">
      <button
        type="button"
        className={helper === 'photo' || fileAdded ? 'method-tile on' : 'method-tile'}
        aria-pressed={helper === 'photo'}
        onClick={() => onToggle('photo')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M4 8.5h3l1.4-2h7.2l1.4 2H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z" />
          <circle cx="12" cy="13.2" r="2.6" />
        </svg>
        <strong>Photo</strong>
        <span>{fileAdded ? 'Added' : 'Optional'}</span>
      </button>
      <button
        type="button"
        className={helper === 'search' ? 'method-tile on' : 'method-tile'}
        aria-pressed={helper === 'search'}
        onClick={() => onToggle('search')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4.5 4.5" strokeLinecap="round" />
        </svg>
        <strong>Look up</strong>
        <span>Optional</span>
      </button>
      <button
        type="button"
        className={helper === 'barcode' ? 'method-tile on' : 'method-tile'}
        aria-pressed={helper === 'barcode'}
        onClick={() => onToggle('barcode')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M5 6v12M8 6v12M10 6v12M13 6v12M15.5 6v12M19 6v12" strokeLinecap="round" />
        </svg>
        <strong>Barcode</strong>
        <span>Optional</span>
      </button>
    </div>
  )
}
