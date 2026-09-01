import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

export function Metric({
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
