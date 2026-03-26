import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import Sidebar from '../src/components/Sidebar.jsx'

const mockUseAuth = vi.fn()

vi.mock('../src/context/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('Sidebar', () => {
  it('shows SCIZ Group link when user has sciz_token', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'a@b.com', sciz_token: 'tok', is_admin: false },
    })
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Sidebar isOpen onClose={() => {}} />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /SCIZ Group/i })).toBeInTheDocument()
  })

  it('hides SCIZ Group link when user has no sciz_token', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'a@b.com', sciz_token: null, is_admin: false },
    })
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Sidebar isOpen onClose={() => {}} />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link', { name: /SCIZ Group/i })).not.toBeInTheDocument()
  })

  it('shows Admin link when user is admin', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'a@b.com', sciz_token: null, is_admin: true },
    })
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Sidebar isOpen onClose={() => {}} />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })

  it('hides Admin link when user is not admin', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'a@b.com', sciz_token: null, is_admin: false },
    })
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Sidebar isOpen onClose={() => {}} />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })
})
