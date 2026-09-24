import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isImageFile } from './imageFile.ts'

describe('isImageFile', () => {
  it('accepts a normal camera jpeg', () => {
    assert.equal(isImageFile({ type: 'image/jpeg', name: 'meal.jpg' }), true)
  })

  it('accepts an iPhone HEIC that the camera roll sent without a MIME type', () => {
    assert.equal(isImageFile({ type: '', name: 'IMG_2041.HEIC' }), true)
  })

  it('accepts a library photo marked as a generic binary', () => {
    assert.equal(isImageFile({ type: 'application/octet-stream', name: 'plate.heif' }), true)
  })

  it('rejects a file that is not a picture', () => {
    assert.equal(isImageFile({ type: 'application/pdf', name: 'menu.pdf' }), false)
    assert.equal(isImageFile({ type: '', name: 'notes.txt' }), false)
  })
})
