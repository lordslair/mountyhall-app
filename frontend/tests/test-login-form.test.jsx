import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi } from 'vitest'
import LoginForm from '../src/components/LoginForm.jsx'
import { TEST_API_ORIGIN } from './constants.js'
import { server } from './msw/server.js'
import { renderWithProviders } from './test-utils.jsx'

describe('LoginForm', () => {
  it('submits email and password and stores token on success', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm onSwitchToRegister={() => {}} />)

    await user.type(screen.getByLabelText(/email/i), 'user@test.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /^login$/i }))

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('test-access-token')
    })
  })

  it('shows error when login fails', async () => {
    const user = userEvent.setup()

    server.use(
      http.post(`${TEST_API_ORIGIN}/auth/login`, () =>
        HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      )
    )

    renderWithProviders(<LoginForm onSwitchToRegister={() => {}} />)

    await user.type(screen.getByLabelText(/email/i), 'bad@test.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /^login$/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('calls onSwitchToRegister when link is clicked', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()
    renderWithProviders(<LoginForm onSwitchToRegister={onSwitch} />)

    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(onSwitch).toHaveBeenCalledTimes(1)
  })
})
