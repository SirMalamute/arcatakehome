import { X } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

/** Words as removable tags; Enter or comma adds the typed word. */
export function TagInput({ value, onChange, placeholder = 'Type a word, press Enter' }: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const word = draft.trim().replace(/,$/, '')
    if (word && !value.includes(word)) onChange([...value, word])
    setDraft('')
  }
  return (
    <div className="flex min-w-56 flex-wrap items-center gap-1">
      {value.map((w) => (
        <Badge key={w} variant="secondary" className="gap-1 pr-1">
          {w}
          <button type="button" aria-label={`Remove ${w}`} onClick={() => onChange(value.filter((x) => x !== w))}>
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Input
        className="h-7 w-44"
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
      />
    </div>
  )
}
