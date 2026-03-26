import { http, HttpResponse } from 'msw'
import { TEST_API_ORIGIN } from '../constants.js'

const base = (path) => `${TEST_API_ORIGIN}${path}`

const defaultUser = {
  email: 'user@test.com',
  is_admin: false,
  sciz_token: null,
}

/** Default happy-path handlers aligned with [src/services/api.js](../src/services/api.js). */
export const handlers = [
  http.post(base('/auth/register'), async () =>
    HttpResponse.json({ message: 'registered successfully' }, { status: 201 })
  ),

  http.post(base('/auth/login'), async ({ request }) => {
    await request.json()
    return HttpResponse.json({ access_token: 'test-access-token' })
  }),

  http.post(base('/auth/logout'), () => HttpResponse.json({})),

  http.get(base('/auth/profile'), () => HttpResponse.json({ ...defaultUser })),

  http.put(base('/auth/profile'), async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...defaultUser, ...body })
  }),

  http.get(base('/group/sciz/trolls'), () => HttpResponse.json([])),

  http.get(base('/group/bt'), () => HttpResponse.json({})),

  http.post(base('/monsters/search'), async () => HttpResponse.json({})),

  http.post(base('/monsters/:mobId/mz'), () => HttpResponse.json({})),

  http.get(base('/monsters/:mobId/events'), () => HttpResponse.json([])),

  http.get(base('/monsters'), () => HttpResponse.json([])),

  http.delete(base('/monsters/:mobId'), () => HttpResponse.json({})),

  http.delete(base('/monsters'), () => HttpResponse.json({})),

  http.get(base('/admin/metrics'), () => HttpResponse.json({ users: 0 })),
]
