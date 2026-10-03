import { useState } from 'react'
import { Check, ChevronDown, Gift, Globe, HeartHandshake, Lock, Users, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Club, ClubColor, ClubType, ClubVisibility, CreateClubPayload, FeeCurrency, FeePeriod } from '@/types/club'
import { CLUB_BG, CLUB_COLORS, CLUB_TYPE_LABEL, FEE_PERIOD_LABEL, feeLabel } from '@/components/clubs/clubUi'
import { cn } from '@/lib/utils'

export const inputClass =
  'w-full rounded-lg border border-[#c4c9d4] bg-white px-3 text-[14px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 focus:outline-none'

const TYPE_OPTIONS: Array<{ value: ClubType; icon: ReactNode; hint: string; placeholder: string }> = [
  {
    value: 'club',
    icon: <Users className="size-5" />,
    hint: 'A group that meets up for a shared activity.',
    placeholder: 'e.g. The Weekend Hikers',
  },
  {
    value: 'community',
    icon: <HeartHandshake className="size-5" />,
    hint: 'A wider network around a cause, place or interest.',
    placeholder: 'e.g. Peace Builders Makati',
  },
]

const CURRENCY_SYMBOL: Record<FeeCurrency, string> = { PHP: '₱', USD: '$' }

export type ClubFormState = {
  type: ClubType
  name: string
  description: string
  color: ClubColor
  visibility: ClubVisibility
  membership: 'free' | 'paid'
  feeAmount: string
  feeCurrency: FeeCurrency
  feePeriod: FeePeriod
}

export function useClubForm(club?: Club) {
  const [state, setState] = useState<ClubFormState>(() => ({
    type: club?.type ?? 'club',
    name: club?.name ?? '',
    description: club?.description ?? '',
    color: club?.color ?? 'blue',
    visibility: club?.visibility ?? 'public',
    membership: club && !club.is_free ? 'paid' : 'free',
    feeAmount: club?.fee_amount != null ? String(club.fee_amount) : '',
    feeCurrency: club?.fee_currency ?? 'PHP',
    feePeriod: club?.fee_period ?? 'monthly',
  }))

  const set = <TKey extends keyof ClubFormState>(key: TKey, value: ClubFormState[TKey]) =>
    setState((current) => ({ ...current, [key]: value }))

  return { state, set }
}

export type ClubForm = ReturnType<typeof useClubForm>

export function clubTypeLabel(state: ClubFormState): string {
  return CLUB_TYPE_LABEL[state.type].toLowerCase()
}

/** Client-side check before submitting; null when the form is valid. */
export function clubFormProblem(state: ClubFormState): string | null {
  if (!state.name.trim()) return `Give your ${clubTypeLabel(state)} a name.`
  if (state.membership === 'paid' && !(Number(state.feeAmount) >= 1)) return 'Enter a membership fee of at least 1.'
  return null
}

export function clubFormPayload(state: ClubFormState): CreateClubPayload {
  const paid = state.membership === 'paid'
  return {
    type: state.type,
    name: state.name,
    description: state.description,
    color: state.color,
    visibility: state.visibility,
    membership: state.membership,
    ...(paid
      ? { fee_amount: Number(state.feeAmount), fee_currency: state.feeCurrency, fee_period: state.feePeriod }
      : {}),
  }
}

/** "Free" or e.g. "₱250 / year" for the live preview. */
export function clubFormFee(state: ClubFormState): string {
  const amount = Number(state.feeAmount)
  const paid = state.membership === 'paid' && amount > 0
  return feeLabel({
    is_free: !paid,
    fee_amount: paid ? amount : null,
    fee_currency: state.feeCurrency,
    fee_period: state.feePeriod,
  })
}

function Choice({
  selected,
  onClick,
  icon,
  title,
  hint,
}: {
  selected: boolean
  onClick: () => void
  icon: ReactNode
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative flex items-start gap-3 rounded-xl border p-3 text-left transition',
        selected ? 'border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue' : 'border-[#c4c9d4] hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg',
          selected ? 'bg-brand-blue text-white' : 'bg-muted text-ink/70',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      {selected ? (
        <span className="absolute top-2 right-2 grid size-4 place-items-center rounded-full bg-brand-blue text-white">
          <Check className="size-3" />
        </span>
      ) : null}
    </button>
  )
}

const VISIBILITY_OPTIONS: Array<{ value: ClubVisibility; icon: ReactNode; title: string; hint: string }> = [
  {
    value: 'public',
    icon: <Globe className="size-5" />,
    title: 'Public',
    hint: 'Anyone can see members, posts and activities, and join right away.',
  },
  {
    value: 'private',
    icon: <Lock className="size-5" />,
    title: 'Private',
    hint: 'Hidden from Explore; only members can open it. Share the link and approve who asks to join.',
  },
]

/** Type, name, description, privacy, membership fee and colour fields shared by create and settings. */
export function ClubDetailsFields({
  form,
  autoFocusName,
  privacyNote,
  membershipNote,
  onChange,
}: {
  form: ClubForm
  autoFocusName?: boolean
  privacyNote?: ReactNode
  membershipNote?: ReactNode
  onChange?: () => void
}) {
  const { state } = form
  const set: ClubForm['set'] = (key, value) => {
    form.set(key, value)
    onChange?.()
  }
  const typeLabel = clubTypeLabel(state)
  const paid = state.membership === 'paid'

  return (
    <>
      <fieldset>
        <legend className="text-xs font-semibold text-muted-foreground">Type</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TYPE_OPTIONS.map((option) => (
            <Choice
              key={option.value}
              selected={state.type === option.value}
              onClick={() => set('type', option.value)}
              icon={option.icon}
              title={CLUB_TYPE_LABEL[option.value]}
              hint={option.hint}
            />
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-xs font-semibold text-muted-foreground">
          {CLUB_TYPE_LABEL[state.type]} name <span className="text-danger">*</span>
        </span>
        <input
          autoFocus={autoFocusName}
          value={state.name}
          maxLength={80}
          onChange={(e) => set('name', e.target.value)}
          placeholder={TYPE_OPTIONS.find((option) => option.value === state.type)?.placeholder}
          className={cn(inputClass, 'mt-1 h-10')}
        />
      </label>

      <label className="block">
        <span className="flex justify-between text-xs font-semibold text-muted-foreground">
          Description <span className="font-normal">{state.description.length}/500</span>
        </span>
        <textarea
          value={state.description}
          maxLength={500}
          rows={3}
          onChange={(e) => set('description', e.target.value)}
          placeholder={`What’s your ${typeLabel} about? When and where do you meet?`}
          className={cn(inputClass, 'mt-1 resize-none py-2')}
        />
      </label>

      <fieldset>
        <legend className="text-xs font-semibold text-muted-foreground">Privacy</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {VISIBILITY_OPTIONS.map((option) => (
            <Choice
              key={option.value}
              selected={state.visibility === option.value}
              onClick={() => set('visibility', option.value)}
              icon={option.icon}
              title={option.title}
              hint={option.hint}
            />
          ))}
        </div>
        {privacyNote}
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold text-muted-foreground">Membership</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Choice
            selected={!paid}
            onClick={() => set('membership', 'free')}
            icon={<Gift className="size-5" />}
            title="Free"
            hint={
              state.visibility === 'private' ? 'No fee to join once you’re approved.' : 'Anyone can join at no cost.'
            }
          />
          <Choice
            selected={paid}
            onClick={() => set('membership', 'paid')}
            icon={<Wallet className="size-5" />}
            title="Membership fee"
            hint="Members pay a fee to join."
          />
        </div>

        {paid ? (
          <div className="mt-3 grid gap-3 rounded-xl bg-muted/70 p-3 sm:grid-cols-[minmax(0,1fr)_150px]">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">
                Fee amount <span className="text-danger">*</span>
              </span>
              <span className="mt-1 flex">
                <span className="relative">
                  <select
                    aria-label="Currency"
                    value={state.feeCurrency}
                    onChange={(e) => set('feeCurrency', e.target.value as FeeCurrency)}
                    className="h-10 appearance-none rounded-l-lg border border-r-0 border-[#c4c9d4] bg-white pr-7 pl-3 text-[14px] font-semibold text-ink focus:border-brand-blue focus:outline-none"
                  >
                    <option value="PHP">₱ PHP</option>
                    <option value="USD">$ USD</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  value={state.feeAmount}
                  onChange={(e) => set('feeAmount', e.target.value)}
                  placeholder={`${CURRENCY_SYMBOL[state.feeCurrency]}0.00`}
                  className={cn(inputClass, 'h-10 rounded-l-none')}
                />
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Billed</span>
              <span className="relative mt-1 block">
                <select
                  value={state.feePeriod}
                  onChange={(e) => set('feePeriod', e.target.value as FeePeriod)}
                  className={cn(inputClass, 'h-10 appearance-none pr-9')}
                >
                  {(Object.keys(FEE_PERIOD_LABEL) as Array<FeePeriod>).map((period) => (
                    <option key={period} value={period}>
                      {FEE_PERIOD_LABEL[period]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              </span>
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Members see the fee before joining. You collect payment directly and mark members as paid on your{' '}
              {typeLabel} page.
            </p>
          </div>
        ) : null}
        {membershipNote}
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold text-muted-foreground">Color</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CLUB_COLORS.map((option) => (
            <button
              key={option.value}
              type="button"
              title={option.label}
              aria-label={option.label}
              aria-pressed={state.color === option.value}
              onClick={() => set('color', option.value)}
              className={cn(
                'grid size-9 place-items-center rounded-full text-white ring-offset-2',
                CLUB_BG[option.value],
                state.color === option.value ? 'ring-2 ring-ink' : 'hover:scale-105',
              )}
            >
              {state.color === option.value ? <Check className="size-4" /> : null}
            </button>
          ))}
        </div>
      </fieldset>
    </>
  )
}
