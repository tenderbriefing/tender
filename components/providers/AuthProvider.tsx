'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { UserProfile, getUserProfile } from '@/lib/auth'
import { readE2eUiAuthStub } from '@/lib/e2e/uiAuthStub'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  refreshProfile: async () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (uid: string, attempt = 0) => {
    try {
      const profile = await getUserProfile(uid)
      if (profile) {
        setUserProfile(profile)
        return
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
        return loadProfile(uid, attempt + 1)
      }
      setUserProfile(null)
    } catch (error) {
      console.error('Error fetching user profile:', error)
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 400))
        return loadProfile(uid, attempt + 1)
      }
      setUserProfile(null)
    }
  }

  useEffect(() => {
    // Playwright-only: build flag + localhost + window.__TB_E2E_UI_STUB__ via addInitScript.
    // No effect on production users or production deploy builds.
    const e2eStub = readE2eUiAuthStub()
    if (e2eStub) {
      const stubUser = {
        uid: e2eStub.uid,
        email: e2eStub.email || 'e2e-agent@tenderbriefing.test',
        getIdToken: async () => e2eStub.token || 'e2e-stub-token',
      } as unknown as User
      try {
        Object.defineProperty(auth, 'currentUser', {
          configurable: true,
          get: () => stubUser,
        })
      } catch {
        /* ignore if auth.currentUser is non-configurable */
      }
      setUser(stubUser)
      setUserProfile({
        uid: e2eStub.uid,
        email: e2eStub.email || 'e2e-agent@tenderbriefing.test',
        userType: 'youth-agent',
        displayName: 'E2E Youth Agent',
      } as UserProfile)
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)

      if (nextUser) {
        await loadProfile(nextUser.uid)
      } else {
        setUserProfile(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
    // loadProfile is stable for this mount; refreshProfile reuses the same helper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshProfile = async () => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setUserProfile(null)
      return
    }
    await loadProfile(uid)
  }

  const value = {
    user,
    userProfile,
    loading,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
