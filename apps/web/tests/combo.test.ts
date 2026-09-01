import assert from 'node:assert/strict'
import test from 'node:test'

import { getComboTier } from '../src/lib/combo.ts'

test('combo tiers change at the intended thresholds', () => {
  assert.equal(getComboTier(4), 'normal')
  assert.equal(getComboTier(5), 'fever')
  assert.equal(getComboTier(9), 'fever')
  assert.equal(getComboTier(10), 'blazing')
})
