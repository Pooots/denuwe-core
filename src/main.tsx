import ReactDOM from 'react-dom/client'
import { Outlet, RouterProvider, createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import './styles.css'
import { AppProviders } from './AppProviders'
import reportWebVitals from './reportWebVitals'
import type { ActivityStage } from '@/components/activities/activityStages'
import type { MessagesSearch } from '@/routes/MessagesPage'
import type { ShortsSearch } from '@/routes/ShortsPage'
import type { ShortFeed } from '@/types/short'
import HomePage from '@/routes/HomePage'
import FeedPage from '@/routes/FeedPage'
import ProfilePage from '@/routes/ProfilePage'
import ClubsPage from '@/routes/ClubsPage'
import ClubPage from '@/routes/ClubPage'
import SocietyPage from '@/routes/SocietyPage'
import MessagesPage from '@/routes/MessagesPage'
import PersonPage from '@/routes/PersonPage'
import StatusPage from '@/routes/StatusPage'
import ActivitiesPage from '@/routes/ActivitiesPage'
import TournamentsPage from '@/routes/TournamentsPage'
import TournamentPage from '@/routes/TournamentPage'
import ShortsPage from '@/routes/ShortsPage'
import { ACTIVITY_STAGES } from '@/components/activities/activityStages'
import { AppBackdrop } from '@/components/profile/AppBackdrop'
import { authService } from '@/services/authService'
import { initPwa } from '@/lib/pwa'

document.title = import.meta.env.VITE_APP_TITLE || 'denuwe'
initPwa()

const rootRoute = createRootRoute({
  component: () => (
    <>
      <AppBackdrop />
      <Outlet />
    </>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    if (authService.isAuthenticated()) {
      throw redirect({ to: '/feed' })
    }
  },
  component: HomePage,
})

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feed',
  beforeLoad: () => {
    if (!authService.isAuthenticated()) {
      throw redirect({ to: '/' })
    }
  },
  component: FeedPage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  beforeLoad: () => {
    if (!authService.isAuthenticated()) {
      throw redirect({ to: '/' })
    }
  },
  component: ProfilePage,
})

const requireAuth = () => {
  if (!authService.isAuthenticated()) {
    throw redirect({ to: '/' })
  }
}

const positiveId = (value: unknown) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

const clubsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clubs',
  beforeLoad: requireAuth,
  component: ClubsPage,
})

const clubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clubs/$slug',
  beforeLoad: requireAuth,
  component: ClubPage,
})

const communityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/communities/$slug',
  beforeLoad: requireAuth,
  component: ClubPage,
})

const communitiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/communities',
  beforeLoad: () => {
    throw redirect({ to: '/clubs' })
  },
})

const societyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/society',
  beforeLoad: requireAuth,
  /** `?with=<userId>` opens the chat with that person, `?group=<id>` a group chat, `?tab=groups` the groups list. */
  validateSearch: (search: Record<string, unknown>): { with?: number; group?: number; tab?: 'groups' } => {
    const id = Number(search.with)
    const group = Number(search.group)
    return {
      ...(Number.isInteger(id) && id > 0 ? { with: id } : {}),
      ...(Number.isInteger(group) && group > 0 ? { group } : {}),
      ...(search.tab === 'groups' ? { tab: 'groups' as const } : {}),
    }
  },
  component: SocietyPage,
})

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages',
  beforeLoad: requireAuth,
  /** `?c=<conversationId>` opens that conversation, `?with=<userId>` the one with that friend. */
  validateSearch: (search: Record<string, unknown>): MessagesSearch => {
    const c = positiveId(search.c)
    const user = positiveId(search.with)
    return { ...(c ? { c } : {}), ...(user ? { with: user } : {}) }
  },
  component: MessagesPage,
})

const personRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/people/$userId',
  beforeLoad: requireAuth,
  component: PersonPage,
})

const activitiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activities',
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): { stage?: ActivityStage } =>
    ACTIVITY_STAGES.includes(search.stage as ActivityStage) && search.stage !== 'planned'
      ? { stage: search.stage as ActivityStage }
      : {},
  component: ActivitiesPage,
})

const tournamentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments',
  beforeLoad: requireAuth,
  component: TournamentsPage,
})

const tournamentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments/$slug',
  beforeLoad: requireAuth,
  component: TournamentPage,
})

const SHORT_FEEDS: ReadonlyArray<ShortFeed> = ['all', 'society', 'clubs', 'mine']

const shortsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/shorts',
  beforeLoad: requireAuth,
  /** `?feed=` picks a tab, `?short=` plays that short first, `?user=` / `?club=` show one person's or club's shorts. */
  validateSearch: (search: Record<string, unknown>): ShortsSearch => {
    const result: ShortsSearch = {}
    if (SHORT_FEEDS.includes(search.feed as ShortFeed) && search.feed !== 'all') result.feed = search.feed as ShortFeed
    const short = positiveId(search.short)
    const user = positiveId(search.user)
    const club = positiveId(search.club)
    if (short) result.short = short
    if (user) result.user = user
    if (club) result.club = club
    return result
  },
  component: ShortsPage,
})

const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/status',
  component: StatusPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  feedRoute,
  profileRoute,
  clubsRoute,
  clubRoute,
  communitiesRoute,
  communityRoute,
  societyRoute,
  messagesRoute,
  personRoute,
  activitiesRoute,
  tournamentsRoute,
  tournamentRoute,
  shortsRoute,
  statusRoute,
])

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

reportWebVitals()
