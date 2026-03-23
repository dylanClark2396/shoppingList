import { computed } from 'vue'
import { useRouter } from 'vue-router'

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID

export async function refreshTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return false
  try {
    const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
      }),
    })
    if (!res.ok) return false
    const tokens = await res.json()
    localStorage.setItem('access_token', tokens.access_token)
    if (tokens.refresh_token) localStorage.setItem('refresh_token', tokens.refresh_token)
    return true
  } catch {
    return false
  }
}

export function useAuth() {
  const router = useRouter()

  const isAuthenticated = computed(() => !!localStorage.getItem('access_token'))

  const login = () => {
    const redirectUri = `${window.location.origin}/callback`
    const url = new URL(`${COGNITO_DOMAIN}/oauth2/authorize`)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', CLIENT_ID)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', 'openid email profile')
    window.location.href = url.toString()
  }

  const handleCallback = async (code: string) => {
    const redirectUri = `${window.location.origin}/callback`
    const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        code,
      }),
    })
    const tokens = await res.json()
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    router.push('/login')
  }

  return { isAuthenticated, login, handleCallback, logout }
}
