import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, LoaderCircle, Lock, Plus, Wallet } from 'lucide-react'
import type { Club } from '@/types/club'
import { CLUB_TYPE_LABEL, ClubIcon, feeLabel, refreshClubs } from '@/components/clubs/clubUi'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { clubService } from '@/services/clubService'

function ConfirmFeeDialog({
  club,
  pending,
  onConfirm,
  onClose,
}: {
  club: Club
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const typeLabel = CLUB_TYPE_LABEL[club.type].toLowerCase()

  return (
    <Modal
      onClose={onClose}
      className="max-w-[440px]"
      title={
        <div className="flex items-center gap-3">
          <ClubIcon
            color={club.color}
            type={club.type}
            src={club.avatar_url}
            className="size-10 rounded-lg"
            iconClassName="size-5"
          />
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">Join {club.name}</h2>
            <p className="text-xs text-muted-foreground">{CLUB_TYPE_LABEL[club.type]} with a membership fee</p>
          </div>
        </div>
      }
    >
      <div className="space-y-3 px-5 pb-5">
        <div className="flex items-center gap-3 rounded-xl bg-amber-400/10 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-400/20 text-amber-700">
            <Wallet className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Membership fee</p>
            <p className="text-lg font-bold text-ink">{feeLabel(club)}</p>
          </div>
        </div>
        <p className="text-[13px] text-ink/70">
          {club.visibility === 'private' ? (
            <>
              This {typeLabel} is private, so the owner approves new members first. Once you’re in, your membership
              shows as <strong>pending</strong> until they confirm your payment.
            </>
          ) : (
            <>
              Your membership will show as <strong>pending</strong> until the {typeLabel} owner confirms your payment.
              Arrange payment with them directly after joining.
            </>
          )}
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full px-4 text-[13px] font-semibold text-ink/70 hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {club.visibility === 'private' ? 'Request to join' : `Join for ${feeLabel(club)}`}
        </button>
      </div>
    </Modal>
  )
}

function joinedMessage(before: Club, after: Club): string {
  if (after.has_requested) return `Request sent. You’ll join ${after.name} once the owner approves.`
  if (before.has_requested) return `Your request to join ${after.name} was cancelled.`
  if (!after.is_member) return `You left ${after.name}.`
  return after.my_fee_status === 'unpaid'
    ? `You joined ${after.name}. Your membership fee is pending.`
    : `You joined ${after.name}.`
}

/**
 * Join / Joined / Owner control. Clicking "Joined" leaves the club; paid clubs confirm the fee before joining.
 * Private clubs take a request instead, which can be cancelled until the owner answers.
 */
export function JoinButton({ club, className }: { club: Club; className?: string }) {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const typeLabel = CLUB_TYPE_LABEL[club.type].toLowerCase()

  const toggle = useMutation({
    mutationFn: () => (club.is_member || club.has_requested ? clubService.leave(club.id) : clubService.join(club.id)),
    onSuccess: (updated) => {
      refreshClubs(qc)
      setConfirming(false)
      toast(joinedMessage(club, updated))
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  if (club.is_owner) {
    return (
      <span
        className={cn(
          'inline-flex h-8 items-center gap-1 rounded-full bg-brand-blue/10 px-4 text-[13px] font-semibold text-brand-blue',
          className,
        )}
      >
        Owner
      </span>
    )
  }

  const engaged = club.is_member || club.has_requested
  const isPrivate = club.visibility === 'private'

  return (
    <>
      <button
        type="button"
        disabled={toggle.isPending}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!engaged && !club.is_free) setConfirming(true)
          else toggle.mutate()
        }}
        title={club.is_member ? `Leave ${typeLabel}` : club.has_requested ? 'Cancel your request to join' : undefined}
        className={cn(
          'group/join inline-flex h-8 items-center justify-center gap-1 rounded-full px-4 text-[13px] font-semibold transition disabled:opacity-60',
          engaged
            ? 'border border-[#c4c9d4] text-ink/70 hover:border-danger hover:text-danger'
            : 'border border-brand-blue text-brand-blue hover:bg-brand-blue/5',
          className,
        )}
      >
        {toggle.isPending && !confirming ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : club.is_member ? (
          <Check className="size-4 group-hover/join:hidden" />
        ) : club.has_requested ? (
          <Clock className="size-4 group-hover/join:hidden" />
        ) : isPrivate ? (
          <Lock className="size-3.5" />
        ) : (
          <Plus className="size-4" />
        )}
        {club.is_member ? (
          <>
            <span className="group-hover/join:hidden">Joined</span>
            <span className="hidden group-hover/join:inline">Leave</span>
          </>
        ) : club.has_requested ? (
          <>
            <span className="group-hover/join:hidden">Requested</span>
            <span className="hidden group-hover/join:inline">Cancel request</span>
          </>
        ) : isPrivate ? (
          'Request to join'
        ) : (
          'Join'
        )}
      </button>
      {confirming
        ? createPortal(
            // Stops clicks reaching a parent card <Link> through the React tree.
            <div onClick={(e) => e.stopPropagation()}>
              <ConfirmFeeDialog
                club={club}
                pending={toggle.isPending}
                onConfirm={() => toggle.mutate()}
                onClose={() => setConfirming(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
