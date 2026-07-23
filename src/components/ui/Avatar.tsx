import { cn, colorFromString, initials } from '@/lib/utils'

interface AvatarProps {
  nome: string
  fotoUrl?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
}

export function Avatar({ nome, fotoUrl, size = 'md', className }: AvatarProps) {
  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        className={cn('shrink-0 rounded-full object-cover', sizes[size], className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: colorFromString(nome) }}
      aria-hidden
    >
      {initials(nome)}
    </div>
  )
}
