import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Product image with a graceful branded fallback for dead CDN links. */
export function ProductImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-surface-3 to-surface-3 dark:from-surface-3-dark dark:to-surface-dark',
          className,
        )}
      >
        <span className="flex flex-col items-center gap-1 text-ink-3 dark:text-ink-3-dark">
          <ImageOff className="size-4" />
        </span>
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  )
}
