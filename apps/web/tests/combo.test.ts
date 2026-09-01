import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { getComboTier } from '#/lib/combo'

describe('getComboTier', () => {
  it('changes at the intended thresholds', () => {
    assert.equal(getComboTier(4), 'normal')
    assert.equal(getComboTier(5), 'fever')
    assert.equal(getComboTier(9), 'fever')
    assert.equal(getComboTier(10), 'blazing')
  })
})
