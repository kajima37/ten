import {
  ArrowCounterClockwise,
  CalendarBlank,
  CheckCircle,
  Clock,
  Crown,
  Fire,
  House,
  Lightbulb,
  LockSimple,
  Pause,
  Play,
  Question,
  ShareFat,
  Shuffle,
  Star,
  Trophy,
  UserCircle,
} from '@phosphor-icons/react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { ScreenOrientation } from '@capacitor/screen-orientation'

import GameBoard from '#/components/game-board'
import { Button } from '#/components/ui/button'
import { ACHIEVEMENT_IDS, getUnlockedAchievements } from '#/lib/achievements'
import {
  TARGET,
  collapseBoard,
  createDailyRandom,
  findCombination,
  getLocalDateKey,
  getNextStreak,
  isAdjacent,
  makeBoard,
  shuffleWithRandom,
} from '#/lib/game-logic'
import { initialPlayerState, migratePlayerState } from '#/lib/player-state'
import type { DailyRecord, PlayerState } from '#/lib/player-state'
import '#/i18n'

type Screen = 'home' | 'game' | 'result' | 'daily' | 'rank' | 'mypage'

type BoardFeedback = 'success' | 'miss' | null

const BASE_TIME = 60
const STORAGE_KEY = 'ten_state'
const LANGUAGE_KEY = 'ten_language'
const THEME_KEY = 'ten_theme'
const TUTORIAL_KEY = 'ten_tutorial_complete'
const THEME_IDS = [
  'classic',
  'midnight',
  'cafe',
  'sakura',
  'zen',
  'neon',
] as const
type ThemeId = (typeof THEME_IDS)[number]

function readPlayerState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved
      ? migratePlayerState(JSON.parse(saved), getLocalDateKey())
      : initialPlayerState
  } catch {
    return initialPlayerState
  }
}

function readTheme(): ThemeId {
  const saved = window.localStorage.getItem(THEME_KEY)
  return THEME_IDS.includes(saved as ThemeId) ? (saved as ThemeId) : 'classic'
}

function vibrate(duration: number) {
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({
      style: duration > 10 ? ImpactStyle.Medium : ImpactStyle.Light,
    }).catch(() => undefined)
    return
  }

  try {
    navigator.vibrate(duration)
  } catch {
    // Vibration is a progressive enhancement and is unavailable on some browsers.
  }
}

function createResultImage({
  score,
  best,
  maxCombo,
  daily,
  labels,
}: {
  score: number
  best: number
  maxCombo: number
  daily: boolean
  labels: { result: string; best: string; combo: string; daily: string }
}) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')

  const styles = getComputedStyle(document.documentElement)
  const background = styles.getPropertyValue('--background').trim() || '#09090a'
  const foreground = styles.getPropertyValue('--foreground').trim() || '#f6f3ed'
  const card = styles.getPropertyValue('--card').trim() || '#121214'
  const accent = styles.getPropertyValue('--accent').trim() || '#f3c75f'
  const muted =
    styles.getPropertyValue('--muted-foreground').trim() || '#9f9c95'

  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  const gradient = context.createRadialGradient(600, 0, 20, 600, 0, 620)
  gradient.addColorStop(0, accent)
  gradient.addColorStop(1, 'transparent')
  context.globalAlpha = 0.16
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.globalAlpha = 1

  context.fillStyle = card
  context.beginPath()
  context.roundRect(90, 75, 1020, 480, 42)
  context.fill()

  context.textAlign = 'center'
  context.fillStyle = foreground
  context.font = '900 64px Arial, sans-serif'
  context.fillText('TEN.', 600, 165)
  context.fillStyle = accent
  context.font = '700 28px Arial, sans-serif'
  context.fillText(daily ? labels.daily : labels.result, 600, 220)
  context.font = '900 132px Arial, sans-serif'
  context.fillText(score.toLocaleString(), 600, 370)

  context.fillStyle = muted
  context.font = '600 26px Arial, sans-serif'
  context.fillText(
    `${labels.best} ${best.toLocaleString()}    ·    ${labels.combo} ×${maxCombo}`,
    600,
    450,
  )
  context.fillStyle = foreground
  context.font = '600 22px Arial, sans-serif'
  context.fillText('MAKE 10. BEAT YOUR BEST.', 600, 510)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not create image'))
    }, 'image/png')
  })
}

export default function TenGame() {
  const { i18n, t } = useTranslation()
  const [screen, setScreen] = useState<Screen>('home')
  const [board, setBoard] = useState(() => makeBoard())
  const [selected, setSelected] = useState<Array<number>>([])
  const [removing, setRemoving] = useState<Array<number>>([])
  const [boardRevision, setBoardRevision] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [timeLeft, setTimeLeft] = useState(BASE_TIME)
  const [timeLimit, setTimeLimit] = useState(BASE_TIME)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [hints, setHints] = useState(3)
  const [bonusUsed, setBonusUsed] = useState(false)
  const [dailyMode, setDailyMode] = useState(false)
  const [dailyKey, setDailyKey] = useState(getLocalDateKey)
  const [playerState, setPlayerState] = useState(readPlayerState)
  const [theme, setTheme] = useState<ThemeId>(readTheme)
  const [previousBest, setPreviousBest] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const [toast, setToast] = useState('')
  const [boardFeedback, setBoardFeedback] = useState<BoardFeedback>(null)
  const [feedbackId, setFeedbackId] = useState(0)
  const [tutorialOpen, setTutorialOpen] = useState(
    () => window.localStorage.getItem(TUTORIAL_KEY) !== 'true',
  )
  const [tutorialStep, setTutorialStep] = useState(0)
  const finishedRef = useRef(false)
  const lastTickRef = useRef(0)
  const boardRandomRef = useRef<() => number>(Math.random)

  useEffect(() => {
    const saved = window.localStorage.getItem(LANGUAGE_KEY)
    const preferred =
      saved ?? (navigator.language.startsWith('en') ? 'en' : 'ja')
    void i18n.changeLanguage(preferred)
  }, [i18n])

  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? 'ja'
    document.title = `TEN. — ${t('home.tagline')}`
  }, [i18n.resolvedLanguage, t])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    void ScreenOrientation.lock({ orientation: 'portrait' }).catch(
      () => undefined,
    )

    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) setPaused(true)
    })

    return () => {
      void listener.then((handle) => handle.remove())
    }
  }, [])

  const sum = useMemo(
    () => selected.reduce((total, index) => total + board[index], 0),
    [board, selected],
  )

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 1100)
  }, [])

  const saveState = useCallback((next: PlayerState) => {
    setPlayerState(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const finishGame = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setRunning(false)
    setPaused(false)
    setDragging(false)
    setPreviousBest(playerState.best)
    setIsNewBest(score > playerState.best)

    const currentDailyRecord = playerState.dailyRecords[dailyKey] ?? {
      best: 0,
      plays: 0,
    }
    const nextStreak = dailyMode
      ? getNextStreak(playerState.streak, playerState.lastDailyDate, dailyKey)
      : playerState.streak
    const nextBase: PlayerState = {
      ...playerState,
      best: Math.max(playerState.best, score),
      plays: playerState.plays + 1,
      total: playerState.total + score,
      dailyRecords: dailyMode
        ? {
            ...playerState.dailyRecords,
            [dailyKey]: {
              best: Math.max(currentDailyRecord.best, score),
              plays: currentDailyRecord.plays + 1,
            },
          }
        : playerState.dailyRecords,
      streak: nextStreak,
      lastDailyDate: dailyMode ? dailyKey : playerState.lastDailyDate,
      history: [
        {
          id: `${Date.now()}-${playerState.plays + 1}`,
          playedAt: new Date().toISOString(),
          score,
          maxCombo,
          daily: dailyMode,
          durationSeconds: Math.round(timeLimit),
        },
        ...playerState.history,
      ].slice(0, 100),
      unlockedAchievements: playerState.unlockedAchievements,
    }
    const unlockedAchievements = getUnlockedAchievements(nextBase)
    const hasNewAchievement =
      unlockedAchievements.length > playerState.unlockedAchievements.length
    const next = { ...nextBase, unlockedAchievements }
    saveState(next)
    setScreen('result')
    if (hasNewAchievement) showToast(t('toast.achievementUnlocked'))
  }, [
    dailyKey,
    dailyMode,
    maxCombo,
    playerState,
    saveState,
    score,
    showToast,
    t,
    timeLimit,
  ])

  useEffect(() => {
    if (!running || paused) return
    lastTickRef.current = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = (now - lastTickRef.current) / 1000
      lastTickRef.current = now
      setTimeLeft((current) => Math.max(0, current - delta))
    }, 50)

    return () => window.clearInterval(timer)
  }, [paused, running])

  useEffect(() => {
    if (running && timeLeft <= 0) finishGame()
  }, [finishGame, running, timeLeft])

  const resolveSelection = useCallback(() => {
    if (!dragging) return
    setDragging(false)

    if (sum === TARGET && selected.length >= 2) {
      const nextCombo = combo + 1
      const gain = selected.length * 100 + Math.max(0, nextCombo - 1) * 50
      setScore((current) => current + gain)
      setCombo(nextCombo)
      setMaxCombo((current) => Math.max(current, nextCombo))
      const removed = [...selected]
      setRemoving(removed)
      setSelected([])
      setBoardFeedback('success')
      setFeedbackId((current) => current + 1)
      showToast(
        nextCombo >= 3
          ? t('toast.combo', { combo: nextCombo, gain })
          : `+${gain}`,
      )
      vibrate(18)
      window.setTimeout(() => {
        setBoard((current) =>
          collapseBoard(current, removed, boardRandomRef.current),
        )
        setBoardRevision((current) => current + 1)
        setRemoving([])
      }, 180)
      return
    }

    setCombo(0)
    if (selected.length > 1) {
      setBoardFeedback('miss')
      setFeedbackId((current) => current + 1)
    }
    setSelected([])
  }, [combo, dragging, selected, showToast, sum, t])

  useEffect(() => {
    window.addEventListener('pointerup', resolveSelection)
    window.addEventListener('pointercancel', resolveSelection)
    return () => {
      window.removeEventListener('pointerup', resolveSelection)
      window.removeEventListener('pointercancel', resolveSelection)
    }
  }, [resolveSelection])

  const startGame = useCallback((daily: boolean) => {
    const nextDailyKey = getLocalDateKey()
    const random = daily ? createDailyRandom(nextDailyKey) : Math.random
    boardRandomRef.current = random
    setDailyMode(daily)
    setDailyKey(nextDailyKey)
    setBoard(makeBoard(random))
    setSelected([])
    setRemoving([])
    setBoardRevision((current) => current + 1)
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setTimeLeft(BASE_TIME)
    setTimeLimit(BASE_TIME)
    setHints(3)
    setBonusUsed(false)
    setPaused(false)
    setDragging(false)
    setBoardFeedback(null)
    finishedRef.current = false
    setScreen('game')
    setRunning(true)
  }, [])

  const selectFirst = (index: number) => {
    if (!running || paused || removing.length) return
    setDragging(true)
    setSelected([index])
    vibrate(5)
  }

  const extendSelection = (index: number) => {
    if (!running || paused || !dragging || removing.length) return
    setSelected((current) => {
      if (!current.length || current.at(-1) === index) return current
      if (current.length > 1 && current.at(-2) === index)
        return current.slice(0, -1)
      const last = current.at(-1)
      if (
        last !== undefined &&
        !current.includes(index) &&
        isAdjacent(last, index)
      ) {
        vibrate(5)
        return [...current, index]
      }
      return current
    })
  }

  const useHint = () => {
    if (!running || paused) return
    if (hints <= 0) return showToast(t('toast.hintsEmpty'))
    const combination = findCombination(board)
    if (combination) {
      setHints((current) => current - 1)
      setSelected(combination)
      window.setTimeout(() => setSelected([]), 900)
      return
    }
    showToast(t('toast.noMatch'))
  }

  const shuffleBoard = () => {
    if (!running || paused) return
    if (score < 50) return showToast(t('toast.shuffleLocked'))
    setScore((current) => current - 50)
    setSelected([])
    setBoard((current) => shuffleWithRandom(current, boardRandomRef.current))
    setBoardRevision((current) => current + 1)
    showToast(t('toast.shuffled'))
  }

  const addTime = () => {
    if (!running || paused || bonusUsed) return
    setBonusUsed(true)
    setTimeLimit((current) => current + 10)
    setTimeLeft((current) => current + 10)
    showToast(t('toast.timeAdded'))
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
            onPlay={() => startGame(false)}
            onRank={() => setScreen('rank')}
          />
        )}
        {screen === 'game' && (
          <GameScreen
            board={board}
            boardFeedback={boardFeedback}
            boardRevision={boardRevision}
            bonusUsed={bonusUsed}
            combo={combo}
            feedbackId={feedbackId}
            hints={hints}
            paused={paused}
            removing={removing}
            score={score}
            selected={selected}
            sum={sum}
            timeLeft={timeLeft}
            timeLimit={timeLimit}
            theme={theme}
            onAddTime={addTime}
            onHint={useHint}
            onPointerDown={selectFirst}
            onPointerEnter={extendSelection}
            onShuffle={shuffleBoard}
            onTogglePause={() => setPaused((current) => !current)}
          />
        )}
        {screen === 'result' && (
          <ResultScreen
            best={playerState.best}
            isNewBest={isNewBest}
            maxCombo={maxCombo}
            previousBest={previousBest}
            score={score}
            daily={dailyMode}
            onToast={showToast}
            onHome={() => setScreen('home')}
            onRetry={() => startGame(dailyMode)}
          />
        )}
        {screen === 'daily' && (
          <DailyScreen
            record={todayDailyRecord}
            streak={playerState.streak}
            onPlay={() => startGame(true)}
          />
        )}
        {screen === 'rank' && <StatsScreen state={playerState} />}
        {screen === 'mypage' && (
          <MyPage
            average={average}
            state={playerState}
            theme={theme}
            onThemeChange={setTheme}
            onTutorial={() => {
              setTutorialStep(0)
              setTutorialOpen(true)
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

      {tutorialOpen && (
        <Tutorial
          step={tutorialStep}
          onBack={() => setTutorialStep((current) => Math.max(0, current - 1))}
          onNext={() => setTutorialStep((current) => Math.min(2, current + 1))}
          onComplete={() => {
            window.localStorage.setItem(TUTORIAL_KEY, 'true')
            setTutorialOpen(false)
          }}
        />
      )}
    </div>
  )
}

function HomeScreen({
  onPlay,
  onRank,
}: {
  onPlay: () => void
  onRank: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="flex min-h-[78svh] flex-col items-center justify-center text-center">
      <div className="ten-logo mb-3 text-6xl font-black tracking-[0.13em]">
        TEN.
      </div>
      <p className="text-[11px] tracking-[0.22em] text-muted-foreground">
        {t('home.tagline')}
      </p>
      <Button
        className="mt-20 h-14 w-4/5 max-w-80 rounded-full text-base font-black"
        onClick={onPlay}
      >
        {t('home.play')}
      </Button>
      <Button
        variant="ghost"
        className="mt-5 gap-2 text-xs text-muted-foreground"
        onClick={onRank}
      >
        <Crown className="size-4" weight="bold" /> {t('home.ranking')}
      </Button>
    </section>
  )
}

type GameScreenProps = {
  board: Array<number>
  boardFeedback: BoardFeedback
  boardRevision: number
  feedbackId: number
  selected: Array<number>
  removing: Array<number>
  score: number
  combo: number
  timeLeft: number
  timeLimit: number
  theme: ThemeId
  sum: number
  hints: number
  bonusUsed: boolean
  paused: boolean
  onPointerDown: (index: number) => void
  onPointerEnter: (index: number) => void
  onTogglePause: () => void
  onShuffle: () => void
  onHint: () => void
  onAddTime: () => void
}

function GameScreen(props: GameScreenProps) {
  const { t } = useTranslation()

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <strong className="tracking-[0.15em]">TEN.</strong>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          onClick={props.onTogglePause}
        >
          {props.paused ? (
            <Play className="size-4" weight="fill" />
          ) : (
            <Pause className="size-4" weight="fill" />
          )}
          <span className="sr-only">
            {props.paused ? t('game.resume') : t('game.pause')}
          </span>
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 px-1">
        <Stat
          label={t('game.score')}
          value={props.score.toLocaleString()}
          pulseKey={props.score}
        />
        <Stat
          label={t('game.combo')}
          value={`×${props.combo}`}
          accent
          pulseKey={props.combo}
        />
        <Stat
          label={t('game.time')}
          value={props.timeLeft.toFixed(1)}
          urgent={props.timeLeft <= 10}
        />
      </div>
      <div className="my-3 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-gradient-to-r from-accent to-[#fff0aa] transition-[width] duration-75"
          style={{
            width: `${Math.min(100, (props.timeLeft / props.timeLimit) * 100)}%`,
          }}
        />
      </div>
      <div className="game-board-shell relative overflow-hidden rounded-[1.7rem] border bg-card p-3 shadow-2xl shadow-black/60 touch-none select-none">
        <GameBoard
          board={props.board}
          selected={props.selected}
          removing={props.removing}
          revision={props.boardRevision}
          disabled={props.paused || props.removing.length > 0}
          theme={props.theme}
          onPointerDown={props.onPointerDown}
          onPointerEnter={props.onPointerEnter}
        />
        {props.boardFeedback && (
          <div
            key={props.feedbackId}
            className={`game-board-feedback is-${props.boardFeedback}`}
            aria-hidden="true"
          >
            {props.boardFeedback === 'success' && (
              <div className="ten-sparks">
                {Array.from({ length: 8 }, (_, index) => (
                  <i key={index} />
                ))}
              </div>
            )}
          </div>
        )}
        {props.paused && (
          <button
            className="absolute inset-3 grid place-items-center rounded-2xl bg-black/75 backdrop-blur-sm"
            onClick={props.onTogglePause}
          >
            <span className="flex items-center gap-2 font-black tracking-[0.18em]">
              <Play className="size-5" weight="fill" /> {t('game.paused')}
            </span>
          </button>
        )}
      </div>
      <div className="mt-3 rounded-2xl border bg-card px-5 py-3 text-center text-sm">
        {t('game.sum')} <strong className="mx-1 text-xl">{props.sum}</strong> →{' '}
        <strong className="mx-1 text-xl text-accent">
          {t('game.remaining', { count: Math.max(0, TARGET - props.sum) })}
        </strong>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <ActionButton
          icon={Shuffle}
          label={t('game.shuffle')}
          detail="−50"
          onClick={props.onShuffle}
        />
        <ActionButton
          icon={Lightbulb}
          label={t('game.hint')}
          detail={String(props.hints)}
          onClick={props.onHint}
        />
        <ActionButton
          icon={Clock}
          label={t('game.secondsBonus')}
          detail={props.bonusUsed ? t('game.used') : t('game.once')}
          disabled={props.bonusUsed}
          onClick={props.onAddTime}
        />
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  accent = false,
  pulseKey,
  urgent = false,
}: {
  label: string
  value: string
  accent?: boolean
  pulseKey?: number
  urgent?: boolean
}) {
  return (
    <div>
      <span className="block text-[9px] tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <strong
        key={pulseKey}
        className={`stat-value block text-xl tabular-nums ${accent ? 'text-accent' : ''} ${urgent ? 'is-urgent' : ''}`}
      >
        {value}
      </strong>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  detail,
  disabled = false,
  onClick,
}: {
  icon: PhosphorIcon
  label: string
  detail: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="secondary"
      className="h-auto min-h-16 flex-col gap-1 rounded-2xl border px-2 py-2 text-[11px]"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="size-5" weight="bold" />
      <span>{label}</span>
      <span className="text-[9px] text-muted-foreground">{detail}</span>
    </Button>
  )
}

function ResultScreen({
  score,
  best,
  previousBest,
  maxCombo,
  isNewBest,
  daily,
  onRetry,
  onHome,
  onToast,
}: {
  score: number
  best: number
  previousBest: number
  maxCombo: number
  isNewBest: boolean
  daily: boolean
  onRetry: () => void
  onHome: () => void
  onToast: (message: string) => void
}) {
  const { t } = useTranslation()
  const [sharing, setSharing] = useState(false)
  const delta = score - previousBest
  const percent = Math.max(1, Math.min(99, Math.round(100 - score / 220)))

  const shareResult = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const blob = await createResultImage({
        score,
        best,
        maxCombo,
        daily,
        labels: {
          result: t('result.title'),
          best: t('profile.best'),
          combo: t('result.maxCombo'),
          daily: t('daily.title'),
        },
      })
      const file = new File([blob], `ten-score-${getLocalDateKey()}.png`, {
        type: 'image/png',
      })

      if (
        Reflect.has(navigator, 'share') &&
        Reflect.has(navigator, 'canShare') &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: t('result.shareTitle'),
          text: t('result.shareMessage', { score: score.toLocaleString() }),
          files: [file],
        })
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
      onToast(t('toast.shareDownloaded'))
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        onToast(t('toast.shareFailed'))
      }
    } finally {
      setSharing(false)
    }
  }
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          onClick={onHome}
        >
          <House className="size-4" weight="bold" />
        </Button>
        <strong className="tracking-[0.16em]">{t('result.title')}</strong>
        <div className="size-9" />
      </div>
      <div className="rounded-3xl border bg-card p-7 text-center">
        <Crown
          className={`result-crown mx-auto mb-2 size-8 text-accent ${isNewBest ? 'is-new-best' : ''}`}
          weight="fill"
        />
        <p className="text-xs font-bold tracking-[0.16em] text-accent">
          {isNewBest ? t('result.newBest') : t('result.title')}
        </p>
        <p className="my-3 text-6xl font-black tabular-nums">
          {score.toLocaleString()}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('result.bestScore', { score: best.toLocaleString() })}
        </p>
      </div>
      <div className="my-3 rounded-3xl border bg-card px-5">
        <Metric
          label={t('result.versusBest')}
          value={`${delta >= 0 ? '+' : ''}${delta.toLocaleString()}`}
          accent
        />
        <Metric
          label={t('result.nationalRank')}
          value={t('result.topPercent', { percent })}
        />
        <Metric label={t('result.maxCombo')} value={`×${maxCombo}`} />
      </div>
      <Button
        className="h-13 w-full rounded-full text-base font-black"
        onClick={onRetry}
      >
        <ArrowCounterClockwise className="mr-2 size-4" weight="bold" />
        {t('result.retry')}
      </Button>
      <Button
        variant="secondary"
        className="mt-2 h-13 w-full rounded-full"
        disabled={sharing}
        onClick={() => void shareResult()}
      >
        <ShareFat className="mr-2 size-4" weight="bold" />
        {sharing ? t('result.sharing') : t('result.share')}
      </Button>
      <Button
        variant="secondary"
        className="mt-2 h-13 w-full rounded-full"
        onClick={onHome}
      >
        {t('result.home')}
      </Button>
    </section>
  )
}

function DailyScreen({
  record,
  streak,
  onPlay,
}: {
  record: DailyRecord
  streak: number
  onPlay: () => void
}) {
  const { i18n, t } = useTranslation()
  const today = new Date()
  const date = today
    .toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'ja-JP', {
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase()
  return (
    <section>
      <ScreenTitle title={t('daily.title')} icon={Question} />
      <div className="rounded-3xl border bg-card p-6 text-center">
        <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">
          {date}
        </span>
        <div className="mx-auto my-5 grid size-36 place-items-center rounded-full border border-dashed border-muted-foreground text-5xl font-black shadow-[inset_0_0_0_10px_rgba(255,255,255,0.02)]">
          10
        </div>
        <p className="text-sm text-muted-foreground">{t('daily.invitation')}</p>
      </div>
      <div className="my-3 rounded-3xl border bg-card px-5">
        <Metric
          label={t('daily.record')}
          value={record.best.toLocaleString()}
          accent
        />
        <Metric
          label={t('daily.nationalRank')}
          value={
            record.best
              ? t('result.topPercent', {
                  percent: Math.max(1, Math.round(100 - record.best / 220)),
                })
              : t('daily.notPlayed')
          }
        />
        <Metric label={t('daily.playCount')} value={String(record.plays)} />
        <Metric
          label={t('daily.streak')}
          value={t('daily.days', { count: streak })}
          icon={Fire}
        />
      </div>
      <Button
        className="h-13 w-full rounded-full text-base font-black"
        onClick={onPlay}
      >
        {t('daily.play')}
      </Button>
    </section>
  )
}

function StatsScreen({ state }: { state: PlayerState }) {
  const { i18n, t } = useTranslation()
  const average = state.plays ? Math.round(state.total / state.plays) : 0
  const historyMaxCombo = state.history.reduce(
    (maximum, record) => Math.max(maximum, record.maxCombo),
    0,
  )
  const totalMinutes = Math.round(
    state.history.reduce((total, record) => total + record.durationSeconds, 0) /
      60,
  )

  return (
    <section>
      <ScreenTitle title={t('ranking.title')} icon={Star} />
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label={t('ranking.games')}
          value={state.plays.toLocaleString()}
        />
        <StatCard
          label={t('profile.best')}
          value={state.best.toLocaleString()}
          accent
        />
        <StatCard
          label={t('profile.average')}
          value={average.toLocaleString()}
        />
        <StatCard label={t('ranking.maxCombo')} value={`×${historyMaxCombo}`} />
        <StatCard
          label={t('ranking.playTime')}
          value={t('ranking.minutes', { count: totalMinutes })}
        />
        <StatCard
          label={t('daily.streak')}
          value={t('daily.days', { count: state.streak })}
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold tracking-wide">
        {t('ranking.recent')}
      </h2>
      <div className="rounded-3xl border bg-card px-4">
        {state.history.length ? (
          state.history.slice(0, 10).map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between border-b py-3 last:border-0"
            >
              <div>
                <span className="block text-xs font-bold">
                  {record.daily ? t('daily.title') : t('ranking.normal')}
                </span>
                <time className="text-[10px] text-muted-foreground">
                  {new Date(record.playedAt).toLocaleString(
                    i18n.resolvedLanguage === 'en' ? 'en-US' : 'ja-JP',
                    {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  )}
                </time>
              </div>
              <div className="text-right">
                <strong className="block text-lg tabular-nums">
                  {record.score.toLocaleString()}
                </strong>
                <span className="text-[10px] text-muted-foreground">
                  ×{record.maxCombo}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('ranking.empty')}
          </p>
        )}
      </div>
    </section>
  )
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <strong
        className={`mt-1 block text-xl tabular-nums ${accent ? 'text-accent' : ''}`}
      >
        {value}
      </strong>
    </div>
  )
}

function MyPage({
  average,
  state,
  theme,
  onThemeChange,
  onTutorial,
  onToast,
}: {
  average: number
  state: PlayerState
  theme: ThemeId
  onThemeChange: (theme: ThemeId) => void
  onTutorial: () => void
  onToast: (message: string) => void
}) {
  const { i18n, t } = useTranslation()
  const themes = [
    { id: 'classic', label: t('profile.themes.classic'), color: '#242426' },
    { id: 'midnight', label: t('profile.themes.midnight'), color: '#111b33' },
    { id: 'cafe', label: t('profile.themes.cafe'), color: '#3b281a' },
    { id: 'sakura', label: t('profile.themes.sakura'), color: '#442232' },
    { id: 'zen', label: t('profile.themes.zen'), color: '#26352a' },
    { id: 'neon', label: t('profile.themes.neon'), color: '#251635' },
  ] satisfies Array<{ id: ThemeId; label: string; color: string }>
  return (
    <section>
      <ScreenTitle title={t('profile.title')} icon={UserCircle} />
      <div className="rounded-3xl border bg-card p-6 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-b from-zinc-500 to-zinc-900">
          <UserCircle className="size-8" weight="duotone" />
        </div>
        <h2 className="mt-3 font-bold">{t('profile.player')}</h2>
      </div>
      <div className="my-3 rounded-3xl border bg-card px-5">
        <Metric
          label={t('profile.best')}
          value={state.best.toLocaleString()}
          icon={Crown}
        />
        <Metric
          label={t('profile.plays')}
          value={String(state.plays)}
          icon={Trophy}
        />
        <Metric
          label={t('profile.average')}
          value={average.toLocaleString()}
          icon={Star}
        />
        <Metric
          label={t('profile.streak')}
          value={t('daily.days', { count: state.streak })}
          icon={Fire}
        />
      </div>
      <div className="rounded-3xl border bg-card p-5">
        <strong>{t('profile.theme')}</strong>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {themes.map(({ id, label, color }) => (
            <button
              key={id}
              className={`aspect-[3/4] rounded-xl border ${id === theme ? 'ring-2 ring-accent' : ''}`}
              style={{ background: color }}
              onClick={() => {
                onThemeChange(id)
                onToast(t('toast.themeSelected', { theme: label }))
              }}
            >
              <span className="sr-only">{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-6 gap-2 text-center text-[7px] text-muted-foreground">
          {themes.map(({ id, label }) => (
            <span key={id}>{label}</span>
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-3xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <strong>{t('achievements.title')}</strong>
          <span className="text-xs text-muted-foreground">
            {playerStateAchievementCount(state)} / {ACHIEVEMENT_IDS.length}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ACHIEVEMENT_IDS.map((id) => {
            const unlocked = state.unlockedAchievements.includes(id)
            return (
              <div
                key={id}
                className={`rounded-2xl border p-3 ${unlocked ? 'bg-accent/10' : 'bg-secondary/50 opacity-60'}`}
              >
                {unlocked ? (
                  <CheckCircle
                    className="mb-2 size-5 text-accent"
                    weight="fill"
                  />
                ) : (
                  <LockSimple className="mb-2 size-5 text-muted-foreground" />
                )}
                <strong className="block text-xs">
                  {t(`achievements.items.${id}.title`)}
                </strong>
                <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                  {t(`achievements.items.${id}.description`)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-3 rounded-3xl border bg-card p-5">
        <strong>{t('profile.language')}</strong>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['ja', 'en'] as const).map((language) => {
            const active = i18n.resolvedLanguage === language
            return (
              <Button
                key={language}
                variant={active ? 'default' : 'secondary'}
                className="rounded-full"
                onClick={() => {
                  window.localStorage.setItem(LANGUAGE_KEY, language)
                  void i18n.changeLanguage(language)
                }}
              >
                {t(language === 'ja' ? 'profile.japanese' : 'profile.english')}
              </Button>
            )
          })}
        </div>
      </div>
      <Button
        variant="secondary"
        className="mt-3 h-12 w-full rounded-full"
        onClick={onTutorial}
      >
        <Question className="mr-2 size-4" weight="bold" />
        {t('profile.tutorial')}
      </Button>
    </section>
  )
}

function playerStateAchievementCount(state: PlayerState) {
  return ACHIEVEMENT_IDS.filter((id) => state.unlockedAchievements.includes(id))
    .length
}

function Tutorial({
  step,
  onBack,
  onNext,
  onComplete,
}: {
  step: number
  onBack: () => void
  onNext: () => void
  onComplete: () => void
}) {
  const { t } = useTranslation()
  const content = [
    { title: t('tutorial.connectTitle'), body: t('tutorial.connectBody') },
    { title: t('tutorial.comboTitle'), body: t('tutorial.comboBody') },
    { title: t('tutorial.toolsTitle'), body: t('tutorial.toolsBody') },
  ][step]

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/80 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="w-full max-w-sm rounded-[2rem] border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <strong id="tutorial-title" className="tracking-[0.14em]">
            {t('tutorial.title')}
          </strong>
          <span className="text-xs text-muted-foreground">{step + 1} / 3</span>
        </div>

        <div className="mb-6 grid min-h-48 place-items-center rounded-3xl bg-secondary p-5 text-center">
          {step === 0 && (
            <div
              className="relative flex items-center gap-3"
              aria-hidden="true"
            >
              {[2, 3, 5].map((number, index) => (
                <div key={number} className="flex items-center gap-3">
                  <span className="grid size-14 place-items-center rounded-2xl border-2 border-accent bg-card text-2xl font-black text-accent">
                    {number}
                  </span>
                  {index < 2 && <span className="h-0.5 w-5 bg-accent" />}
                </div>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="text-accent" aria-hidden="true">
              <strong className="block text-5xl">×4</strong>
              <span className="mt-2 block text-sm font-bold tracking-widest">
                COMBO
              </span>
            </div>
          )}
          {step === 2 && (
            <div className="flex gap-5 text-accent" aria-hidden="true">
              <Shuffle className="size-9" weight="duotone" />
              <Lightbulb className="size-9" weight="duotone" />
              <Clock className="size-9" weight="duotone" />
            </div>
          )}
        </div>

        <h2 className="text-center text-xl font-black">{content.title}</h2>
        <p className="mt-2 min-h-12 text-center text-sm leading-relaxed text-muted-foreground">
          {content.body}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="rounded-full"
            disabled={step === 0}
            onClick={onBack}
          >
            {t('tutorial.back')}
          </Button>
          <Button
            className="rounded-full"
            onClick={step === 2 ? onComplete : onNext}
          >
            {step === 2 ? t('tutorial.start') : t('tutorial.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  accent = false,
  icon: Icon,
  iconClassName = '',
}: {
  label: string
  value: string
  accent?: boolean
  icon?: PhosphorIcon
  iconClassName?: string
}) {
  return (
    <div className="flex items-center justify-between border-b py-4 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && (
          <Icon className={`size-4 ${iconClassName}`} weight="duotone" />
        )}
        {label}
      </span>
      <strong className={`text-xl ${accent ? 'text-accent' : ''}`}>
        {value}
      </strong>
    </div>
  )
}

function ScreenTitle({
  title,
  icon: Icon,
}: {
  title: string
  icon: PhosphorIcon
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <strong className="tracking-[0.13em]">{title}</strong>
      <Icon className="size-5 text-muted-foreground" weight="duotone" />
    </div>
  )
}

function BottomNavigation({
  active,
  onNavigate,
}: {
  active: Screen
  onNavigate: (screen: Screen) => void
}) {
  const { t } = useTranslation()
  const items = [
    { screen: 'home' as const, label: t('nav.home'), icon: House },
    { screen: 'daily' as const, label: t('nav.daily'), icon: CalendarBlank },
    { screen: 'rank' as const, label: t('nav.ranking'), icon: Crown },
    { screen: 'mypage' as const, label: t('nav.profile'), icon: UserCircle },
  ]
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-4 border-t bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      {items.map(({ screen, label, icon: Icon }) => (
        <button
          key={screen}
          className={`nav-item flex flex-col items-center gap-1 py-1 text-[9px] ${active === screen ? 'is-active text-foreground' : 'text-muted-foreground'}`}
          onClick={() => onNavigate(screen)}
        >
          <Icon
            className={`size-5 ${active === screen ? 'text-accent' : ''}`}
            weight={active === screen ? 'fill' : 'regular'}
          />
          {label}
        </button>
      ))}
    </nav>
  )
}
