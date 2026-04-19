// Wrappers around SillyTavern's chatMetadata for SillyPhone's per-chat state.
import { ctx } from './st.js';

const KEY = 'sillyphone';

function getState() {
    const meta = ctx().chatMetadata;
    if (!meta[KEY]) {
        meta[KEY] = { thread: [], unread: 0, main_summary: null };
    }
    return meta[KEY];
}

function persist() {
    ctx().saveMetadataDebounced();
}

export function getThread() {
    return getState().thread.slice();
}

export function addToThread(entry) {
    // entry: { from: 'user' | 'char', msgs: [...], ts: number }
    const s = getState();
    s.thread.push(entry);
    persist();
}

export function clearThread() {
    const s = getState();
    s.thread = [];
    s.unread = 0;
    persist();
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
    // obj: { text: string, coveredUpToIdx: number, generatedAt: number }
    const s = getState();
    s.main_summary = obj;
    persist();
}

export function resetSummary() {
    const s = getState();
    s.main_summary = null;
    persist();
}
