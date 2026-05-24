'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { useAuth } from '@/components/providers/AuthProvider'

interface WorkspaceFlags {
  isSaved: boolean
  isTracked: boolean
  isDepartmentWatched: boolean
  isProvinceWatched: boolean
  loading: boolean
}

export function useSmeWorkspaceActions(tender: {
  id: string
  department?: string
  province?: string
}) {
  const { user, userProfile } = useAuth()
  const [flags, setFlags] = useState<WorkspaceFlags>({
    isSaved: false,
    isTracked: false,
    isDepartmentWatched: false,
    isProvinceWatched: false,
    loading: true,
  })

  const load = useCallback(async () => {
    if (!user || userProfile?.userType !== 'sme') {
      setFlags((f) => ({ ...f, loading: false }))
      return
    }
    try {
      const res = await authFetch('/api/sme/workspace')
      const json = await res.json()
      if (json.success) {
        const ws = json.data.workspace
        setFlags({
          isSaved: (ws.savedTenderIds || []).includes(tender.id),
          isTracked: (ws.trackedTenderIds || []).includes(tender.id),
          isDepartmentWatched: (ws.watchedDepartments || []).includes(tender.department || ''),
          isProvinceWatched: (ws.watchedProvinces || []).includes(tender.province || ''),
          loading: false,
        })
      } else {
        setFlags((f) => ({ ...f, loading: false }))
      }
    } catch {
      setFlags((f) => ({ ...f, loading: false }))
    }
  }, [user, userProfile?.userType, tender.id, tender.department, tender.province])

  useEffect(() => {
    load()
  }, [load])

  const requireSme = () => {
    if (!user) {
      toast.error('Sign in as an SME to use workspace actions')
      return false
    }
    if (userProfile?.userType !== 'sme') {
      toast.error('SME account required')
      return false
    }
    return true
  }

  const toggleSave = async () => {
    if (!requireSme()) return
    const method = flags.isSaved ? 'DELETE' : 'POST'
    const res = await authFetch('/api/sme/workspace/save-tender', {
      method,
      body: JSON.stringify({ tenderId: tender.id }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    setFlags((f) => ({ ...f, isSaved: !f.isSaved }))
    toast.success(flags.isSaved ? 'Removed from saved tenders' : 'Tender saved to workspace')
  }

  const toggleTrack = async () => {
    if (!requireSme()) return
    const method = flags.isTracked ? 'DELETE' : 'POST'
    const res = await authFetch('/api/sme/workspace/track-tender', {
      method,
      body: JSON.stringify({ tenderId: tender.id }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    setFlags((f) => ({ ...f, isTracked: !f.isTracked }))
    toast.success(flags.isTracked ? 'Stopped tracking tender' : 'Tender added to tracked list')
  }

  const toggleDepartment = async () => {
    if (!requireSme() || !tender.department) return
    const method = flags.isDepartmentWatched ? 'DELETE' : 'POST'
    const res = await authFetch('/api/sme/workspace/follow-department', {
      method,
      body: JSON.stringify({ department: tender.department }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    setFlags((f) => ({ ...f, isDepartmentWatched: !f.isDepartmentWatched }))
    toast.success(
      flags.isDepartmentWatched
        ? `Unfollowed ${tender.department}`
        : `Following ${tender.department}`
    )
  }

  const toggleProvince = async () => {
    if (!requireSme() || !tender.province) return
    const method = flags.isProvinceWatched ? 'DELETE' : 'POST'
    const res = await authFetch('/api/sme/workspace/follow-province', {
      method,
      body: JSON.stringify({ province: tender.province }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    setFlags((f) => ({ ...f, isProvinceWatched: !f.isProvinceWatched }))
    toast.success(
      flags.isProvinceWatched ? `Unfollowed ${tender.province}` : `Following ${tender.province}`
    )
  }

  return {
    ...flags,
    isSme: userProfile?.userType === 'sme',
    refresh: load,
    toggleSave,
    toggleTrack,
    toggleDepartment,
    toggleProvince,
  }
}
