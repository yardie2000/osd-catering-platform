import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) =>
      ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c)
    )
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function generateCode(prefix: string, name: string): string {
  return `${prefix}-${slugify(name).substring(0, 20).toUpperCase()}`
}

export function paginate<T>(
  data: T[],
  page: number,
  pageSize: number
): { data: T[]; total: number; totalPages: number } {
  const total = data.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  return { data: data.slice(start, start + pageSize), total, totalPages }
}
