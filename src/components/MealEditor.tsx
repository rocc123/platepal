import { useState } from 'react'
import { AddFoodPanel } from './AddFoodPanel'
import { MealWhen } from './MealWhen'
import { PortionField } from './PortionField'
import { mergeMealItems } from '../lib/analyzeGrouping'
import { appendMealItems, namedMealItems } from '../lib/mealItems'
import type { Lookups } from '../lib/lookups'
import { formatPortion, setItemGrams, setItemMeasure, setItemQuantity } from '../lib/portions'
import { formatFocusLine, formatOtherLine, sumItems } from '../lib/totals'
import type { MealItem } from '../lib/types'

type MealEditorProps = {
  note: string
  items: MealItem[]
  date: string
  time: string
  durationMinutes: number
  periodId: number
  lookups: Lookups
  confidence: number | null
  assumptions: string
  saveAsSavedMeal: boolean
  showSavedMealCheckbox: boolean
  savedMealName: string
  compactWhen?: boolean
  saving: boolean
  error: string | null
  onNoteChange: (note: string) => void
  onItemsChange: (items: MealItem[]) => void
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onDurationChange: (minutes: number) => void
  onPeriodChange: (periodId: number) => void
  onSaveAsSavedMealChange: (checked: boolean) => void
  onSavedMealNameChange: (name: string) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  onSaveAsSavedMeal?: () => void
}

function parseNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function parseGrams(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function extrasPreview(item: MealItem): string {
  const bits: string[] = []
  const portion = formatPortion(item)
  if (portion && portion !== 'Add a portion') bits.push(portion)
  if (item.calories) bits.push(`${item.calories} cal`)
  if (item.carbs_g) bits.push(`${item.carbs_g}g carbs`)
  if (item.fat_g) bits.push(`${item.fat_g}g fat`)
  return bits.length ? bits.join(' · ') : 'Add calories, carbs, or fat'
}

export function MealEditor({
  note,
  items,
  date,
  time,
  durationMinutes,
  periodId,
  lookups,
  confidence,
  assumptions,
  saveAsSavedMeal,
  showSavedMealCheckbox,
  savedMealName,
  compactWhen = false,
  saving,
  error,
  onNoteChange,
  onItemsChange,
  onDateChange,
  onTimeChange,
  onDurationChange,
  onPeriodChange,
  onSaveAsSavedMealChange,
  onSavedMealNameChange,
  onSave,
  onCancel,
  onDelete,
  onSaveAsSavedMeal,
}: MealEditorProps) {
  const totals = sumItems(items)
  const [adding, setAdding] = useState(false)

  function updateItem(index: number, patch: Partial<MealItem>) {
    onItemsChange(
      items.map((item, i) => {
        if (i !== index) return item
        return { ...item, ...patch }
      }),
    )
  }

  function updatePortion(index: number, next: MealItem) {
    onItemsChange(items.map((item, i) => (i === index ? next : item)))
  }

  return (
    <div className="editor">
      <MealWhen
        date={date}
        time={time}
        durationMinutes={durationMinutes}
        periodId={periodId}
        lookups={lookups}
        compact={compactWhen}
        onDateChange={onDateChange}
        onTimeChange={onTimeChange}
        onDurationChange={onDurationChange}
        onPeriodChange={onPeriodChange}
      />

      <label className="field">
        <span>
          Note <em>optional</em>
        </span>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="1/3 cup oats + 2 eggs"
        />
      </label>

      {(assumptions || confidence != null) && (
        <div className="assumptions">
          {confidence != null ? <strong>Confidence {Math.round(confidence * 100)}%</strong> : null}
          {assumptions ? <span>{assumptions}</span> : null}
        </div>
      )}

      <div className="editor-items">
        {items.length === 0 ? (
          <p className="muted">No foods yet. Add one below — a name is enough.</p>
        ) : null}
        {items.filter((row) => row.name.trim()).length > 1 ? (
          <button
            type="button"
            className="text-action combine-all"
            onClick={() => {
              const named = items.filter((row) => row.name.trim())
              onItemsChange([mergeMealItems(named, note.trim() || undefined)])
            }}
          >
            Combine into one food
          </button>
        ) : null}
        {items.map((item, index) => (
          <div className="item-card" key={item.id ?? index}>
            <label className="field">
              <span>Food name</span>
              <input
                type="text"
                value={item.name}
                onChange={(event) => updateItem(index, { name: event.target.value })}
                placeholder="Chicken breast"
              />
            </label>
            <PortionField
              item={item}
              onQuantityChange={(quantity) => updatePortion(index, setItemQuantity(item, quantity))}
              onMeasureChange={(measure) => updatePortion(index, setItemMeasure(item, measure))}
            />
            <div className="item-grid tracked-grid">
              <label className="field">
                <span>Protein g</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={item.protein_g || ''}
                  placeholder="0"
                  onChange={(event) => updateItem(index, { protein_g: parseNumber(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Fiber g</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={item.fiber_g || ''}
                  placeholder="0"
                  onChange={(event) => updateItem(index, { fiber_g: parseNumber(event.target.value) })}
                />
              </label>
            </div>
            <details className="extras">
              <summary>
                <span>{extrasPreview(item)}</span>
                <em>optional</em>
              </summary>
              <div className="item-grid">
                <label className="field">
                  <span>Grams</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.grams ?? ''}
                    placeholder="—"
                    onChange={(event) => updatePortion(index, setItemGrams(item, parseGrams(event.target.value)))}
                  />
                </label>
                <label className="field">
                  <span>Calories</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.calories || ''}
                    placeholder="0"
                    onChange={(event) => updateItem(index, { calories: parseNumber(event.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>Carbs g</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.carbs_g || ''}
                    placeholder="0"
                    onChange={(event) => updateItem(index, { carbs_g: parseNumber(event.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>Fat g</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.fat_g || ''}
                    placeholder="0"
                    onChange={(event) => updateItem(index, { fat_g: parseNumber(event.target.value) })}
                  />
                </label>
              </div>
            </details>
            <div className="item-actions">
              {index > 0 ? (
                <button
                  type="button"
                  className="text-back combine"
                  onClick={() => {
                    const merged = mergeMealItems([items[index - 1], item])
                    onItemsChange([...items.slice(0, index - 1), merged, ...items.slice(index + 1)])
                  }}
                >
                  Combine with food above
                </button>
              ) : null}
              <button
                type="button"
                className="text-back"
                onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <AddFoodPanel
          onAdd={(next) => {
            onItemsChange(appendMealItems(namedMealItems(items), next))
            setAdding(false)
          }}
          onClose={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
          Add another food
        </button>
      )}

      <div className="totals-line">
        <span>{formatFocusLine(totals.protein_g, totals.fiber_g)}</span>
        <span>{formatOtherLine(totals.calories, totals.carbs_g, totals.fat_g)}</span>
      </div>

      {showSavedMealCheckbox ? (
        <div className="saved-keep">
          <label className="check">
            <input
              type="checkbox"
              checked={saveAsSavedMeal}
              onChange={(event) => onSaveAsSavedMealChange(event.target.checked)}
            />
            Also keep as a saved meal
          </label>
          {saveAsSavedMeal ? (
            <label className="field">
              <span>Saved meal name</span>
              <input
                type="text"
                value={savedMealName}
                onChange={(event) => onSavedMealNameChange(event.target.value)}
                placeholder="Oat Breakfast"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {onSaveAsSavedMeal ? (
        <div className="saved-keep">
          <label className="field">
            <span>Saved meal name</span>
            <input
              type="text"
              value={savedMealName}
              onChange={(event) => onSavedMealNameChange(event.target.value)}
              placeholder="Oat Breakfast"
            />
          </label>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="row-actions">
        <button type="button" className="btn" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save meal'}
        </button>
        <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        {onSaveAsSavedMeal ? (
          <button type="button" className="btn-secondary" disabled={saving} onClick={onSaveAsSavedMeal}>
            Keep this meal
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" className="btn-danger" disabled={saving} onClick={onDelete}>
            Delete meal
          </button>
        ) : null}
      </div>
    </div>
  )
}
