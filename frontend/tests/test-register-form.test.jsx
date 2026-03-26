import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RegisterForm from '../src/components/RegisterForm.jsx'
import { renderWithProviders } from './test-utils.jsx'

describe('RegisterForm', () => {
  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterForm onSwitchToLogin={() => {}} />)

    await user.type(screen.getByLabelText(/^email$/i), 'a@b.com')
    await user.type(screen.getByLabelText(/^password$/i), 'secret12')
    await user.type(screen.getByLabelText(/confirm password/i), 'other12')
    await user.click(screen.getByRole('button', { name: /^register$/i }))

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterForm onSwitchToLogin={() => {}} />)

    await user.type(screen.getByLabelText(/^email$/i), 'a@b.com')
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.type(screen.getByLabelText(/confirm password/i), 'short')
    await user.click(screen.getByRole('button', { name: /^register$/i }))

    expect(screen.getByText('Password must be at least 6 characters long')).toBeInTheDocument()
  })

  it('completes registration and stores token', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterForm onSwitchToLogin={() => {}} />)

    await user.type(screen.getByLabelText(/^email$/i), 'new@test.com')
    await user.type(screen.getByLabelText(/^password$/i), 'secret12')
    await user.type(screen.getByLabelText(/confirm password/i), 'secret12')
    await user.click(screen.getByRole('button', { name: /^register$/i }))

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('test-access-token')
    })
  })

  it('calls onSwitchToLogin when link is clicked', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()
    renderWithProviders(<RegisterForm onSwitchToLogin={onSwitch} />)

    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(onSwitch).toHaveBeenCalledTimes(1)
  })
})
