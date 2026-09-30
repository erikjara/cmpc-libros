import '@testing-library/jest-dom/vitest'
import './polyfills'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
