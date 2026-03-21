const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      window.location.href = '/login'
    }
    return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } }
  }

  return res.json()
}
