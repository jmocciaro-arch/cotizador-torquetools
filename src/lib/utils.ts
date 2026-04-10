import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: 'EUR' | 'ARS' | 'USD' = 'EUR'): string {
  const config: Record<string, { locale: string; currency: string }> = {
    EUR: { locale: 'es-ES', currency: 'EUR' },
    ARS: { locale: 'es-AR', currency: 'ARS' },
    USD: { locale: 'en-US', currency: 'USD' },
  }
  const c = config[currency] || config.EUR
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, formatStr, { locale: es })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, "dd/MM/yyyy HH:mm", { locale: es })
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: es })
}

export function generateQuoteNumber(companyPrefix: string): string {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
  return `${companyPrefix}-${year}${month}-${random}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const BRANDS = ['FEIN', 'Tohnichi', 'Tecna', 'Ingersoll Rand', 'SpeeDrill', 'FIAM', 'Apex'] as const
export type Brand = typeof BRANDS[number]

export const BRAND_COLORS: Record<string, string> = {
  'FEIN': '#003366',
  'Tohnichi': '#CC0000',
  'Tecna': '#00AA44',
  'Ingersoll Rand': '#1A1A1A',
  'SpeeDrill': '#FF6600',
  'FIAM': '#0066CC',
  'Apex': '#6B21A8',
}

export const CRM_STAGES = [
  { id: 'lead', label: 'Lead', color: '#6B7280' },
  { id: 'propuesta', label: 'Propuesta', color: '#3B82F6' },
  { id: 'negociacion', label: 'Negociación', color: '#F59E0B' },
  { id: 'ganado', label: 'Ganado', color: '#10B981' },
  { id: 'perdido', label: 'Perdido', color: '#EF4444' },
] as const

export const INCOTERMS = [
  'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',
  'FAS', 'FOB', 'CFR', 'CIF',
] as const
