# Frontend tests

Tests use **Vitest** (see [`vite.config.js`](vite.config.js)), **React Testing Library**, and **MSW** for HTTP mocking. Test files live under [`tests/`](tests/).

## Commands

| Command | Description |
|--------|-------------|
| `npm run test` | Run the suite once (CI) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report (`coverage/`) |

Match the Docker build: use **Node 18** (see [`Dockerfile`](Dockerfile)).

## GitHub Actions (example job)

Add a job that runs on pull requests (separate from Docker image build):

```yaml
frontend-test:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: frontend
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
    - run: npm ci
    - run: npm run test
    # optional:
    # - run: npm run lint
```

`VITE_API_URL` for tests is set in `vite.config.js` under `test.env` so `import.meta.env` matches the MSW handlers in `tests/msw/`.
