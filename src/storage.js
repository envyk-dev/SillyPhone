// Per-chat state that is NOT a chat message: unread counter + rolling summary.
// SMS bursts themselves live in ctx().chat as tagged messages (see chat-sms.js).
import { ctx } from './st.js';

const KEY = 'sillyphone';

function getState() {
    const meta = ctx().chatMetadata;
    if (!meta[KEY]) {
        meta[KEY] = { unread: 0, main_summary: null };
    }
    // Defensive cleanup of legacy fields from the pre-rearchitecture format.
    if ('thread' in meta[KEY]) delete meta[KEY].thread;
    return meta[KEY];
}

function persist() {
    ctx().saveMetadataDebounced();
}

export function getUnread() {
    return getState().unread || 0;
}

export function incUnread(n = 1) {
    const s = getState();
    s.unread = (s.unread || 0) + n;
    persist();
}

export function clearUnread() {
    const s = getState();
    s.unread = 0;
    persist();
}

export function getSummary() {
    return getState().main_summary;
}

export function setSummary(obj) {
    const s = getState();
    s.main_summary = obj;
    persist();
}

export function resetSummary() {
    const s = getState();
    s.main_summary = null;
    persist();
}
