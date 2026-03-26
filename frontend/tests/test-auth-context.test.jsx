import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx'

vi.mock('../src/services/api.js', () => ({
  api: {
    getProfile: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
  },
  getToken: vi.fn(),
}))

import { api, getToken } from '../src/services/api.js'

function Consumer() {
  const { user, loading, error, isAuthenticated, login, logout, register } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <span data-testid="error">{error ?? ''}</span>
      <button type="button" onClick={() => login('a@b.com', 'secret12')}>
        login
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
      <button type="button" onClick={() => register('n@b.com', 'secret12')}>
        register
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getToken.mockReturnValue(null)
  })

  it('finishes loading unauthenticated when no token', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    })
    expect(getToken).toHaveBeenCalled()
    expect(api.getProfile).not.toHaveBeenCalled()
    expect(screen.getByTestId('auth')).toHaveTextContent('no')
  })

  it('loads profile when token exists', async () => {
    getToken.mockReturnValue('tok')
    api.getProfile.mockResolvedValue({ email: 'a@b.com', is_admin: false })
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('email')).toHaveTextContent('a@b.com')
    })
    expect(screen.getByTestId('auth')).toHaveTextContent('yes')
  })

  it('clears invalid token when getProfile fails', async () => {
    getToken.mockReturnValue('bad')
    localStorage.setItem('token', 'bad')
    api.getProfile.mockRejectedValue(new Error('fail'))
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    })
    expect(localStorage.getItem('token')).toBeNull()
    expect(screen.getByTestId('auth')).toHaveTextContent('no')
  })

  it('login success sets user', async () => {
    const user = userEvent.setup()
    api.login.mockResolvedValue({ access_token: 'x' })
    api.getProfile.mockResolvedValue({ email: 'u@test.com', is_admin: false })
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    })
    await user.click(screen.getByRole('button', { name: 'login' }))
    await waitFor(() => {
      expect(screen.getByTestId('email')).toHaveTextContent('u@test.com')
    })
    expect(screen.getByTestId('auth')).toHaveTextContent('yes')
  })

  it('login failure surfaces error', async () => {
    const user = userEvent.setup()
    api.login.mockRejectedValue(new Error('Bad credentials'))
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    })
    await user.click(screen.getByRole('button', { name: 'login' }))
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Bad credentials')
    })
  })

  it('register chains into login and sets user', async () => {
    const user = userEvent.setup()
    api.register.mockResolvedValue({ message: 'ok' })
    api.login.mockResolvedValue({ access_token: 'x' })
    api.getProfile.mockResolvedValue({ email: 'n@b.com', is_admin: false })
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    })
    await user.click(screen.getByRole('button', { name: 'register' }))
    await waitFor(() => {
      expect(screen.getByTestId('email')).toHaveTextContent('n@b.com')
    })
  })

  it('logout clears user', async () => {
    const user = userEvent.setup()
    getToken.mockReturnValue('tok')
    api.getProfile.mockResolvedValue({ email: 'u@test.com', is_admin: false })
    api.logout.mockResolvedValue({})
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('yes')
    })
    await user.click(screen.getByRole('button', { name: 'logout' }))
    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('no')
    })
  })
})
