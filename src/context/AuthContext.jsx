import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function createProfileIfNeeded(user) {
    if (!user) return
    
    try {
      // Check if profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()
      
      if (!existing) {
        // Create profile with try-catch to handle trigger issues
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          role: 'crew'
        }, { onConflict: 'id', ignoreDuplicates: true })
      }
    } catch (e) {
      console.log('Profile creation handled:', e.message)
    }
  }

  async function fetchProfile(userId, userEmail) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (!error && data) {
      setProfile(data)
    } else {
      // Profile doesn't exist or error - create it
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          email: userEmail || '',
          full_name: 'New User',
          role: 'crew'
        }, { onConflict: 'id', ignoreDuplicates: true })
        
        // Fetch again
        const { data: newData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (newData) setProfile(newData)
      } catch (e) {
        console.log('Profile fetch/creation handled')
      }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        createProfileIfNeeded(session.user).then(() => fetchProfile(session.user.id, session.user.email))
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        createProfileIfNeeded(session.user).then(() => fetchProfile(session.user.id, session.user.email))
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
