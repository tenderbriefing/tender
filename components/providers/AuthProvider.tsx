'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { UserProfile, getUserProfile } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
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

  useEffect(() => {
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
  }, [])

  const value = {
    user,
    userProfile,
    loading,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
