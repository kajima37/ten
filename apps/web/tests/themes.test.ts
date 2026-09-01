import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import {
  THEME_CSS_KEYS,
  THEME_IDS,
  THEMES,
  getThemePalette,
} from '#/lib/themes'

describe('themes', () => {
  it('has a full definition for every theme id', () => {
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

  it('falls back to the classic palette for unknown themes', () => {
    assert.equal(getThemePalette('does-not-exist'), getThemePalette('classic'))
  })
})
