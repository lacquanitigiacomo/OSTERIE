import { defineConfig } from '@playwright/test'

const SERVER_PORT = Number(process.env.OSTERIE_PORT ?? 8787)
const TV_PORT = 5173
const CONTROLLER_PORT = 5174

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${TV_PORT}`,
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'npm run dev -w @osterie/server',
      port: SERVER_PORT,
      timeout: 90_000,
      reuseExistingServer: !process.env.CI
    },
    {
      command: `npm run dev -w @osterie/tv-web -- --port ${TV_PORT} --strictPort`,
      port: TV_PORT,
      timeout: 90_000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_WS_URL: `ws://localhost:${SERVER_PORT}/ws`,
        VITE_CONTROLLER_URL: `http://localhost:${CONTROLLER_PORT}`
      }
    },
    {
      command: `npm run dev -w @osterie/controller-web -- --port ${CONTROLLER_PORT} --strictPort`,
      port: CONTROLLER_PORT,
      timeout: 90_000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_WS_URL: `ws://localhost:${SERVER_PORT}/ws`
      }
    }
  ]
})
