import { CalendarBlank, Crown, House, UserCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import type { Screen } from './screen'

export function BottomNavigation({
  active,
  onNavigate,
  showRanking,
}: {
  active: Screen
  onNavigate: (screen: Screen) => void
  showRanking: boolean
}) {
  const { t } = useTranslation()
  const items = [
    { screen: 'home' as const, label: t('nav.home'), icon: House },
    { screen: 'daily' as const, label: t('nav.daily'), icon: CalendarBlank },
    ...(showRanking
      ? [{ screen: 'rank' as const, label: t('nav.ranking'), icon: Crown }]
      : []),
    { screen: 'mypage' as const, label: t('nav.profile'), icon: UserCircle },
  ]
  return (
    <nav
      className={`fixed bottom-0 left-1/2 z-40 grid w-full max-w-[480px] -translate-x-1/2 ${showRanking ? 'grid-cols-4' : 'grid-cols-3'} border-t bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl`}
    >
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
