import { render, screen } from '@testing-library/react'
import { describe, it, expect } from '@jest/globals'
import LoginPage from '../page'

/**
 * Regression test for login page rendering
 * 
 * This test ensures that the login page renders without crashing
 * and contains all critical UI elements. This prevents regressions
 * from breaking the authentication flow.
 */
describe('LoginPage Regression Test', () => {
  it('renders all critical elements without crashing', () => {
    // This is the core regression test - ensure page renders
    render(<LoginPage />)
    
    // Verify all critical UI elements are present
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    
    // Verify form structure exists
    const form = document.querySelector('form')
    expect(form).toBeInTheDocument()
    
    // Verify accessibility attributes
    const emailInput = screen.getByLabelText(/email/i)
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('required')
    
    // Verify status area exists for messages
    const statusElement = document.getElementById('login-status')
    expect(statusElement).toBeInTheDocument()
    expect(statusElement).toHaveAttribute('aria-live', 'polite')
  })
})