import { FileText, Loader2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { api, ApiError } from '@/api'
import { DatePicker } from '@/components/filter/DatePicker'
import { InlineError } from '@/components/InlineError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL_AUTHORITIES, ALL_TYPES, AUTHORITY_LABELS, TYPE_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'

const ACCEPT = '.pdf,.txt,.md'
const MAX_BYTES = 25 * 1024 * 1024

export function UploadModal({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [type, setType] = useState('')
  const [authority, setAuthority] = useState('')
  const [product, setProduct] = useState('')
  const [date, setDate] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFiles([])
    setErrors({})
    setFormError(null)
    setUploaded(null)
    setProduct('')
    setDate('')
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    const errs = { ...errors }
    for (const f of Array.from(list)) {
      if (next.some((x) => x.name === f.name)) continue
      if (f.size > MAX_BYTES) errs[f.name] = 'File larger than 25MB'
      else if (!/\.(pdf|txt|md)$/i.test(f.name)) errs[f.name] = 'Only .pdf, .txt and .md are supported'
      else next.push(f)
    }
    setFiles(next)
    setErrors(errs)
  }

  const submit = async () => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    form.append('type', type)
    form.append('authority', authority)
    if (product) form.append('product', product)
    if (date) form.append('date', date)
    setUploading(true)
    setFormError(null)
    try {
      const res = await api.upload(form)
      const errs = Object.fromEntries(res.errors.map((e) => [e.filename, e.error]))
      setUploaded(res.documents.length)
      onUploaded()
      if (res.errors.length) {
        setFiles(files.filter((f) => errs[f.name]))
        setErrors(errs)
      } else {
        reset()
        setOpen(false)
      }
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Upload failed — is the API running?')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full bg-card px-4"><Upload /> Upload documents</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>PDF (text-based), .txt or .md, up to 25MB each. Metadata applies to all files.</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed bg-background p-8 text-sm text-muted-foreground transition-colors hover:border-brand/50',
            dragging && 'border-brand bg-brand/5',
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        >
          <Upload className="size-5 text-brand" />
          <span className="text-ink">Drop files here or click to browse</span>
          <span className="eyebrow">PDF · TXT · MD — up to 25MB</span>
          <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </div>

        {(files.length > 0 || Object.keys(errors).length > 0) && (
          <ul className="max-h-40 space-y-1 overflow-auto text-sm">
            {files.map((f) => (
              <li key={f.name} className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
                {errors[f.name] && <span className="text-xs text-destructive">{errors[f.name]}</span>}
                <button className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Remove" onClick={() => setFiles(files.filter((x) => x !== f))}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
            {Object.entries(errors).filter(([n]) => !files.some((f) => f.name === n)).map(([name, err]) => (
              <li key={name} className="flex items-center gap-2 text-destructive">
                <FileText className="size-4" /> <span className="truncate">{name}</span> <span className="text-xs">{err}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{ALL_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Authority</Label>
            <Select value={authority} onValueChange={setAuthority}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select authority" /></SelectTrigger>
              <SelectContent>{ALL_AUTHORITIES.map((a) => <SelectItem key={a} value={a}>{AUTHORITY_LABELS[a]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Product <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={product} placeholder="e.g. BRX-101" onChange={(e) => setProduct(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Document date <span className="text-muted-foreground">(optional)</span></Label>
            <DatePicker value={date} onChange={setDate} />
          </div>
        </div>

        <InlineError message={formError} onDismiss={() => setFormError(null)} />
        {uploaded !== null && Object.keys(errors).length > 0 && (
          <p className="text-sm text-success">Uploaded {uploaded}. The files listed in red were skipped.</p>
        )}

        <DialogFooter>
          <Button onClick={submit} disabled={!files.length || !type || !authority || uploading}>
            {uploading && <Loader2 className="animate-spin" />}
            Upload {files.length > 0 && files.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
