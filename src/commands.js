// @ts-check
// High-level verbs that compose data mutations + persistent-side-effect
// cleanup. Callers still handle their own UI refresh (e.g. modal.refresh)
// so this module stays UI-agnostic and circular imports are avoided.
import { ctx, cutChatMessage } from './st.js';
import * as chatSms from './chat-sms.js';
import * as storage from './storage.js';
import * as context from './context.js';
import * as badge from './ui/badge.js';

/**
 * Clear the phone thread for the current chat:
 * - remove every tagged SMS burst from ctx().chat
 * - reset the unread counter
 * - optionally drop the rolling summary and refresh the context prompts
 * - always refresh the badge (it may be visible even when the modal is closed)
 *
 * Callers still invoke their own UI refresh (modal.refresh) afterward.
 * @param {Object} [opts]
 * @param {boolean} [opts.alsoSummary] when true, also clears main_summary and re-syncs context prompts
 */
export async function clearThread({ alsoSummary = false } = {}) {
    await chatSms.clearAllBursts(ctx().chat, cutChatMessage);
    storage.clearUnread();
    if (alsoSummary) {
        storage.resetSummary();
        context.updateAll();
    }
    badge.refresh();
}
