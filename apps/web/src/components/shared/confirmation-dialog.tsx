import { useEffect, useRef } from 'react'

import { Button } from '#/components/ui/button'

export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/80 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <div className="w-full max-w-sm rounded-[2rem] border bg-card p-6 shadow-2xl">
        <h2 id="confirmation-dialog-title" className="text-lg font-black">
          {title}
        </h2>
        <p
          id="confirmation-dialog-description"
          className="mt-3 text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="secondary"
            className="h-12 rounded-xl"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-12 rounded-xl"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
