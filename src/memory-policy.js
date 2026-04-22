// @ts-check
// Pure decision logic for the rolling-memory trigger. Kept dependency-free
// so tests can exercise it under plain node --test.

/** @typedef {import('./types.js').RollingMemorySettings} RollingMemorySettings */

const DEFAULT_EVERY = 10;
const DEFAULT_KEEP_RECENT = 10;

/**
 * Given current chat length, rolling-memory config, and the length at which
 * the trigger last fired, decide whether to fire again now.
 * The "not equal to last fired length" guard makes consecutive calls at the
 * same length idempotent — important because MESSAGE_RECEIVED and
 * MESSAGE_SENT both invoke this.
 * @param {number} len
 * @param {Partial<RollingMemorySettings> | null | undefined} rm
 * @param {number} lastTriggerLen
 * @returns {boolean}
 */
export function shouldTriggerRolling(len, rm, lastTriggerLen) {
    if (!rm || !rm.enabled) return false;
    const keepRecent = rm.keepRecent || DEFAULT_KEEP_RECENT;
    const every = rm.every || DEFAULT_EVERY;
    if (len - keepRecent <= 0) return false;
    if (len === lastTriggerLen) return false;
    if (len % every !== 0) return false;
    return true;
}
