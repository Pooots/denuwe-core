import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from '@tanstack/react-router'
import { Clapperboard, Globe, Lock, MapPin, MessageCircle, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SocietyPerson, UserProfile } from '@/types/society'
import { ClubIcon, clubLink, plural } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { MessagingDock } from '@/components/feed/MessagingDock'
import { Toaster } from '@/components/feed/Toaster'
import { ContactLinks } from '@/components/profile/ContactLinks'
import { showVisitedBackground } from '@/components/profile/AppBackdrop'
import { DiaryCard } from '@/components/profile/DiaryCard'
import { ProfilePosts } from '@/components/profile/ProfilePosts'
import { RelationshipActions, mutualLabel, societyProfileKey } from '@/components/society/societyUi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { societyService } from '@/services/societyService'

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-xl border border-border bg-white', className)}>{children}</section>
}

function asPerson(profile: UserProfile): SocietyPerson {
  return {
    ...profile,
    relationship: profile.relationship === 'self' ? 'friends' : profile.relationship,
    last_message: null,
    unread_count: 0,
  }
}

function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function ProfileHeader({ profile }: { profile: UserProfile }) {
  const mutual = mutualLabel(profile.mutual_count)
  const since = memberSince(profile.created_at)
  const facts = [
    profile.friends_count !== undefined ? plural(profile.friends_count, 'friend') : null,
    mutual,
    since ? `Member since ${since}` : null,
  ].filter(Boolean)

  return (
    <Card className="overflow-hidden">
      <div className="brand-gradient relative aspect-[4/1] min-h-[120px]">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="vibe-gradient absolute inset-0 opacity-60" />
        )}
      </div>
      <div className="relative flow-root px-6 pb-6">
        <div className="relative -mt-[76px] size-[152px] rounded-full border-4 border-white bg-white shadow-sm">
          <Avatar name={profile.name} src={profile.avatar_url} className="size-full text-5xl" />
        </div>
        <div className="mt-4">
          <h1 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold text-ink">
            {profile.name}
            {profile.pronouns ? (
              <span className="text-[13px] font-normal text-muted-foreground">{profile.pronouns}</span>
            ) : null}
          </h1>
          {profile.headline ? <p className="mt-1 text-[15px] text-ink">{profile.headline}</p> : null}
          {profile.location ? (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <MapPin className="size-3.5" />
              {profile.location}
            </p>
          ) : null}
          <ContactLinks email={profile.contact_email} phone={profile.contact_phone} className="mt-2" />
          {profile.website ? (
            <a
              href={profile.website}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-blue hover:underline"
            >
              <Globe className="size-3.5" />
              {profile.website.replace(/^https?:\/\//, '')}
            </a>
          ) : null}
          {profile.positions && profile.positions.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {profile.positions.map(({ club, position }) => (
                <li key={club.id}>
                  <Link
                    {...clubLink(club)}
                    className="flex min-w-0 items-center gap-2 text-[13px] text-ink hover:underline"
                  >
                    <ClubIcon
                      color={club.color}
                      type={club.type}
                      src={club.avatar_url}
                      className="size-5 rounded"
                      iconClassName="size-3"
                    />
                    <span className="truncate">
                      <span className="font-semibold">{position}</span>
                      <span className="text-muted-foreground"> · {club.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {facts.length > 0 ? <p className="mt-2 text-[13px] text-muted-foreground">{facts.join(' · ')}</p> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {profile.relationship === 'friends' ? (
            <Link
              to="/society"
              search={{ with: profile.id }}
              className="flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
            >
              <MessageCircle className="size-4" /> Message
            </Link>
          ) : null}
          <RelationshipActions person={asPerson(profile)} />
          <Link
            to="/shorts"
            search={{ user: profile.id }}
            className="flex h-8 items-center gap-1.5 rounded-full border border-[#c4c9d4] px-4 text-[13px] font-semibold text-ink/80 transition hover:bg-muted"
          >
            <Clapperboard className="size-4" /> Shorts
          </Link>
        </div>
      </div>
    </Card>
  )
}

function LockedCard({ profile }: { profile: UserProfile }) {
  const first = profile.first_name
  const text =
    profile.relationship === 'outgoing'
      ? `Once ${first} accepts your friend request, you’ll see their full profile and diary.`
      : profile.relationship === 'incoming'
        ? `${first} wants to join your society. Accept to see their full profile and diary.`
        : `Add ${first} to your society to see their full profile and diary.`
  return (
    <Card className="flex items-start gap-3 px-6 py-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-ink/60">
        <Lock className="size-5" />
      </span>
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{first}’s profile is shared with their society</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{text}</p>
      </div>
    </Card>
  )
}

/** Someone else's profile: the full page and diary for friends, a basic card for everyone else. */
export default function PersonPage() {
  const user = useCurrentUser()
  const params = useParams({ strict: false })
  const userId = Number(params.userId)

  const profile = useQuery({
    queryKey: societyProfileKey(userId),
    queryFn: () => societyService.profile(userId),
    enabled: Number.isInteger(userId) && userId > 0 && userId !== user?.id,
  })

  const data = profile.data
  const background = data?.background
  const backgroundUrl = data?.background_url
  const backgroundEffect = data?.background_effect
  const loaded = data !== undefined
  useEffect(
    () =>
      loaded
        ? showVisitedBackground({ background, url: backgroundUrl, effect: backgroundEffect })
        : undefined,
    [loaded, background, backgroundUrl, backgroundEffect],
  )

  if (!user) return null
  if (userId === user.id) return <Navigate to="/profile" />
  return (
    <div className="app-page min-h-dvh">
      <FeedNavbar user={user} active="society" />

      <div className="mx-auto grid max-w-[1128px] gap-6 px-4 pt-6 pb-16 lg:grid-cols-[minmax(0,1fr)_300px]">
        {profile.isLoading ? (
          <main className="space-y-2">
            <div className="h-[380px] animate-pulse rounded-xl bg-white" />
          </main>
        ) : !data ? (
          <main>
            <Card className="px-6 py-10 text-center">
              <Users className="mx-auto size-10 text-ink/40" />
              <p className="mt-3 text-[15px] font-semibold text-ink">This profile isn’t available</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {profile.isError ? apiErrorMessage(profile.error) : 'The link may be broken.'}
              </p>
              <Link
                to="/society"
                className="mt-4 inline-block text-[13px] font-semibold text-brand-blue hover:underline"
              >
                Back to My Society
              </Link>
            </Card>
          </main>
        ) : (
          <>
            <main className="min-w-0 space-y-2">
              <ProfileHeader profile={data} />
              {data.can_view ? (
                <Card className="px-6 py-5">
                  <h2 className="text-[19px] font-semibold text-ink">About</h2>
                  <p
                    className={cn(
                      'mt-2 text-[14px] leading-relaxed break-words whitespace-pre-line',
                      data.bio ? 'text-ink' : 'text-muted-foreground',
                    )}
                  >
                    {data.bio || `${data.first_name} hasn’t added a summary yet.`}
                  </p>
                </Card>
              ) : (
                <LockedCard profile={data} />
              )}
              <ProfilePosts authorId={data.id} user={user} firstName={data.first_name} />
            </main>
            <aside className="space-y-2">
              {data.can_view ? <DiaryCard owner={{ id: data.id, firstName: data.first_name }} /> : null}
            </aside>
          </>
        )}
      </div>

      <MessagingDock user={user} />
      <Toaster />
    </div>
  )
}
