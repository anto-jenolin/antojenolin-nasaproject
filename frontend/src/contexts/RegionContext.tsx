import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export interface Region {
  min_lat: number
  max_lat: number
  min_lon: number
  max_lon: number
  name?: string
}

interface RegionState {
  region: Region | null
  dateStart: string
  dateEnd: string
  variable: string
  qualityFilter: number  // 0=Good only, 1=Good+Marginal, 2=+Snow/Ice, 3=All
  savedRegions: { id: number; name: string; min_lat: number; max_lat: number; min_lon: number; max_lon: number }[]
}

interface RegionContextValue extends RegionState {
  setRegion: (r: Region | null) => void
  setDateRange: (start: string, end: string) => void
  setVariable: (v: string) => void
  setQualityFilter: (q: number) => void
  setSavedRegions: (regions: RegionState['savedRegions']) => void
  clearRegion: () => void
}

const STORAGE_KEY = 'terrapulse_region_ctx'

const DEFAULT_STATE: RegionState = {
  region: null,
  dateStart: '2020-01-01',
  dateEnd: '2024-12-01',
  variable: 'NDVI',
  qualityFilter: 1,
  savedRegions: [],
}

function isValidRegion(r: unknown): r is Region {
  if (!r || typeof r !== 'object') return false
  const o = r as Record<string, unknown>
  return (
    typeof o.min_lat === 'number' && typeof o.max_lat === 'number' &&
    typeof o.min_lon === 'number' && typeof o.max_lon === 'number' &&
    o.min_lat >= -90 && o.max_lat <= 90 &&
    o.min_lon >= -180 && o.max_lon <= 180 &&
    o.min_lat < o.max_lat && o.min_lon < o.max_lon
  )
}

function loadPersistedState(): RegionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<RegionState>
    return {
      ...DEFAULT_STATE,
      ...parsed,
      // Validate region before restoring
      region: parsed.region && isValidRegion(parsed.region) ? parsed.region : null,
      savedRegions: [],  // Never persist saved-regions — re-fetch from backend
    }
  } catch {
    return DEFAULT_STATE
  }
}

const RegionContext = createContext<RegionContextValue | null>(null)

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RegionState>(loadPersistedState)

  // Persist core state (not savedRegions) to sessionStorage on change
  useEffect(() => {
    const { savedRegions: _, ...persistable } = state
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistable))
    } catch { /* storage quota */ }
  }, [state])

  const setRegion = useCallback((r: Region | null) => {
    if (r !== null && !isValidRegion(r)) {
      console.warn('RegionContext: invalid region rejected', r)
      return
    }
    setState((prev) => ({ ...prev, region: r }))
  }, [])

  const setDateRange = useCallback((start: string, end: string) => {
    setState((prev) => ({ ...prev, dateStart: start, dateEnd: end }))
  }, [])

  const setVariable = useCallback((v: string) => {
    setState((prev) => ({ ...prev, variable: v }))
  }, [])

  const setQualityFilter = useCallback((q: number) => {
    setState((prev) => ({ ...prev, qualityFilter: Math.max(0, Math.min(3, q)) }))
  }, [])

  const setSavedRegions = useCallback((regions: RegionState['savedRegions']) => {
    setState((prev) => ({ ...prev, savedRegions: regions }))
  }, [])

  const clearRegion = useCallback(() => {
    setState((prev) => ({ ...prev, region: null }))
  }, [])

  return (
    <RegionContext.Provider value={{
      ...state,
      setRegion, setDateRange, setVariable, setQualityFilter,
      setSavedRegions, clearRegion,
    }}>
      {children}
    </RegionContext.Provider>
  )
}

export function useRegion() {
  const ctx = useContext(RegionContext)
  if (!ctx) throw new Error('useRegion must be inside RegionProvider')
  return ctx
}
