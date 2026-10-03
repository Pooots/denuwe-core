import { useState } from 'react'
import { ChevronLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import type { ApiValidationErrors, AuthUser, Gender, RegisterPayload } from '@/types/auth'
import { FieldGroup, SelectInput, TextInput } from '@/components/auth/fields'
import { BrandLogo } from '@/components/brand/Brand'
import { apiErrorMessage, apiValidationErrors, authService } from '@/services/authService'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const MIN_AGE = 13
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9]{7,15}$/
const normalizePhone = (value: string) => value.replace(/[\s\-().]/g, '')

const monthOptions = MONTHS.map((label, i) => ({ value: String(i + 1), label }))
const dayOptions = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))
const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 120 }, (_, i) => ({
  value: String(currentYear - i),
  label: String(currentYear - i),
}))
const genderOptions = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

type Fields = {
  firstName: string
  lastName: string
  month: string
  day: string
  year: string
  gender: string
  contact: string
  password: string
}

type Errors = Partial<Record<'name' | 'birthday' | 'gender' | 'contact' | 'password', string>>

function validate(f: Fields): Errors {
  const errors: Errors = {}

  if (!f.firstName.trim() || !f.lastName.trim()) {
    errors.name = "What's your name?"
  }

  if (!f.month || !f.day || !f.year) {
    errors.birthday = 'Select your birthday.'
  } else {
    const y = Number(f.year)
    const m = Number(f.month) - 1
    const d = Number(f.day)
    const birth = new Date(y, m, d)
    if (birth.getMonth() !== m) {
      errors.birthday = 'Select a valid date.'
    } else {
      const today = new Date()
      const thirteenth = new Date(y + MIN_AGE, m, d)
      if (thirteenth > today) {
        errors.birthday = `You must be at least ${MIN_AGE} years old to join denuwe.`
      }
    }
  }

  if (!f.gender) {
    errors.gender = 'Select your gender.'
  }

  const contact = f.contact.trim()
  const valid = contact.includes('@') ? EMAIL_RE.test(contact) : PHONE_RE.test(normalizePhone(contact))
  if (!valid) {
    errors.contact = 'Enter a valid mobile number or email address.'
  }

  if (f.password.length < 8) {
    errors.password = 'Use at least 8 characters for your password.'
  }

  return errors
}

function InlineLink({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="font-semibold text-brand-blue hover:underline">
      {children}
    </button>
  )
}

function errorsFromApi(apiErrors: ApiValidationErrors): Errors {
  const first = (key: string) => apiErrors[key]?.[0]
  const errors: Errors = {}
  const name = first('first_name') ?? first('last_name')
  if (name) errors.name = name
  for (const key of ['birthday', 'gender', 'contact', 'password'] as const) {
    const message = first(key)
    if (message) errors[key] = message
  }
  return errors
}

function toPayload(f: Fields): RegisterPayload {
  const pad = (v: string) => v.padStart(2, '0')
  return {
    first_name: f.firstName.trim(),
    last_name: f.lastName.trim(),
    birthday: `${f.year}-${pad(f.month)}-${pad(f.day)}`,
    gender: f.gender as Gender,
    contact: f.contact.trim(),
    password: f.password,
  }
}

export function RegisterForm({
  onBack,
  onAuthenticated,
}: {
  onBack: () => void
  onAuthenticated: (user: AuthUser) => void
}) {
  const [fields, setFields] = useState<Fields>({
    firstName: '',
    lastName: '',
    month: '',
    day: '',
    year: '',
    gender: '',
    contact: '',
    password: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (key: keyof Fields) => (value: string) => {
    const next = { ...fields, [key]: value }
    setFields(next)
    if (submitted) setErrors(validate(next))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setFormError(null)
    const found = validate(fields)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      const { user } = await authService.register(toPayload(fields))
      onAuthenticated(user)
    } catch (err) {
      const apiErrors = apiValidationErrors(err)
      if (apiErrors) {
        setErrors(errorsFromApi(apiErrors))
      } else {
        setFormError(apiErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-[546px] py-6">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to log in"
        className="-ml-2 grid size-9 place-items-center rounded-full text-ink transition hover:bg-muted"
      >
        <ChevronLeft className="size-5" />
      </button>

      <div className="mt-2 flex">
        <BrandLogo className="text-[17px]" />
      </div>

      <h2 className="mt-2 text-[22px] leading-tight font-semibold text-ink">Get started on denuwe</h2>
      <p className="mt-1 text-[13px] leading-snug text-ink/80">
        Create your denuwe account to join communities, share good vibes and connect with peacemakers worldwide.
      </p>

      <form className="mt-5 space-y-5" onSubmit={onSubmit} noValidate>
        <FieldGroup label="Name" error={errors.name}>
          <div className="grid grid-cols-2 gap-2.5">
            <TextInput
              placeholder="First name"
              autoComplete="given-name"
              value={fields.firstName}
              onChange={(e) => set('firstName')(e.target.value)}
              invalid={!!errors.name && !fields.firstName.trim()}
            />
            <TextInput
              placeholder="Last name"
              autoComplete="family-name"
              value={fields.lastName}
              onChange={(e) => set('lastName')(e.target.value)}
              invalid={!!errors.name && !fields.lastName.trim()}
            />
          </div>
        </FieldGroup>

        <FieldGroup
          label="Birthday"
          help="Your birthday helps us give you the right denuwe experience for your age. It won't be shown publicly unless you choose to."
          error={errors.birthday}
        >
          <div className="grid grid-cols-3 gap-2.5">
            <SelectInput
              aria-label="Month"
              placeholder="Month"
              options={monthOptions}
              value={fields.month}
              onChange={(e) => set('month')(e.target.value)}
              invalid={!!errors.birthday}
            />
            <SelectInput
              aria-label="Day"
              placeholder="Day"
              options={dayOptions}
              value={fields.day}
              onChange={(e) => set('day')(e.target.value)}
              invalid={!!errors.birthday}
            />
            <SelectInput
              aria-label="Year"
              placeholder="Year"
              options={yearOptions}
              value={fields.year}
              onChange={(e) => set('year')(e.target.value)}
              invalid={!!errors.birthday}
            />
          </div>
        </FieldGroup>

        <FieldGroup
          label="Gender"
          help="You can change who sees your gender on your denuwe profile later."
          error={errors.gender}
        >
          <SelectInput
            aria-label="Gender"
            placeholder="Select your gender"
            options={genderOptions}
            value={fields.gender}
            onChange={(e) => set('gender')(e.target.value)}
            invalid={!!errors.gender}
          />
        </FieldGroup>

        <FieldGroup label="Mobile number or email" error={errors.contact}>
          <TextInput
            placeholder="Mobile number or email"
            autoComplete="username"
            value={fields.contact}
            onChange={(e) => set('contact')(e.target.value)}
            invalid={!!errors.contact}
          />
          <p className="text-[13px] leading-snug text-ink/80">
            We'll use this to verify your account and send you updates from your communities.{' '}
            <InlineLink>Why we ask for your contact information</InlineLink>
          </p>
        </FieldGroup>

        <FieldGroup label="Password" error={errors.password}>
          <TextInput
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            autoComplete="new-password"
            value={fields.password}
            onChange={(e) => set('password')(e.target.value)}
            invalid={!!errors.password}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="grid size-9 place-items-center rounded-full text-ink transition hover:bg-muted"
              >
                {showPassword ? <Eye className="size-[18px]" /> : <EyeOff className="size-[18px]" />}
              </button>
            }
          />
        </FieldGroup>

        <div className="space-y-2.5 pt-1 text-[13px] leading-snug text-ink/80">
          <p>
            denuwe is a community built on respect and good energy. Please use your real name so friends and communities
            can recognize you.
          </p>
          <p>
            By tapping Submit, you agree to denuwe's <InlineLink>Terms of Service</InlineLink>,{' '}
            <InlineLink>Community Guidelines</InlineLink> and <InlineLink>Privacy Policy</InlineLink>.
          </p>
          <p>
            Our <InlineLink>Privacy Policy</InlineLink> explains how denuwe collects, uses and protects your information
            to keep the community safe and personalize your experience.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          {formError ? (
            <p role="alert" className="text-center text-[13px] text-danger">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-blue text-[15px] font-semibold text-white transition hover:brightness-110 active:brightness-95 disabled:opacity-70"
          >
            {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Submit
          </button>
          <button
            type="button"
            onClick={onBack}
            className="h-11 w-full rounded-full bg-muted text-[15px] font-medium text-ink transition hover:bg-secondary"
          >
            I already have an account
          </button>
        </div>
      </form>
    </div>
  )
}
