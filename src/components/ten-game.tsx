import {
  CalendarDays,
  Clock3,
  Crown,
  HelpCircle,
  Home,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import GameBoard from '#/components/game-board'
import { Button } from '#/components/ui/button'

type Screen = 'home' | 'game' | 'result' | 'daily' | 'rank' | 'mypage'

type PlayerState = {
  best: number
  plays: number
  total: number
  dailyBest: number
  streak: number
}

type BoardFeedback = 'success' | 'miss' | null

const GRID_SIZE = 5
const CELL_COUNT = GRID_SIZE * GRID_SIZE
const TARGET = 10
const BASE_TIME = 60
const STORAGE_KEY = 'ten_state'

const initialPlayerState: PlayerState = {
  best: 0,
  plays: 0,
  total: 0,
  dailyBest: 0,
  streak: 1,
}

function randomNumber(random = Math.random) {
  return 1 + Math.floor(random() * 5)
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function makeBoard(daily = false) {
  const today = new Date()
  const dateSeed = Number(
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`,
  )
  const random = daily ? mulberry32(dateSeed) : Math.random
  const next = Array.from({ length: CELL_COUNT }, () => randomNumber(random))

  for (let pair = 0; pair < 5; pair += 1) {
    const row = Math.floor(random() * GRID_SIZE)
    const column = Math.floor(random() * (GRID_SIZE - 1))
    next[row * GRID_SIZE + column] = 5
    next[row * GRID_SIZE + column + 1] = 5
  }

  return next
}

function isAdjacent(first: number, second: number) {
  const firstRow = Math.floor(first / GRID_SIZE)
  const firstColumn = first % GRID_SIZE
  const secondRow = Math.floor(second / GRID_SIZE)
  const secondColumn = second % GRID_SIZE

  return (
    Math.max(
      Math.abs(firstRow - secondRow),
      Math.abs(firstColumn - secondColumn),
    ) === 1
  )
}

function collapseBoard(board: Array<number>, removed: Array<number>) {
  const removedSet = new Set(removed)
  const next = Array<number>(CELL_COUNT)

  for (let column = 0; column < GRID_SIZE; column += 1) {
    const values: Array<number> = []
    for (let row = GRID_SIZE - 1; row >= 0; row -= 1) {
      const index = row * GRID_SIZE + column
      if (!removedSet.has(index)) values.push(board[index])
    }
    while (values.length < GRID_SIZE) values.push(randomNumber())
    for (let row = GRID_SIZE - 1; row >= 0; row -= 1) {
      next[row * GRID_SIZE + column] = values[GRID_SIZE - 1 - row]
    }
  }

  return next
}

function readPlayerState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved
      ? { ...initialPlayerState, ...JSON.parse(saved) }
      : initialPlayerState
  } catch {
    return initialPlayerState
  }
}

function vibrate(duration: number) {
  try {
    navigator.vibrate(duration)
  } catch {
    // Vibration is a progressive enhancement and is unavailable on some browsers.
  }
}

export default function TenGame() {
  const [screen, setScreen] = useState<Screen>('home')
  const [board, setBoard] = useState(() => makeBoard())
  const [selected, setSelected] = useState<Array<number>>([])
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
  const [playerState, setPlayerState] = useState(readPlayerState)
  const [previousBest, setPreviousBest] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const [toast, setToast] = useState('')
  const [boardFeedback, setBoardFeedback] = useState<BoardFeedback>(null)
  const [feedbackId, setFeedbackId] = useState(0)
  const finishedRef = useRef(false)
  const lastTickRef = useRef(0)

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

    const next = {
      ...playerState,
      best: Math.max(playerState.best, score),
      plays: playerState.plays + 1,
      total: playerState.total + score,
      dailyBest: dailyMode
        ? Math.max(playerState.dailyBest, score)
        : playerState.dailyBest,
    }
    saveState(next)
    setScreen('result')
  }, [dailyMode, playerState, saveState, score])

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
      setBoard((current) => collapseBoard(current, selected))
      setSelected([])
      setBoardFeedback('success')
      setFeedbackId((current) => current + 1)
      showToast(nextCombo >= 3 ? `COMBO ×${nextCombo}  +${gain}` : `+${gain}`)
      vibrate(18)
      return
    }

    setCombo(0)
    if (selected.length > 1) {
      setBoardFeedback('miss')
      setFeedbackId((current) => current + 1)
    }
    setSelected([])
  }, [combo, dragging, selected, showToast, sum])

  useEffect(() => {
    window.addEventListener('pointerup', resolveSelection)
    window.addEventListener('pointercancel', resolveSelection)
    return () => {
      window.removeEventListener('pointerup', resolveSelection)
      window.removeEventListener('pointercancel', resolveSelection)
    }
  }, [resolveSelection])

  const startGame = useCallback((daily: boolean) => {
    setDailyMode(daily)
    setBoard(makeBoard(daily))
    setSelected([])
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
    if (!running || paused) return
    setDragging(true)
    setSelected([index])
    vibrate(5)
  }

  const extendSelection = (index: number) => {
    if (!running || paused || !dragging) return
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
    if (hints <= 0) return showToast('ヒントを使い切りました')
    for (let first = 0; first < board.length; first += 1) {
      for (let second = first + 1; second < board.length; second += 1) {
        if (
          isAdjacent(first, second) &&
          board[first] + board[second] === TARGET
        ) {
          setHints((current) => current - 1)
          setSelected([first, second])
          window.setTimeout(() => setSelected([]), 900)
          return
        }
      }
    }
    showToast('組み合わせが見つかりません')
  }

  const shuffleBoard = () => {
    if (!running || paused) return
    if (score < 50) return showToast('スコア50から使えます')
    setScore((current) => current - 50)
    setSelected([])
    setBoard((current) => [...current].sort(() => Math.random() - 0.5))
    showToast('SHUFFLE −50')
  }

  const addTime = () => {
    if (!running || paused || bonusUsed) return
    setBonusUsed(true)
    setTimeLimit((current) => current + 10)
    setTimeLeft((current) => current + 10)
    showToast('+10秒！')
  }

  const average = playerState.plays
    ? Math.round(playerState.total / playerState.plays)
    : 0
  const rankPercent = Math.max(
    1,
    Math.min(99, Math.round(100 - playerState.best / 220)),
  )

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
            bonusUsed={bonusUsed}
            combo={combo}
            feedbackId={feedbackId}
            hints={hints}
            paused={paused}
            score={score}
            selected={selected}
            sum={sum}
            timeLeft={timeLeft}
            timeLimit={timeLimit}
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
            onHome={() => setScreen('home')}
            onRetry={() => startGame(dailyMode)}
          />
        )}
        {screen === 'daily' && (
          <DailyScreen state={playerState} onPlay={() => startGame(true)} />
        )}
        {screen === 'rank' && (
          <RankScreen best={playerState.best} percent={rankPercent} />
        )}
        {screen === 'mypage' && (
          <MyPage average={average} state={playerState} onToast={showToast} />
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
  return (
    <section className="flex min-h-[78svh] flex-col items-center justify-center text-center">
      <div className="ten-logo mb-3 text-6xl font-black tracking-[0.13em]">
        TEN.
      </div>
      <p className="text-[11px] tracking-[0.22em] text-muted-foreground">
        MAKE 10. BEAT YOUR BEST.
      </p>
      <Button
        className="mt-20 h-14 w-4/5 max-w-80 rounded-full text-base font-black"
        onClick={onPlay}
      >
        PLAY
      </Button>
      <Button
        variant="ghost"
        className="mt-5 gap-2 text-xs text-muted-foreground"
        onClick={onRank}
      >
        <Crown className="size-4" /> RANKING
      </Button>
    </section>
  )
}

type GameScreenProps = {
  board: Array<number>
  boardFeedback: BoardFeedback
  feedbackId: number
  selected: Array<number>
  score: number
  combo: number
  timeLeft: number
  timeLimit: number
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
            <Play className="size-4" />
          ) : (
            <Pause className="size-4" />
          )}
          <span className="sr-only">{props.paused ? '再開' : '一時停止'}</span>
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 px-1">
        <Stat
          label="SCORE"
          value={props.score.toLocaleString()}
          pulseKey={props.score}
        />
        <Stat
          label="COMBO"
          value={`×${props.combo}`}
          accent
          pulseKey={props.combo}
        />
        <Stat
          label="TIME"
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
          disabled={props.paused}
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
              <Play className="size-5" /> PAUSED
            </span>
          </button>
        )}
      </div>
      <div className="mt-3 rounded-2xl border bg-card px-5 py-3 text-center text-sm">
        合計 <strong className="mx-1 text-xl">{props.sum}</strong> → あと{' '}
        <strong className="mx-1 text-xl text-accent">
          {Math.max(0, TARGET - props.sum)}
        </strong>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <ActionButton
          icon={Shuffle}
          label="シャッフル"
          detail="−50"
          onClick={props.onShuffle}
        />
        <ActionButton
          icon={Lightbulb}
          label="ヒント"
          detail={String(props.hints)}
          onClick={props.onHint}
        />
        <ActionButton
          icon={Clock3}
          label="+10秒"
          detail={props.bonusUsed ? '使用済み' : '1回'}
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
  icon: typeof Shuffle
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
      <Icon className="size-5" />
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
  onRetry,
  onHome,
}: {
  score: number
  best: number
  previousBest: number
  maxCombo: number
  isNewBest: boolean
  onRetry: () => void
  onHome: () => void
}) {
  const delta = score - previousBest
  const percent = Math.max(1, Math.min(99, Math.round(100 - score / 220)))
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          onClick={onHome}
        >
          <Home className="size-4" />
        </Button>
        <strong className="tracking-[0.16em]">RESULT</strong>
        <div className="size-9" />
      </div>
      <div className="rounded-3xl border bg-card p-7 text-center">
        <Crown
          className={`result-crown mx-auto mb-2 size-8 text-accent ${isNewBest ? 'is-new-best' : ''}`}
        />
        <p className="text-xs font-bold tracking-[0.16em] text-accent">
          {isNewBest ? 'NEW BEST!' : 'RESULT'}
        </p>
        <p className="my-3 text-6xl font-black tabular-nums">
          {score.toLocaleString()}
        </p>
        <p className="text-sm text-muted-foreground">
          BEST SCORE · {best.toLocaleString()}
        </p>
      </div>
      <div className="my-3 rounded-3xl border bg-card px-5">
        <Metric
          label="前回ベストより"
          value={`${delta >= 0 ? '+' : ''}${delta.toLocaleString()}`}
          accent
        />
        <Metric label="全国順位（目安）" value={`上位 ${percent}%`} />
        <Metric label="最高コンボ" value={`×${maxCombo}`} />
      </div>
      <Button
        className="h-13 w-full rounded-full text-base font-black"
        onClick={onRetry}
      >
        <RotateCcw className="mr-2 size-4" /> もう一度プレイ
      </Button>
      <Button
        variant="secondary"
        className="mt-2 h-13 w-full rounded-full"
        onClick={onHome}
      >
        ホームへ
      </Button>
    </section>
  )
}

function DailyScreen({
  state,
  onPlay,
}: {
  state: PlayerState
  onPlay: () => void
}) {
  const today = new Date()
  const date = today
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase()
  return (
    <section>
      <ScreenTitle title="TODAY'S TEN." icon={HelpCircle} />
      <div className="rounded-3xl border bg-card p-6 text-center">
        <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">
          {date}
        </span>
        <div className="mx-auto my-5 grid size-36 place-items-center rounded-full border border-dashed border-muted-foreground text-5xl font-black shadow-[inset_0_0_0_10px_rgba(255,255,255,0.02)]">
          10
        </div>
        <p className="text-sm text-muted-foreground">今日のTEN.に挑戦しよう</p>
      </div>
      <div className="my-3 rounded-3xl border bg-card px-5">
        <Metric
          label="今日の記録"
          value={state.dailyBest.toLocaleString()}
          accent
        />
        <Metric
          label="全国順位"
          value={
            state.dailyBest
              ? `上位 ${Math.max(1, Math.round(100 - state.dailyBest / 220))}%`
              : '未挑戦'
          }
        />
        <Metric label="連続プレイ" value={`${state.streak}日 🔥`} />
      </div>
      <Button
        className="h-13 w-full rounded-full text-base font-black"
        onClick={onPlay}
      >
        プレイする
      </Button>
    </section>
  )
}

function RankScreen({ best, percent }: { best: number; percent: number }) {
  return (
    <section>
      <ScreenTitle title="RANKING" icon={Crown} />
      <div className="rounded-3xl border bg-card px-5">
        <Metric label="🥇 1" value="18,430" />
        <Metric label="🥈 2" value="17,960" />
        <Metric label="🥉 3" value="17,240" />
        <Metric label="あなた" value={best.toLocaleString()} accent />
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        現在は表示サンプルです · あなたは上位 {percent}%
      </p>
    </section>
  )
}

function MyPage({
  average,
  state,
  onToast,
}: {
  average: number
  state: PlayerState
  onToast: (message: string) => void
}) {
  const [theme, setTheme] = useState(0)
  const themes = ['CLASSIC', 'MIDNIGHT', 'CAFE', 'SAKURA', 'ZEN']
  return (
    <section>
      <ScreenTitle title="MY PAGE" icon={UserRound} />
      <div className="rounded-3xl border bg-card p-6 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-b from-zinc-500 to-zinc-900">
          <UserRound className="size-8" />
        </div>
        <h2 className="mt-3 font-bold">Player</h2>
      </div>
      <div className="my-3 rounded-3xl border bg-card px-5">
        <Metric label="♛ 最高得点" value={state.best.toLocaleString()} />
        <Metric label="🏆 総プレイ回数" value={String(state.plays)} />
        <Metric label="★ 平均スコア" value={average.toLocaleString()} />
        <Metric label="🔥 連続プレイ日数" value={`${state.streak}日`} />
      </div>
      <div className="rounded-3xl border bg-card p-5">
        <strong>テーマ</strong>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {themes.map((name, index) => (
            <button
              key={name}
              className={`aspect-[3/4] rounded-xl border ${index === theme ? 'ring-2 ring-accent' : ''}`}
              style={{
                background: [
                  '#242426',
                  '#111522',
                  '#352e24',
                  '#3a2630',
                  '#272c2d',
                ][index],
              }}
              onClick={() => {
                setTheme(index)
                onToast(`${name} を選択しました`)
              }}
            >
              <span className="sr-only">{name}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2 text-center text-[7px] text-muted-foreground">
          {themes.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between border-b py-4 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
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
  icon: typeof Crown
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <strong className="tracking-[0.13em]">{title}</strong>
      <Icon className="size-5 text-muted-foreground" />
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
  const items = [
    { screen: 'home' as const, label: 'ホーム', icon: Home },
    { screen: 'daily' as const, label: 'デイリー', icon: CalendarDays },
    { screen: 'rank' as const, label: 'ランキング', icon: Crown },
    { screen: 'mypage' as const, label: 'マイページ', icon: UserRound },
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
          />
          {label}
        </button>
      ))}
    </nav>
  )
}
