import assert from 'node:assert/strict'
import test from 'node:test'

import {
  THEME_CSS_KEYS,
  THEME_IDS,
  THEMES,
  getThemePalette,
} from '../src/lib/themes.ts'

test('every theme id has a full definition', () => {
  assert.deepEqual(
    THEMES.map((theme) => theme.id),
    [...THEME_IDS],
  )
  for (const theme of THEMES) {
    assert.deepEqual(
      Object.keys(theme.css).sort(),
      [...THEME_CSS_KEYS].sort(),
      `${theme.id} must define every CSS variable`,
    )
  }
})

test('unknown theme falls back to the classic palette', () => {
  assert.equal(getThemePalette('does-not-exist'), getThemePalette('classic'))
})
