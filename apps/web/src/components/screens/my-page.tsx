import {
  CheckCircle,
  Crown,
  DownloadSimple,
  Fire,
  LockSimple,
  Question,
  Star,
  Trophy,
  UploadSimple,
  UserCircle,
} from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '#/components/ui/button'
import { Metric } from '#/components/shared/metric'
import { ScreenTitle } from '#/components/shared/screen-title'
import { ACHIEVEMENT_IDS } from '#/lib/achievements'
import type { PlayerProfile } from '#/lib/api'
import type { Preferences } from '#/lib/preferences'
import { THEMES } from '#/lib/themes'
import type { ThemeId } from '#/lib/themes'
import type { PlayerState } from '#/lib/player-state'

export function MyPage({
  average,
  player,
  state,
  theme,
  preferences,
  onPreferencesChange,
  onThemeChange,
  onLanguageChange,
  onUpdateName,
  onExport,
  onImport,
  onResetRecords,
  onResetSettings,
  onTutorial,
  onToast,
}: {
  average: number
  player: PlayerProfile | null
  state: PlayerState
  theme: ThemeId
  preferences: Preferences
  onPreferencesChange: (preferences: Preferences) => void
  onThemeChange: (theme: ThemeId) => void
  onLanguageChange: (language: 'ja' | 'en') => void
  onUpdateName: (name: string) => Promise<boolean>
  onExport: () => void
  onImport: (file: File) => Promise<void>
  onResetRecords: () => void
  onResetSettings: () => void
  onTutorial: () => void
  onToast: (message: string) => void
}) {
  const { i18n, t } = useTranslation()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(player?.name ?? t('profile.player'))
  const themes = THEMES.map((definition) => ({
    id: definition.id,
    label: t(`profile.themes.${definition.id}`),
    color: definition.swatch,
  }))

  const saveName = () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 20) return
    void onUpdateName(trimmed).then((saved) => {
      onToast(saved ? t('toast.nameSaved') : t('toast.nameSaveFailed'))
    })
  }

  return (
    <section>
      <ScreenTitle title={t('profile.title')} icon={UserCircle} />
      <div className="rounded-3xl border bg-card p-6 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-b from-zinc-500 to-zinc-900">
          <UserCircle className="size-8" weight="duotone" />
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <input
            className="w-40 rounded-full bg-secondary px-4 py-2 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-accent"
            value={name}
            maxLength={20}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={saveName}
            aria-label={t('profile.namePlaceholder')}
          />
          <Button
            variant="secondary"
            className="rounded-full text-xs"
            onClick={saveName}
          >
            {t('profile.saveName')}
          </Button>
        </div>
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
                onClick={() => onLanguageChange(language)}
              >
                {t(language === 'ja' ? 'profile.japanese' : 'profile.english')}
              </Button>
            )
          })}
        </div>
      </div>
      <div className="mt-3 rounded-3xl border bg-card p-5">
        <strong>{t('settings.title')}</strong>
        <div className="mt-3 space-y-2">
          <SettingToggle
            label={t('settings.vibration')}
            description={t('settings.vibrationDescription')}
            enabled={preferences.vibration}
            onChange={(vibration) =>
              onPreferencesChange({ ...preferences, vibration })
            }
          />
          <SettingToggle
            label={t('settings.reducedMotion')}
            description={t('settings.reducedMotionDescription')}
            enabled={preferences.reducedMotion}
            onChange={(reducedMotion) =>
              onPreferencesChange({ ...preferences, reducedMotion })
            }
          />
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
      <div className="mt-3 rounded-3xl border bg-card p-5">
        <strong>{t('data.title')}</strong>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          {t('data.description')}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <DataCount label={t('data.plays')} value={state.plays} />
          <DataCount label={t('data.history')} value={state.history.length} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button className="rounded-full" onClick={onExport}>
            <DownloadSimple className="mr-2 size-4" weight="bold" />
            {t('data.export')}
          </Button>
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={() => importInputRef.current?.click()}
          >
            <UploadSimple className="mr-2 size-4" weight="bold" />
            {t('data.import')}
          </Button>
          <input
            ref={importInputRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void onImport(file)
              event.currentTarget.value = ''
            }}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="rounded-full text-xs"
            onClick={onResetRecords}
          >
            {t('data.resetRecords')}
          </Button>
          <Button
            variant="outline"
            className="rounded-full text-xs"
            onClick={onResetSettings}
          >
            {t('data.resetSettings')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function DataCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-secondary px-4 py-3">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <strong className="mt-1 block tabular-nums">{value}</strong>
    </div>
  )
}

function playerStateAchievementCount(state: PlayerState) {
  return ACHIEVEMENT_IDS.filter((id) => state.unlockedAchievements.includes(id))
    .length
}

function SettingToggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string
  description: string
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <button
      className="flex w-full items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-left"
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
    >
      <span>
        <strong className="block text-sm">{label}</strong>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          {description}
        </span>
      </span>
      <span
        className={`rounded-full px-3 py-1 text-[10px] font-bold ${enabled ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}
      >
        {enabled ? t('settings.on') : t('settings.off')}
      </span>
    </button>
  )
}
