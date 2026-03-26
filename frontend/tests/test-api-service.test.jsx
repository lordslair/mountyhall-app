import { http, HttpResponse } from 'msw'
import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '../src/services/api.js'
import { TEST_API_ORIGIN } from './constants.js'
import { server } from './msw/server.js'

describe('api service', () => {
  beforeEach(() => {
    localStorage.removeItem('token')
  })

  it('throws when error response body is not JSON', async () => {
    server.use(
      http.get(`${TEST_API_ORIGIN}/auth/profile`, () =>
        HttpResponse.text('<html>Server Error</html>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        })
      )
    )

    localStorage.setItem('token', 'some-token')

    await expect(api.getProfile()).rejects.toThrow()
  })
})
