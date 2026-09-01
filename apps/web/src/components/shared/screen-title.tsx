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
      <h1 className="tracking-[0.13em]">{title}</h1>
      <Icon className="size-5 text-muted-foreground" weight="duotone" />
    </div>
  )
}
