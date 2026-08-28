// Shared test setup intentionally stays DOM-free so the suite runs on Node 20.
// jest-dom's matchers only touch the DOM when invoked, so importing them here is
// safe for both the default node environment and per-file jsdom opt-ins.
import '@testing-library/jest-dom/vitest'
