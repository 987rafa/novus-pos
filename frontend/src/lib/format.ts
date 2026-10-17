export function cop(cents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function copCompact(cents: number): string {
  return new Intl.NumberFormat('es-CO', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100)
}

export function parseDateTime(iso: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
  return new Date(hasZone ? iso : `${iso}Z`)
}

export function dateTime(iso: string): string {
  return parseDateTime(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

export function dateShort(iso: string): string {
  return parseDateTime(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
