import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import {
  ClubDetailsFields,
  clubFormFee,
  clubFormPayload,
  clubFormProblem,
  clubTypeLabel,
  useClubForm,
} from '@/components/clubs/ClubForm'
import { CLUB_GRADIENT, CLUB_TYPE_LABEL, ClubIcon, clubLink, refreshClubs } from '@/components/clubs/clubUi'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { clubService } from '@/services/clubService'

export function CreateClubDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const form = useClubForm()
  const { state } = form
  const [error, setError] = useState<string | null>(null)
  const typeLabel = clubTypeLabel(state)

  const create = useMutation({
    mutationFn: () => clubService.create(clubFormPayload(state)),
    onSuccess: (club) => {
      refreshClubs(qc)
      toast(`${club.name} is ready. Invite your people!`)
      onClose()
      void navigate(clubLink(club))
    },
    onError: (err) => {
      const fieldErrors = apiValidationErrors(err)
      setError((fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err))
    },
  })

  const submit = () => {
    const problem = clubFormProblem(state)
    setError(problem)
    if (!problem) create.mutate()
  }

  return (
    <Modal
      title={<h2 className="text-[17px] font-semibold text-ink">Start a {typeLabel}</h2>}
      onClose={onClose}
      className="max-w-[600px]"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="max-h-[68dvh] space-y-5 overflow-y-auto px-5 pb-5">
          <div className={cn('flex items-center gap-3 rounded-xl bg-gradient-to-br p-4', CLUB_GRADIENT[state.color])}>
            <ClubIcon
              color={state.color}
              type={state.type}
              className="size-12 rounded-xl border-2 border-white/80"
              iconClassName="size-6"
            />
            <div className="min-w-0 flex-1 text-white">
              <p className="truncate text-[15px] font-semibold">{state.name.trim() || `Your ${typeLabel} name`}</p>
              <p className="text-xs text-white/80">
                {CLUB_TYPE_LABEL[state.type]} · 1 member · {clubFormFee(state)}
              </p>
            </div>
          </div>

          <ClubDetailsFields form={form} autoFocusName onChange={() => setError(null)} />
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
          <button
            type="submit"
            disabled={create.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {create.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Create {typeLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
