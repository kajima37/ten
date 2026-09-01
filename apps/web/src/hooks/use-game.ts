import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'

import {
  TARGET,
  collapseBoard,
  createDailyRandom,
  findCombination,
  getLocalDateKey,
  getCollapseMotions,
  isAdjacent,
  makeBoard,
  shuffleWithRandom,
} from '@ten/game-core'
import type { CollapseMotion } from '@ten/game-core'
import { vibrate } from '#/lib/haptics'
import type { BoardFeedback } from '#/components/shared/screen'
import type { GameResult } from '#/hooks/use-player'

const BASE_TIME = 60

type UseGameOptions = {
  vibration: boolean
  onToast: (message: string) => void
  onFinish: (result: GameResult) => void
}

export function useGame({ vibration, onToast, onFinish }: UseGameOptions) {
  const { t } = useTranslation()
  const [board, setBoard] = useState(() => makeBoard())
  const [selected, setSelected] = useState<Array<number>>([])
  const [removing, setRemoving] = useState<Array<number>>([])
  const [boardRevision, setBoardRevision] = useState(0)
  const [collapseMotions, setCollapseMotions] = useState<Array<CollapseMotion>>(
    () => getCollapseMotions([]),
  )
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
  const [boardFeedback, setBoardFeedback] = useState<BoardFeedback>(null)
  const [feedbackId, setFeedbackId] = useState(0)
  const finishedRef = useRef(false)
  const lastTickRef = useRef(0)
  const boardRandomRef = useRef<() => number>(Math.random)
  const onFinishRef = useRef(onFinish)

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

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
      onToast(
        nextCombo >= 3
          ? t('toast.combo', { combo: nextCombo, gain })
          : `+${gain}`,
      )
      vibrate(18, vibration)
      window.setTimeout(() => {
        setCollapseMotions(getCollapseMotions(removed))
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
  }, [combo, dragging, onToast, selected, sum, t, vibration])

  useEffect(() => {
    window.addEventListener('pointerup', resolveSelection)
    window.addEventListener('pointercancel', resolveSelection)
    return () => {
      window.removeEventListener('pointerup', resolveSelection)
      window.removeEventListener('pointercancel', resolveSelection)
    }
  }, [resolveSelection])

  const finishGame = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setRunning(false)
    setPaused(false)
    setDragging(false)
    onFinishRef.current({
      score,
      maxCombo,
      daily: dailyMode,
      dailyKey,
      durationSeconds: Math.round(timeLimit),
    })
  }, [dailyKey, dailyMode, maxCombo, score, timeLimit])

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
    setCollapseMotions(getCollapseMotions([]))
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
    setRunning(true)
  }, [])

  const selectFirst = (index: number) => {
    if (!running || paused || removing.length) return
    setDragging(true)
    setSelected([index])
    vibrate(5, vibration)
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
        vibrate(5, vibration)
        return [...current, index]
      }
      return current
    })
  }

  const useHint = () => {
    if (!running || paused) return
    if (hints <= 0) return onToast(t('toast.hintsEmpty'))
    const combination = findCombination(board)
    if (combination) {
      setHints((current) => current - 1)
      setSelected(combination)
      window.setTimeout(() => setSelected([]), 900)
      return
    }
    onToast(t('toast.noMatch'))
  }

  const shuffleBoard = () => {
    if (!running || paused) return
    if (score < 50) return onToast(t('toast.shuffleLocked'))
    setScore((current) => current - 50)
    setSelected([])
    setBoard((current) => shuffleWithRandom(current, boardRandomRef.current))
    setBoardRevision((current) => current + 1)
    setCollapseMotions(getCollapseMotions([]))
    onToast(t('toast.shuffled'))
  }

  const addTime = () => {
    if (!running || paused || bonusUsed) return
    setBonusUsed(true)
    setTimeLimit((current) => current + 10)
    setTimeLeft((current) => current + 10)
    onToast(t('toast.timeAdded'))
  }

  return {
    board,
    selected,
    removing,
    boardRevision,
    collapseMotions,
    score,
    combo,
    maxCombo,
    timeLeft,
    timeLimit,
    running,
    paused,
    dragging,
    hints,
    bonusUsed,
    dailyMode,
    dailyKey,
    boardFeedback,
    feedbackId,
    sum,
    startGame,
    selectFirst,
    extendSelection,
    useHint,
    shuffleBoard,
    addTime,
    togglePause: () => setPaused((current) => !current),
  }
}
