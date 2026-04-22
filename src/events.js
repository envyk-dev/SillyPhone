// @ts-check
// Single seam for SillyTavern event subscriptions. Keeps index.js init()
// focused on orchestration rather than a flat 8-call subscription block.
import { ctx } from './st.js';

/**
 * @typedef {Object} Handlers
 * @property {(idx: number) => any} onReceived
 * @property {() => any} onSent
 * @property {() => any} onChanged
 * @property {(idx: number) => any} onEdited
 */

/**
 * Subscribe to the ST events SillyPhone cares about.
 * The MESSAGE_(UPDATED|EDITED|SAVED|CHANGED) regex fans out to every
 * matching event name — different ST builds expose different subsets,
 * and the edit handler is idempotent so duplicate fires are harmless.
 * @param {Handlers} handlers
 */
export function bindAll(handlers) {
    const c = ctx();
    c.eventSource.on(c.eventTypes.MESSAGE_RECEIVED, handlers.onReceived);
    c.eventSource.on(c.eventTypes.MESSAGE_SENT, handlers.onSent);
    c.eventSource.on(c.eventTypes.CHAT_CHANGED, handlers.onChanged);
    const editEventNames = Object.keys(c.eventTypes).filter(k =>
        /MESSAGE_(UPDATED|EDITED|SAVED|CHANGED)/.test(k));
    for (const name of editEventNames) {
        c.eventSource.on(c.eventTypes[name], handlers.onEdited);
    }
}
