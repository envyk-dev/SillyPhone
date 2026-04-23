// @ts-check
// High-level verbs that compose data mutations + persistent-side-effect
// cleanup. Callers still handle their own UI refresh (e.g. modal.refresh)
// so this module stays UI-agnostic and circular imports are avoided.
import { ctx, cutChatMessage } from './st.js';
import * as chatSms from './chat-sms.js';
import * as storage from './storage.js';
import * as context from './context.js';
import * as badge from './ui/badge.js';
import { collectImagePaths, deleteImage } from './image-upload.js';

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
    // Snapshot image paths BEFORE clearing the bursts — once the rows are
    // cut, extra.sillyphone is gone and we can't find the files anymore.
    const candidates = collectImagePaths(ctx().chat);
    await chatSms.clearAllBursts(ctx().chat, cutChatMessage);
    // Force an immediate, non-debounced save so a fast page refresh can't
    // reload the pre-clear state from disk.
    try { await ctx().saveChat?.(); } catch (err) { console.warn('[SillyPhone] saveChat failed after clearThread', err); }
    // Reconcile against post-clear state: only delete files that aren't
    // still referenced. Guards against cuts that silently no-op, which
    // would otherwise wipe the file while the tag (and its path) stayed,
    // leaving a broken-image "ghost" in the thread.
    const stillReferenced = new Set(collectImagePaths(ctx().chat));
    for (const p of candidates) {
        if (!stillReferenced.has(p)) deleteImage(p);
    }
    storage.clearUnread();
    if (alsoSummary) {
        storage.resetSummary();
        context.updateAll();
    }
    badge.refresh();
}
