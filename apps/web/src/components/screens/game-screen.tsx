import {
  Clock,
  Lightbulb,
  Pause,
  Play,
  Shuffle,
  X,
} from '@phosphor-icons/react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import GameBoard from '#/components/game-board'
import { Button } from '#/components/ui/button'
import { TARGET } from '@ten/game-core'
import type { CollapseMotion } from '@ten/game-core'
import type { ThemeId } from '#/lib/themes'
import type { BoardFeedback } from '#/components/shared/screen'
import { getComboTier } from '#/lib/combo'

type GameScreenProps = {
  board: Array<number>
  boardFeedback: BoardFeedback
  boardRevision: number
  collapseMotions: Array<CollapseMotion>
  feedbackId: number
  selected: Array<number>
  removing: Array<number>
  reducedMotion: boolean
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
  onExit: () => void
  onShuffle: () => void
  onHint: () => void
  onAddTime: () => void
}

export function GameScreen(props: GameScreenProps) {
  const { t } = useTranslation()
  const comboTier = getComboTier(props.combo)

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
      <div
        className={`game-board-shell relative overflow-hidden rounded-[1.7rem] border bg-card p-3 shadow-2xl shadow-black/60 touch-none select-none is-${comboTier}`}
      >
        <GameBoard
          board={props.board}
          selected={props.selected}
          removing={props.removing}
          reducedMotion={props.reducedMotion}
          revision={props.boardRevision}
          motions={props.collapseMotions}
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
        {props.boardFeedback === 'success' && comboTier !== 'normal' && (
          <div
            key={`combo-${props.feedbackId}`}
            className={`ten-fever-label is-${comboTier}`}
            aria-live="polite"
          >
            <strong>
              {t(comboTier === 'blazing' ? 'game.blazingCombo' : 'game.fever')}
            </strong>
            <span>×{props.combo}</span>
          </div>
        )}
        {props.paused && (
          <div className="absolute inset-3 grid place-items-center rounded-2xl bg-black/75 p-5 backdrop-blur-sm">
            <div className="w-full max-w-48 space-y-3 text-center">
              <p className="font-black tracking-[0.18em]">{t('game.paused')}</p>
              <Button className="w-full" onClick={props.onTogglePause}>
                <Play className="mr-2 size-4" weight="fill" />{' '}
                {t('game.resume')}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={props.onExit}
              >
                <X className="mr-2 size-4" weight="bold" /> {t('game.exit')}
              </Button>
            </div>
          </div>
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
