import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

export function ScreenTitle({
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
