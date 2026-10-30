import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function MultiSelect({
  options,
  value,
  onChange,
  labels = {},
}: {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  labels?: Record<string, string>
}) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])
  const summary = value.length ? value.map((v) => labels[v] ?? v).join(', ') : 'Select…'
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('w-56 justify-between font-normal', !value.length && 'text-muted-foreground')}>
          <span className="truncate">{summary}</span>
          <ChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
            <Checkbox checked={value.includes(opt)} onCheckedChange={() => toggle(opt)} />
            {labels[opt] ?? opt}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}
