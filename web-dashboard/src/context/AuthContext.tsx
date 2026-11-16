import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { api } from "@/services/api"

interface User {
  id: string
  email: string
  full_name: string
  roles: string[]
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("token")
      if (storedToken) {
        try {
          const userData = await api.getCurrentUser(storedToken)
          setUser(userData)
          setToken(storedToken)
        } catch {
          localStorage.removeItem("token")
          localStorage.removeItem("refreshToken")
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password)
    const { access_token, refresh_token } = response
    localStorage.setItem("token", access_token)
    localStorage.setItem("refreshToken", refresh_token)
    setToken(access_token)
    const userData = await api.getCurrentUser(access_token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("refreshToken")
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}