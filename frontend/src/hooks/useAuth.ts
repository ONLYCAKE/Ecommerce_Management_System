import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext.tsx'

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthContext missing')
  return ctx
}
