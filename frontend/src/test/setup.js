import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library cannot register its automatic cleanup:
// unmount everything after each test so hooks/listeners never leak into the next one.
afterEach(() => cleanup())
