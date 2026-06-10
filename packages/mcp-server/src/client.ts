/**
 * Re-export of `@outserp/sdk` so existing imports (`from './client'`) keep
 * working while the actual implementation lives in the shared SDK package.
 * Prefer `import { OutserpClient } from '@outserp/sdk'` in new code.
 */
export * from '@outserp/sdk';
