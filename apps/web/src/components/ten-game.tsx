import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DailyScreen } from '#/components/screens/daily-screen'
import { GameScreen } from '#/components/screens/game-screen'
import { HomeScreen } from '#/components/screens/home-screen'
import { MyPage } from '#/components/screens/my-page'
import { ResultScreen } from '#/components/screens/result-screen'
import { StatsScreen } from '#/components/screens/stats-screen'
import { Tutorial } from '#/components/screens/tutorial'
import { BottomNavigation } from '#/components/shared/bottom-navigation'
import type { Screen } from '#/components/shared/screen'
import { useGame } from '#/hooks/use-game'
import { usePlayerProgress } from '#/hooks/use-player'
import type { GameResult } from '#/hooks/use-player'
import { useSettings } from '#/hooks/use-settings'
import { createBackup, parseBackup } from '#/lib/backup'
import { downloadBlob } from '#/lib/download'
import { getLocalDateKey } from '@ten/game-core'
import { STORAGE_KEYS, readStorage } from '#/lib/storage'
import '#/i18n'

export default function TenGame() {
  const { i18n, t } = useTranslation()
  const settings = useSettings()
  const { playerState, saveState, recordResult, resetRecords } =
    usePlayerProgress()
  const [screen, setScreen] = useState<Screen>('home')
  const [toast, setToast] = useState('')
  const [previousBest, setPreviousBest] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)

  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? 'ja'
    document.title = `TEN. — ${t('home.tagline')}`
  }, [i18n.resolvedLanguage, t])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 1100)
  }, [])

  const onFinish = useCallback(
    (result: GameResult) => {
      const outcome = recordResult(result)
      setPreviousBest(outcome.previousBest)
      setIsNewBest(outcome.isNewBest)
      setScreen('result')
      if (outcome.hasNewAchievement) showToast(t('toast.achievementUnlocked'))
    },
    [recordResult, showToast, t],
  )

  const game = useGame({
    vibration: settings.preferences.vibration,
    onToast: showToast,
    onFinish,
  })

  const beginGame = useCallback(
    (daily: boolean) => {
      game.startGame(daily)
      setScreen('game')
    },
    [game.startGame],
  )

  const exportData = () => {
    const backup = createBackup({
      playerState,
      language: i18n.resolvedLanguage === 'en' ? 'en' : 'ja',
      theme: settings.theme,
      preferences: settings.preferences,
      tutorialComplete: readStorage(STORAGE_KEYS.tutorialComplete) === 'true',
    })
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    })
    downloadBlob(blob, `ten-backup-${getLocalDateKey()}.json`)
    showToast(t('toast.dataExported'))
  }

  const importData = async (file: File) => {
    try {
      const backup = parseBackup(
        JSON.parse(await file.text()),
        getLocalDateKey(),
      )
      saveState(backup.playerState)
      settings.setTheme(backup.theme)
      settings.setPreferences(backup.preferences)
      settings.setLanguage(backup.language)
      settings.setTutorialOpen(!backup.tutorialComplete)
      showToast(t('toast.dataImported'))
    } catch {
      showToast(t('toast.dataImportFailed'))
    }
  }

  const average = playerState.plays
    ? Math.round(playerState.total / playerState.plays)
    : 0
  const todayKey = getLocalDateKey()
  const todayDailyRecord = playerState.dailyRecords[todayKey] ?? {
    best: 0,
    plays: 0,
  }

  return (
    <div className="ten-stage mx-auto min-h-svh w-full max-w-[480px] px-3 pb-24 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div key={screen} className="ten-screen-enter">
        {screen === 'home' && (
          <HomeScreen
            onPlay={() => beginGame(false)}
            onRank={() => setScreen('rank')}
          />
        )}
        {screen === 'game' && (
          <GameScreen
            board={game.board}
            boardFeedback={game.boardFeedback}
            boardRevision={game.boardRevision}
            collapseMotions={game.collapseMotions}
            bonusUsed={game.bonusUsed}
            combo={game.combo}
            feedbackId={game.feedbackId}
            hints={game.hints}
            paused={game.paused}
            removing={game.removing}
            reducedMotion={settings.preferences.reducedMotion}
            score={game.score}
            selected={game.selected}
            sum={game.sum}
            timeLeft={game.timeLeft}
            timeLimit={game.timeLimit}
            theme={settings.theme}
            onAddTime={game.addTime}
            onHint={game.useHint}
            onPointerDown={game.selectFirst}
            onPointerEnter={game.extendSelection}
            onShuffle={game.shuffleBoard}
            onTogglePause={game.togglePause}
          />
        )}
        {screen === 'result' && (
          <ResultScreen
            best={playerState.best}
            isNewBest={isNewBest}
            maxCombo={game.maxCombo}
            previousBest={previousBest}
            score={game.score}
            daily={game.dailyMode}
            onToast={showToast}
            onHome={() => setScreen('home')}
            onRetry={() => beginGame(game.dailyMode)}
          />
        )}
        {screen === 'daily' && (
          <DailyScreen
            record={todayDailyRecord}
            streak={playerState.streak}
            onPlay={() => beginGame(true)}
          />
        )}
        {screen === 'rank' && <StatsScreen state={playerState} />}
        {screen === 'mypage' && (
          <MyPage
            average={average}
            state={playerState}
            theme={settings.theme}
            preferences={settings.preferences}
            onPreferencesChange={settings.setPreferences}
            onThemeChange={settings.setTheme}
            onLanguageChange={settings.setLanguage}
            onExport={exportData}
            onImport={importData}
            onResetRecords={() => {
              if (!window.confirm(t('data.resetRecordsConfirm'))) return
              resetRecords()
              showToast(t('toast.recordsReset'))
            }}
            onResetSettings={() => {
              if (!window.confirm(t('data.resetSettingsConfirm'))) return
              settings.resetSettings()
              showToast(t('toast.settingsReset'))
            }}
            onTutorial={() => {
              settings.setTutorialStep(0)
              settings.setTutorialOpen(true)
            }}
            onToast={showToast}
          />
        )}
      </div>

      {screen !== 'game' && screen !== 'result' && (
        <BottomNavigation active={screen} onNavigate={setScreen} />
      )}

      <div
        aria-live="polite"
        className={`ten-toast fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background shadow-xl transition-all ${toast ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
      >
        {toast}
      </div>

      {settings.tutorialOpen && (
        <Tutorial
          step={settings.tutorialStep}
          onBack={() =>
            settings.setTutorialStep((current) => Math.max(0, current - 1))
          }
          onNext={() =>
            settings.setTutorialStep((current) => Math.min(2, current + 1))
          }
          onComplete={settings.completeTutorial}
        />
      )}
    </div>
  )
}
