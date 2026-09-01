import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { initialPreferences, normalizePreferences } from '#/lib/preferences'
import type { Preferences } from '#/lib/preferences'
import {
  STORAGE_KEYS,
  readJson,
  readStorage,
  removeStorage,
  writeJson,
  writeStorage,
} from '#/lib/storage'
import { THEME_IDS } from '#/lib/themes'
import type { ThemeId } from '#/lib/themes'

function readTheme(): ThemeId {
  const saved = readStorage(STORAGE_KEYS.theme)
  return THEME_IDS.includes(saved as ThemeId) ? (saved as ThemeId) : 'classic'
}

function readPreferences(): Preferences {
  const saved = readJson<unknown>(STORAGE_KEYS.preferences)
  return saved ? normalizePreferences(saved) : initialPreferences
}

export type SupportedLanguage = 'ja' | 'en'

export function useSettings() {
  const { i18n } = useTranslation()
  const [theme, setThemeState] = useState<ThemeId>(readTheme)
  const [preferences, setPreferencesState] = useState(readPreferences)
  const [tutorialOpen, setTutorialOpen] = useState(
    () => readStorage(STORAGE_KEYS.tutorialComplete) !== 'true',
  )
  const [tutorialStep, setTutorialStep] = useState(0)

  useEffect(() => {
    const saved = readStorage(STORAGE_KEYS.language)
    const preferred =
      saved ?? (navigator.language.startsWith('en') ? 'en' : 'ja')
    void i18n.changeLanguage(preferred)
  }, [i18n])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStorage(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(
      preferences.reducedMotion,
    )
    writeJson(STORAGE_KEYS.preferences, preferences)
  }, [preferences])

  const setTheme = useCallback((next: ThemeId) => setThemeState(next), [])
  const setPreferences = useCallback(
    (next: Preferences) => setPreferencesState(next),
    [],
  )

  const setLanguage = useCallback(
    (language: SupportedLanguage) => {
      writeStorage(STORAGE_KEYS.language, language)
      void i18n.changeLanguage(language)
    },
    [i18n],
  )

  const completeTutorial = useCallback(() => {
    writeStorage(STORAGE_KEYS.tutorialComplete, 'true')
    setTutorialOpen(false)
  }, [])

  const resetSettings = useCallback(() => {
    removeStorage(STORAGE_KEYS.language)
    removeStorage(STORAGE_KEYS.theme)
    removeStorage(STORAGE_KEYS.preferences)
    removeStorage(STORAGE_KEYS.tutorialComplete)
    setThemeState('classic')
    setPreferencesState(initialPreferences)
    setTutorialStep(0)
    setTutorialOpen(true)
    const preferred = navigator.language.startsWith('en') ? 'en' : 'ja'
    void i18n.changeLanguage(preferred)
  }, [i18n])

  return {
    theme,
    setTheme,
    preferences,
    setPreferences,
    tutorialOpen,
    setTutorialOpen,
    tutorialStep,
    setTutorialStep,
    setLanguage,
    completeTutorial,
    resetSettings,
  }
}
