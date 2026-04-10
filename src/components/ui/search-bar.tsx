'use client'

import { useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onSearch?: (value: string) => void
  className?: string
  autoFocus?: boolean
}

export function SearchBar({
  placeholder = 'Buscar...',
  value: externalValue,
  onChange,
  onSearch,
  className,
  autoFocus,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState('')
  const value = externalValue ?? internalValue

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      setInternalValue(v)
      onChange?.(v)
    },
    [onChange]
  )

  const handleClear = useCallback(() => {
    setInternalValue('')
    onChange?.('')
    onSearch?.('')
  }, [onChange, onSearch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') onSearch?.(value)
    },
    [onSearch, value]
  )

  return (
    <div className={cn('relative', className)}>
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full h-10 rounded-lg bg-[#1E2330] border border-[#2A3040] pl-10 pr-10 text-sm text-[#F0F2F5] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#9CA3AF]"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
