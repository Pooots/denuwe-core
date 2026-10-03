import type { QueryClient } from '@tanstack/react-query'

/** Posts and comments embed author name and photo, so reload them after profile changes. */
export function refreshAuthoredContent(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['feed'] })
  void qc.invalidateQueries({ queryKey: ['post'] })
  void qc.invalidateQueries({ queryKey: ['comments'] })
}
