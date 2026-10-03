import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import type { TournamentDetail } from '@/types/tournament'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { FriendPicker } from '@/components/tournaments/FriendPicker'
import { storeTournament } from '@/components/tournaments/tournamentUi'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

export function InviteDialog({ detail, onClose }: { detail: TournamentDetail; onClose: () => void }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const taken = new Set([
    ...detail.entries.flatMap((e) => e.members.map((m) => m.id)),
    ...detail.invites.map((i) => i.user.id),
  ])

  const invite = useMutation({
    mutationFn: () => tournamentService.invite(detail.id, [...selected]),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
      onClose()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <Modal
      onClose={onClose}
      className="max-w-[460px]"
      title={
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Invite from your society</h2>
          <p className="truncate text-xs text-muted-foreground">
            They’ll get a notification and can enter {detail.name}.
          </p>
        </div>
      }
    >
      <div className="px-5 pb-4">
        <FriendPicker selected={selected} onChange={setSelected} exclude={taken} />
      </div>
      <div className="flex items-center gap-3 border-t border-border px-5 py-3">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
        <button
          type="button"
          disabled={invite.isPending || selected.size === 0}
          onClick={() => invite.mutate()}
          className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-60"
        >
          {invite.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {selected.size ? `Invite ${selected.size}` : 'Invite'}
        </button>
      </div>
    </Modal>
  )
}
