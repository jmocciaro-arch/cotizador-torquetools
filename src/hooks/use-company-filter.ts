'use client'

import { useCompanyContext } from '@/lib/company-context'

/**
 * Hook for ABSOLUTE company filtering — like Odoo silos.
 *
 * When a company is selected, ONLY that company's data is visible.
 * When multi-mode is active, selected companies are combined.
 * If no company is selected (loading), a dummy impossible ID is used
 * to prevent any data from leaking.
 *
 * Usage:
 * ```
 * const { filterByCompany } = useCompanyFilter()
 * let q = sb.from('tt_documents').select('*')
 * q = filterByCompany(q) // Applies absolute filter
 * ```
 */
export function useCompanyFilter() {
  const { activeCompanyId, activeCompanyIds, isMultiMode, companies } = useCompanyContext()

  // Get the list of company IDs to filter by
  const companyIds: string[] = isMultiMode
    ? activeCompanyIds
    : activeCompanyId
      ? [activeCompanyId]
      : []

  // NEVER skip the filter. If no company selected, use impossible UUID
  // to guarantee zero results (prevents data leaking during loading)
  const IMPOSSIBLE_ID = '00000000-0000-0000-0000-000000000000'

  /**
   * Apply ABSOLUTE company filter to a Supabase query.
   * This ALWAYS filters — there is no "show all" bypass.
   * Multi-mode with all companies selected shows all, but still filters.
   */
  function filterByCompany<T>(query: T, column = 'company_id'): T {
    // Multi-mode: show all selected companies
    if (isMultiMode && companyIds.length > 0) {
      if (companyIds.length === companies.length) {
        // All companies selected — use .in() with all IDs (still filters, just includes all)
        return (query as unknown as { in: (col: string, vals: string[]) => T }).in(column, companyIds)
      }
      return (query as unknown as { in: (col: string, vals: string[]) => T }).in(column, companyIds)
    }

    // Single company mode
    if (companyIds.length === 1) {
      return (query as unknown as { eq: (col: string, val: string) => T }).eq(column, companyIds[0])
    }

    // No company selected (loading state or no access) — show nothing
    return (query as unknown as { eq: (col: string, val: string) => T }).eq(column, IMPOSSIBLE_ID)
  }

  /**
   * Get a single company ID for creating new records.
   */
  const defaultCompanyId = activeCompanyId || companyIds[0] || null

  // companyKey changes whenever the active company changes — use as useEffect dependency
  const companyKey = companyIds.join(',') || 'none'

  return {
    companyIds,
    filterByCompany,
    defaultCompanyId,
    activeCompanyId,
    companyKey,
    isLoading: companyIds.length === 0,
  }
}
