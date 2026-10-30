import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
}: {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
}) {
  const selected = value ? toDate(value) : undefined
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('w-36 justify-start font-normal', !value && 'text-muted-foreground')}>
          <CalendarIcon />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(2000, 0)}
          endMonth={new Date(2035, 11)}
          onSelect={(d) => d && onChange(toIso(d))}
        />
      </PopoverContent>
    </Popover>
  )
}
