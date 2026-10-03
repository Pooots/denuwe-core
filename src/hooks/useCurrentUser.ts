import { useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { AuthUser } from '@/types/auth'
import { authService } from '@/services/authService'

/** Signed-in user, kept in sync across the app. Refreshes from the API on mount and signs out if the session is gone. */
export function useCurrentUser(): AuthUser | null {
  const navigate = useNavigate()
  const user = useSyncExternalStore(authService.subscribe, authService.getUser)

  useEffect(() => {
    authService.me().catch(async () => {
      await authService.logout()
      void navigate({ to: '/' })
    })
  }, [navigate])

  return user
}
