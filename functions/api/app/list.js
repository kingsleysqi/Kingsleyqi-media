/**
 * /api/app/list
 * App-friendly alias of /api/list.
 *
 * Keeps the same auth behavior:
 * - If requireLogin is enabled, must provide Bearer token (viewer/admin).
 */
export { onRequestGet } from '../list.js';

