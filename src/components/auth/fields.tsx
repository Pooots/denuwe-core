import { ChevronDown, CircleHelp } from 'lucide-react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

const baseField =
  'w-full rounded-xl border bg-white text-[15px] text-ink transition focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none'

function borderFor(invalid?: boolean) {
  return invalid ? 'border-danger' : 'border-[#d5d9e2]'
}

export function FloatingInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  trailing,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  trailing?: ReactNode
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder=" "
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'peer h-[58px] w-full rounded-2xl border border-[#d5d9e2] bg-white px-4 pt-5 pb-1.5 text-[16px] text-ink transition focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none',
          trailing && 'pr-14',
        )}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-muted-foreground transition-all peer-focus:top-[10px] peer-focus:translate-y-0 peer-focus:text-[13px] peer-[:not(:placeholder-shown)]:top-[10px] peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[13px]"
      >
        {label}
      </label>
      {trailing ? (
        <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>
      ) : null}
    </div>
  )
}

export function FieldGroup({
  label,
  help,
  error,
  children,
}: {
  label: string
  help?: string
  error?: string
  children: ReactNode
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
        {label}
        {help ? (
          <span title={help} className="cursor-help text-ink" aria-label={help}>
            <CircleHelp className="size-[18px]" />
          </span>
        ) : null}
      </legend>
      {children}
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </fieldset>
  )
}

export function TextInput({
  invalid,
  className,
  trailing,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
  trailing?: ReactNode
}) {
  return (
    <div className="relative">
      <input
        {...props}
        aria-invalid={invalid || undefined}
        className={cn(
          baseField,
          borderFor(invalid),
          'h-[46px] px-4 placeholder:text-muted-foreground',
          trailing && 'pr-12',
          className,
        )}
      />
      {trailing ? (
        <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>
      ) : null}
    </div>
  )
}

export function SelectInput({
  invalid,
  placeholder,
  options,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean
  placeholder: string
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={invalid || undefined}
        className={cn(
          baseField,
          borderFor(invalid),
          'h-[46px] appearance-none pr-10 pl-4',
          props.value === '' ? 'text-muted-foreground' : 'text-ink',
          className,
        )}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink" />
    </div>
  )
}
