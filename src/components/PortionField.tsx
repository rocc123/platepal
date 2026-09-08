import { useState } from 'react'
import {
  QUANTITY_CHIPS,
  availableMeasures,
  formatGramsAmount,
  formatQuantity,
  measureKey,
  measureLabel,
  parseQuantity,
} from '../lib/portions'
import type { MealItem, PortionMeasure } from '../lib/types'

export function PortionField({
  item,
  onQuantityChange,
  onMeasureChange,
}: {
  item: MealItem
  onQuantityChange: (quantity: number) => void
  onMeasureChange: (measure: PortionMeasure) => void
}) {
  const measures = availableMeasures(item)
  const selected = measureKey({ unit: item.unit ?? 'serving', gramsPerUnit: item.grams_per_unit ?? null })
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? formatQuantity(item.quantity)

  function applyQuantity(next: number) {
    setDraft(null)
    onQuantityChange(next)
  }

  function commit(raw: string) {
    const next = parseQuantity(raw)
    setDraft(null)
    if (next == null) return
    onQuantityChange(next)
  }

  return (
    <div className="portion">
      <div className="portion-row">
        <label className="field">
          <span>Amount</span>
          <input
            type="text"
            inputMode="decimal"
            value={text}
            placeholder="1"
            onFocus={() => setDraft(formatQuantity(item.quantity))}
            onChange={(event) => {
              const raw = event.target.value
              setDraft(raw)
              const next = parseQuantity(raw)
              if (next != null) onQuantityChange(next)
            }}
            onBlur={() => commit(text)}
          />
        </label>
        <label className="field">
          <span>Unit</span>
          <select
            value={measures.some((measure) => measureKey(measure) === selected) ? selected : measures[0] ? measureKey(measures[0]) : selected}
            onChange={(event) => {
              const measure = measures.find((row) => measureKey(row) === event.target.value)
              if (measure) onMeasureChange(measure)
            }}
          >
            {measures.map((measure) => (
              <option key={measureKey(measure)} value={measureKey(measure)}>
                {measureLabel(measure)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="portion-chips" role="group" aria-label="Common amounts">
        {QUANTITY_CHIPS.map((amount) => {
          const active = item.quantity != null && Math.abs(item.quantity - amount) < 0.02
          return (
            <button
              key={String(amount)}
              type="button"
              className={active ? 'portion-chip on' : 'portion-chip'}
              onClick={() => applyQuantity(amount)}
            >
              {formatQuantity(amount)}
            </button>
          )
        })}
      </div>
      <p className="portion-eq">
        {item.grams != null
          ? item.unit === 'g'
            ? `${formatGramsAmount(item.grams)}g`
            : `≈ ${formatGramsAmount(item.grams)}g`
          : 'Grams stay underneath once we know a portion weight.'}
      </p>
    </div>
  )
}
