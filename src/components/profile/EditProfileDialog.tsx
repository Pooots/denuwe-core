import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LoaderCircle, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProfilePayload } from '@/services/profileService'
import type { AuthUser } from '@/types/auth'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { refreshAuthoredContent } from '@/components/profile/refresh'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { profileService } from '@/services/profileService'

export const PRONOUNS = ['She/Her', 'He/Him', 'They/Them']

const LIMITS: Partial<Record<keyof ProfilePayload, number>> = {
  first_name: 60,
  last_name: 60,
  headline: 160,
  location: 120,
  website: 255,
  bio: 2000,
  contact_email: 255,
  contact_phone: 20,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9]{7,15}$/

const inputClass =
  'w-full rounded-lg border border-[#c4c9d4] bg-white px-3 text-[14px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 focus:outline-none'

function Field({
  label,
  required,
  error,
  counter,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  counter?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs font-semibold text-muted-foreground">
        <span>
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </span>
        {counter ? <span className="font-normal">{counter}</span> : null}
      </span>
      <span className="mt-1 block">{children}</span>
      {error ? <span className="mt-1 block text-xs font-semibold text-danger">{error}</span> : null}
    </label>
  )
}

function initialValues(user: AuthUser): ProfilePayload {
  return {
    first_name: user.first_name ?? user.name.split(' ')[0],
    last_name: user.last_name ?? user.name.split(' ').slice(1).join(' '),
    headline: user.headline ?? '',
    pronouns: user.pronouns ?? '',
    location: user.location ?? '',
    bio: user.bio ?? '',
    website: user.website ?? '',
    contact_email: user.contact_email ?? '',
    contact_phone: user.contact_phone ?? '',
  }
}

function UseAccountButton({ value, onUse }: { value: string | null; onUse: (value: string) => void }) {
  if (!value) return null
  return (
    <button
      type="button"
      onClick={() => onUse(value)}
      className="mt-1 text-xs font-semibold text-brand-blue hover:underline"
    >
      Use {value}
    </button>
  )
}

export function EditProfileDialog({ user, onClose }: { user: AuthUser; onClose: () => void }) {
  const qc = useQueryClient()
  const [values, setValues] = useState<ProfilePayload>(() => initialValues(user))
  const [errors, setErrors] = useState<Partial<Record<keyof ProfilePayload, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => profileService.update(values),
    onSuccess: () => {
      refreshAuthoredContent(qc)
      toast('Profile updated.')
      onClose()
    },
    onError: (err) => {
      const fieldErrors = apiValidationErrors(err)
      if (fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([key, messages]) => [key, messages[0]])))
      } else {
        setFormError(apiErrorMessage(err))
      }
    },
  })

  const set = (key: keyof ProfilePayload) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const counter = (key: keyof ProfilePayload) => `${values[key].length}/${LIMITS[key]}`

  const submit = () => {
    const next: Partial<Record<keyof ProfilePayload, string>> = {}
    if (!values.first_name.trim()) next.first_name = 'Enter your first name.'
    if (!values.last_name.trim()) next.last_name = 'Enter your last name.'
    const email = values.contact_email.trim()
    if (email && !EMAIL_RE.test(email)) next.contact_email = 'Enter a valid email address.'
    const phone = values.contact_phone.replace(/[\s\-().]/g, '')
    if (phone && !PHONE_RE.test(phone)) next.contact_phone = 'Enter a valid phone number, e.g. 09171234567.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length === 0) save.mutate()
  }

  return (
    <Modal
      title={<h2 className="text-[17px] font-semibold text-ink">Edit profile</h2>}
      onClose={onClose}
      className="max-w-[640px]"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="max-h-[65dvh] space-y-4 overflow-y-auto px-5 pt-1 pb-5">
          <p className="text-xs text-muted-foreground">
            <span className="text-danger">*</span> Required
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required error={errors.first_name}>
              <input
                value={values.first_name}
                maxLength={LIMITS.first_name}
                onChange={(e) => set('first_name')(e.target.value)}
                className={cn(inputClass, 'h-10')}
              />
            </Field>
            <Field label="Last name" required error={errors.last_name}>
              <input
                value={values.last_name}
                maxLength={LIMITS.last_name}
                onChange={(e) => set('last_name')(e.target.value)}
                className={cn(inputClass, 'h-10')}
              />
            </Field>
          </div>

          <Field label="Pronouns" error={errors.pronouns}>
            <span className="relative block">
              <select
                value={values.pronouns}
                onChange={(e) => set('pronouns')(e.target.value)}
                className={cn(inputClass, 'h-10 appearance-none pr-9')}
              >
                <option value="">Please select</option>
                {PRONOUNS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                {values.pronouns && !PRONOUNS.includes(values.pronouns) ? (
                  <option value={values.pronouns}>{values.pronouns}</option>
                ) : null}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            </span>
          </Field>

          <Field label="Headline" error={errors.headline} counter={counter('headline')}>
            <textarea
              value={values.headline}
              maxLength={LIMITS.headline}
              rows={2}
              onChange={(e) => set('headline')(e.target.value)}
              placeholder="e.g. Weekend hiker · Chess club captain · Community builder"
              className={cn(inputClass, 'resize-none py-2')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location" error={errors.location}>
              <input
                value={values.location}
                maxLength={LIMITS.location}
                onChange={(e) => set('location')(e.target.value)}
                placeholder="City, Country"
                className={cn(inputClass, 'h-10')}
              />
            </Field>
            <Field label="Website" error={errors.website}>
              <input
                value={values.website}
                maxLength={LIMITS.website}
                onChange={(e) => set('website')(e.target.value)}
                placeholder="yourwebsite.com"
                className={cn(inputClass, 'h-10')}
              />
            </Field>
          </div>

          <Field label="About" error={errors.bio} counter={counter('bio')}>
            <textarea
              value={values.bio}
              maxLength={LIMITS.bio}
              rows={5}
              onChange={(e) => set('bio')(e.target.value)}
              placeholder="Tell the community what you love, the clubs you’re part of and what you’re looking for."
              className={cn(inputClass, 'resize-y py-2 leading-relaxed')}
            />
          </Field>

          <fieldset className="border-t border-border pt-4">
            <legend className="float-left w-full text-[15px] font-semibold text-ink">Contact info</legend>
            <p className="clear-both flex items-center gap-1 pt-0.5 text-xs text-muted-foreground">
              <Users className="size-3" /> Shown on your profile to people in your society
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Phone number" error={errors.contact_phone}>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={values.contact_phone}
                    maxLength={LIMITS.contact_phone}
                    onChange={(e) => set('contact_phone')(e.target.value)}
                    placeholder="e.g. 0917 123 4567"
                    className={cn(inputClass, 'h-10')}
                  />
                </Field>
                {values.contact_phone ? null : <UseAccountButton value={user.phone} onUse={set('contact_phone')} />}
              </div>
              <div>
                <Field label="Email address" error={errors.contact_email}>
                  <input
                    type="email"
                    autoComplete="email"
                    value={values.contact_email}
                    maxLength={LIMITS.contact_email}
                    onChange={(e) => set('contact_email')(e.target.value)}
                    placeholder="you@example.com"
                    className={cn(inputClass, 'h-10')}
                  />
                </Field>
                {values.contact_email ? null : <UseAccountButton value={user.email} onUse={set('contact_email')} />}
              </div>
            </div>
          </fieldset>
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{formError}</p>
          <button
            type="submit"
            disabled={save.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-6 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
