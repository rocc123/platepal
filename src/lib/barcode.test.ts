import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { eanChecksumOk, productCode } from './barcode.ts'

describe('product barcodes', () => {
  it('accepts valid UPC-A and EAN-13 check digits', () => {
    assert.equal(eanChecksumOk('012345678905'), true)
    assert.equal(eanChecksumOk('3017620422003'), true)
    assert.equal(productCode('3017620422003'), '3017620422003')
    assert.equal(productCode('012345678905'), '012345678905')
  })

  it('rejects a grocery code with a bad check digit', () => {
    assert.equal(eanChecksumOk('3017620422004'), false)
    assert.equal(productCode('3017620422004'), null)
    assert.equal(productCode('012345678906'), null)
  })

  it('still allows shorter numeric codes that are not EAN-13', () => {
    assert.equal(productCode('12345670'), '12345670')
    assert.equal(productCode('123'), null)
  })
})
