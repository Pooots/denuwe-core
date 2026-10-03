import { useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import type { FormEvent } from 'react'
import type { AuthUser } from '@/types/auth'
import { AppDownloads } from '@/components/auth/AppDownloads'
import { FloatingInput } from '@/components/auth/fields'
import { BrandLogo } from '@/components/brand/Brand'
import { apiErrorMessage, authService } from '@/services/authService'

export function LoginForm({
  onCreateAccount,
  onAuthenticated,
}: {
  onCreateAccount: () => void
  onAuthenticated: (user: AuthUser) => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!identifier.trim() || !password) {
      setError('Enter your email or mobile number and password.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const { user } = await authService.login({
        identifier: identifier.trim(),
        password,
      })
      onAuthenticated(user)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-[546px]">
      <h2 className="text-[17px] font-semibold text-ink">Log into denuwe</h2>

      <form className="mt-[clamp(1.25rem,4vh,2.25rem)]" onSubmit={onSubmit} noValidate>
        <div className="space-y-3">
          <FloatingInput
            id="login-identifier"
            label="Email or mobile number"
            autoComplete="username"
            value={identifier}
            onChange={setIdentifier}
          />
          <FloatingInput
            id="login-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-muted"
              >
                {showPassword ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
              </button>
            }
          />
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-blue text-[15px] font-medium text-white transition hover:brightness-110 active:brightness-95 disabled:opacity-70"
        >
          {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Log in
        </button>
      </form>

      <div className="mt-5 text-center">
        <button type="button" className="text-[15px] font-semibold text-ink hover:underline">
          Forgot password?
        </button>
      </div>

      <button
        type="button"
        onClick={onCreateAccount}
        className="mt-6 h-11 w-full rounded-full lg:mt-[clamp(2rem,7vh,4rem)] border border-brand-blue bg-white text-[15px] font-medium text-brand-blue transition hover:bg-brand-blue/5"
      >
        Create new account
      </button>

      <AppDownloads className="mt-5 lg:mt-[clamp(1.25rem,3.5vh,2rem)]" />

      <div className="mt-5 flex justify-center">
        <BrandLogo className="text-[19px]" />
      </div>
    </div>
  )
}
