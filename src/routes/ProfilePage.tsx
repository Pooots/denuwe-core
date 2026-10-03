import { useState } from 'react'
import { Camera, Globe, MapPin, Pencil, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProfileMedia } from '@/services/profileService'
import type { AuthUser } from '@/types/auth'
import { MyPositions } from '@/components/clubs/MyPositions'
import { Avatar } from '@/components/feed/Avatar'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { MessagingDock } from '@/components/feed/MessagingDock'
import { Toaster } from '@/components/feed/Toaster'
import { ContactLinks } from '@/components/profile/ContactLinks'
import { DiaryCard } from '@/components/profile/DiaryCard'
import { EditProfileDialog } from '@/components/profile/EditProfileDialog'
import { PhotoDialog } from '@/components/profile/PhotoDialog'
import { ProfileCompletion } from '@/components/profile/ProfileCompletion'
import { ProfilePosts } from '@/components/profile/ProfilePosts'
import { SocietyCard } from '@/components/profile/SocietyCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'

type Dialog = { kind: 'edit' } | { kind: 'photo'; type: ProfileMedia } | null

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-xl border border-border bg-white', className)}>{children}</section>
}

function IconButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn('grid size-9 place-items-center rounded-full text-ink/70 transition hover:bg-muted hover:text-ink', className)}
    >
      {children}
    </button>
  )
}

function memberSince(user: AuthUser): string | null {
  if (!user.created_at) return null
  return new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function AccountCard({ user }: { user: AuthUser }) {
  const rows = [
    { label: 'Email', value: user.email },
    { label: 'Mobile', value: user.phone },
    { label: 'Member since', value: memberSince(user) },
  ].filter((row) => row.value)

  return (
    <Card className="px-5 py-4">
      <h2 className="text-[17px] font-semibold text-ink">Your account</h2>
      <p className="text-xs text-muted-foreground">Only you can see this</p>
      <dl className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="truncate text-[13px] font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export default function ProfilePage() {
  const user = useCurrentUser()
  const [dialog, setDialog] = useState<Dialog>(null)

  if (!user) return null

  const close = () => setDialog(null)
  const since = memberSince(user)

  return (
    <div className="min-h-dvh bg-background">
      <FeedNavbar user={user} active="me" />

      <div className="mx-auto grid max-w-[1128px] gap-6 px-4 pt-6 pb-16 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0 space-y-2">
          <Card className="overflow-hidden">
            <div className="brand-gradient relative aspect-[4/1] min-h-[120px]">
              {user.banner_url ? (
                <img src={user.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="vibe-gradient absolute inset-0 opacity-60" />
              )}
              <button
                type="button"
                onClick={() => setDialog({ kind: 'photo', type: 'banner' })}
                className="absolute top-3 right-3 flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[13px] font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-white"
              >
                <Camera className="size-4" />
                <span className="hidden sm:inline">{user.banner_url ? 'Edit banner' : 'Add banner'}</span>
              </button>
            </div>

            <div className="relative flow-root px-6 pb-6">
              <button
                type="button"
                onClick={() => setDialog({ kind: 'photo', type: 'avatar' })}
                aria-label="Change profile photo"
                className="group relative -mt-[76px] block size-[152px] rounded-full border-4 border-white bg-white shadow-sm"
              >
                <Avatar name={user.name} src={user.avatar_url} className="size-full text-5xl" />
                <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/45 text-white opacity-0 transition group-hover:opacity-100">
                  <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                    <Camera className="size-6" />
                    {user.avatar_url ? 'Change photo' : 'Add photo'}
                  </span>
                </span>
                {!user.avatar_url ? (
                  <span className="absolute right-2 bottom-2 grid size-9 place-items-center rounded-full border-2 border-white bg-brand-blue text-white">
                    <Plus className="size-5" />
                  </span>
                ) : null}
              </button>

              <IconButton label="Edit profile" onClick={() => setDialog({ kind: 'edit' })} className="absolute top-4 right-4">
                <Pencil className="size-5" />
              </IconButton>

              <div className="mt-4">
                <h1 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold text-ink">
                  {user.name}
                  {user.pronouns ? <span className="text-[13px] font-normal text-muted-foreground">{user.pronouns}</span> : null}
                </h1>
                {user.headline ? (
                  <p className="mt-1 text-[15px] text-ink">{user.headline}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'edit' })}
                    className="mt-1 text-[15px] font-semibold text-brand-blue hover:underline"
                  >
                    + Add a headline
                  </button>
                )}
                {user.location ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {user.location}
                  </p>
                ) : null}
                {user.contact_phone || user.contact_email ? (
                  <ContactLinks email={user.contact_email} phone={user.contact_phone} className="mt-2" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'edit' })}
                    className="mt-2 block text-[13px] font-semibold text-brand-blue hover:underline"
                  >
                    + Add contact number and email
                  </button>
                )}
                {user.website ? (
                  <a
                    href={user.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-blue hover:underline"
                  >
                    <Globe className="size-3.5" />
                    {user.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : null}
                <MyPositions size="md" className="mt-2" />
                {since ? <p className="mt-2 text-[13px] text-muted-foreground">Member since {since}</p> : null}
              </div>

              <ProfileCompletion
                user={user}
                onEdit={() => setDialog({ kind: 'edit' })}
                onPhoto={(type) => setDialog({ kind: 'photo', type })}
              />
            </div>
          </Card>

          <Card className="px-6 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[19px] font-semibold text-ink">About</h2>
              <IconButton label="Edit about" onClick={() => setDialog({ kind: 'edit' })}>
                <Pencil className="size-5" />
              </IconButton>
            </div>
            {user.bio ? (
              <p className="mt-2 text-[14px] leading-relaxed break-words whitespace-pre-line text-ink">{user.bio}</p>
            ) : (
              <p className="mt-2 text-[14px] text-muted-foreground">
                Tell the community about yourself: the clubs you love and what you’re looking for.{' '}
                <button
                  type="button"
                  onClick={() => setDialog({ kind: 'edit' })}
                  className="font-semibold text-brand-blue hover:underline"
                >
                  Add a summary
                </button>
              </p>
            )}
          </Card>

          <ProfilePosts authorId={user.id} user={user} />
        </main>

        <aside className="space-y-2">
          <DiaryCard />
          <AccountCard user={user} />
          <SocietyCard />
        </aside>
      </div>

      <MessagingDock user={user} />
      {dialog?.kind === 'edit' ? <EditProfileDialog user={user} onClose={close} /> : null}
      {dialog?.kind === 'photo' ? <PhotoDialog type={dialog.type} user={user} onClose={close} /> : null}
      <Toaster />
    </div>
  )
}
