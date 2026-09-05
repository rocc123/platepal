import { FoodSearch } from './FoodSearch'
import { scaleFrom100g } from '../lib/foods'
import { sumItems } from '../lib/totals'
import type { MealItem } from '../lib/types'

type MealEditorProps = {
  note: string
  items: MealItem[]
  confidence: number | null
  assumptions: string
  saveAsTemplate: boolean
  showTemplateCheckbox: boolean
  saving: boolean
  error: string | null
  onNoteChange: (note: string) => void
  onItemsChange: (items: MealItem[]) => void
  onSaveAsTemplateChange: (checked: boolean) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  onSaveTemplate?: () => void
}

function emptyItem(): MealItem {
  return {
    name: '',
    grams: null,
    calories: 0,
    protein_g: 0,
    fiber_g: 0,
    carbs_g: 0,
    fat_g: 0,
  }
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

export function MealEditor({
  note,
  items,
  confidence,
  assumptions,
  saveAsTemplate,
  showTemplateCheckbox,
  saving,
  error,
  onNoteChange,
  onItemsChange,
  onSaveAsTemplateChange,
  onSave,
  onCancel,
  onDelete,
  onSaveTemplate,
}: MealEditorProps) {
  const totals = sumItems(items)

  function updateItem(index: number, patch: Partial<MealItem>) {
    onItemsChange(
      items.map((item, i) => {
        if (i !== index) return item
        const next = { ...item, ...patch }
        if (patch.grams != null && item.per_100g) {
          return { ...next, ...scaleFrom100g(item.per_100g, patch.grams) }
        }
        return next
      }),
    )
  }

  return (
    <div className="page">
      <label className="field">
        <span>Note</span>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="200g chicken + broccoli"
        />
      </label>

      {(assumptions || confidence != null) && (
        <div className="assumptions">
          {confidence != null ? (
            <strong>Confidence {Math.round(confidence * 100)}%</strong>
          ) : null}
          {assumptions ? <span>{assumptions}</span> : null}
        </div>
      )}

      <FoodSearch
        onPick={(item) => {
          const named = items.filter((row) => row.name.trim())
          onItemsChange(named.length ? [...named, item] : [item])
        }}
      />

      <div className="editor-items">
        {items.map((item, index) => (
          <div className="item-card" key={item.id ?? index}>
            <label className="field">
              <span>Food</span>
              <input
                type="text"
                value={item.name}
                onChange={(event) => updateItem(index, { name: event.target.value })}
              />
            </label>
            <div className="item-grid">
              <label className="field">
                <span>Grams</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={item.grams ?? ''}
                  onChange={(event) => updateItem(index, { grams: parseGrams(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Protein g</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={item.protein_g}
                  onChange={(event) => updateItem(index, { protein_g: parseNumber(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Fiber g</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={item.fiber_g}
                  onChange={(event) => updateItem(index, { fiber_g: parseNumber(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Calories</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={item.calories}
                  onChange={(event) => updateItem(index, { calories: parseNumber(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Carbs g</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={item.carbs_g}
                  onChange={(event) => updateItem(index, { carbs_g: parseNumber(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Fat g</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={item.fat_g}
                  onChange={(event) => updateItem(index, { fat_g: parseNumber(event.target.value) })}
                />
              </label>
            </div>
            {items.length > 1 ? (
              <button
                type="button"
                className="btn-danger"
                onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
              >
                Remove food
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <button type="button" className="btn-secondary" onClick={() => onItemsChange([...items, emptyItem()])}>
        Add food
      </button>

      <div className="totals-line">
        <span>
          {totals.protein_g}g protein · {totals.fiber_g}g fiber
        </span>
        <span>{totals.calories} cal</span>
      </div>

      {showTemplateCheckbox ? (
        <label className="check">
          <input
            type="checkbox"
            checked={saveAsTemplate}
            onChange={(event) => onSaveAsTemplateChange(event.target.checked)}
          />
          Also save as template
        </label>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="row-actions">
        <button type="button" className="btn" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        {onSaveTemplate ? (
          <button type="button" className="btn-secondary" disabled={saving} onClick={onSaveTemplate}>
            Save as template
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
