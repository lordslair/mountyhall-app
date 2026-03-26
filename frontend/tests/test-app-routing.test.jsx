import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import App from '../src/App.jsx'

const mockUseAuth = vi.fn()

vi.mock('../src/context/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}))

const authenticatedUser = {
  email: 'u@test.com',
  troll_id: '',
  troll_name: '',
  sciz_token: null,
  bt_system: '',
  bt_login: '',
  bt_password: '',
}

function authState(overrides = {}) {
  return {
    isAuthenticated: false,
    loading: false,
    logout: vi.fn(),
    user: null,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    updateProfile: vi.fn(),
    isAdmin: false,
    ...overrides,
  }
}

describe('App', () => {
  it('shows loading state', () => {
    mockUseAuth.mockReturnValue(
      authState({ loading: true, isAuthenticated: false })
    )
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows login form when not authenticated', () => {
    mockUseAuth.mockReturnValue(authState())
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })

  it('shows home when authenticated', () => {
    mockUseAuth.mockReturnValue(
      authState({
        isAuthenticated: true,
        user: authenticatedUser,
      })
    )
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    expect(
      screen.getByRole('heading', { name: 'Welcome to MountyHapp' })
    ).toBeInTheDocument()
  })

  it('renders profile route', () => {
    mockUseAuth.mockReturnValue(
      authState({
        isAuthenticated: true,
        user: authenticatedUser,
      })
    )
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
  })

  it('redirects unknown routes to home', () => {
    mockUseAuth.mockReturnValue(
      authState({
        isAuthenticated: true,
        user: authenticatedUser,
      })
    )
    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <App />
      </MemoryRouter>
    )
    expect(
      screen.getByRole('heading', { name: 'Welcome to MountyHapp' })
    ).toBeInTheDocument()
  })
})
