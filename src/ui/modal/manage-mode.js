// Manage mode: multi-select bulk-delete UI layered over the modal.
// The shell owns the DOM; this module only drives its state — the selected
// set, enter/exit transitions, and the delete operation.
import * as chatSms from '../../chat-sms.js';
import { ctx, cutChatMessage, replaceChatMessage } from '../../st.js';
import { BACK_ICON } from '../icons.js';
import { deleteImage } from '../../image-upload.js';

const selectedIds = new Set();
let active = false;

let messagesEl = null;
let closeBtn = null;
let menuBtn = null;
let trashBtn = null;
let sendBtn = null;
let attachBtn = null;
let inputEl = null;
let refresh = () => {};
let onExit = () => {};

export function init(deps) {
    messagesEl = deps.messagesEl;
    closeBtn = deps.closeBtn;
    menuBtn = deps.menuBtn;
    trashBtn = deps.trashBtn;
    sendBtn = deps.sendBtn;
    attachBtn = deps.attachBtn;
    inputEl = deps.inputEl;
    refresh = deps.refresh || refresh;
    onExit = deps.onExit || onExit;

    trashBtn.addEventListener('click', handleBulkDelete);
    messagesEl.addEventListener('click', handleMessagesClick);
}

export function isActive() {
    return active;
}

export function enter() {
    active = true;
    selectedIds.clear();
    refresh();
    messagesEl.classList.add('sp-manage-mode');
    closeBtn.textContent = 'Done';
    closeBtn.classList.add('sp-manage-done');
    closeBtn.setAttribute('aria-label', 'Done managing messages');
    menuBtn.hidden = true;
    trashBtn.hidden = false;
    updateTrashButtonState();
    sendBtn.disabled = true;
    attachBtn.disabled = true;
    inputEl.disabled = true;
    inputEl.placeholder = 'Select messages to delete';
}

export function exit() {
    if (!active) return;
    active = false;
    selectedIds.clear();
    messagesEl.classList.remove('sp-manage-mode');
    closeBtn.innerHTML = BACK_ICON;
    closeBtn.classList.remove('sp-manage-done');
    closeBtn.setAttribute('aria-label', 'Close phone');
    menuBtn.hidden = false;
    trashBtn.hidden = true;
    sendBtn.disabled = false;
    attachBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.placeholder = 'Type a message... (line = bubble)';
    onExit();
}

// After a thread re-render, the DOM loses the sp-selected class. Reapply
// from the Set so selection survives incoming bursts while in manage mode.
export function reapplySelection() {
    if (!messagesEl) return;
    for (const key of selectedIds) {
        const [kind, chatIdx, msgIdx] = key.split(':');
        const sel = kind === 'att'
            ? `.sp-attachment-placeholder[data-entry-idx="${chatIdx}"]`
            : `.sp-bubble[data-entry-idx="${chatIdx}"][data-msg-idx="${msgIdx}"]`;
        const el = messagesEl.querySelector(sel);
        if (el) el.classList.add('sp-selected');
    }
}

function handleMessagesClick(e) {
    if (!active) return;
    const target = e.target.closest('.sp-bubble, .sp-attachment-placeholder');
    if (!target) return;
    const chatIdx = Number(target.dataset.entryIdx);
    if (!Number.isInteger(chatIdx)) return;

    const key = target.classList.contains('sp-attachment-placeholder')
        ? `att:${chatIdx}`
        : `msg:${chatIdx}:${Number(target.dataset.msgIdx)}`;

    if (selectedIds.has(key)) {
        selectedIds.delete(key);
        target.classList.remove('sp-selected');
    } else {
        selectedIds.add(key);
        target.classList.add('sp-selected');
    }
    updateTrashButtonState();
}

function updateTrashButtonState() {
    if (!trashBtn) return;
    trashBtn.disabled = selectedIds.size === 0;
}

async function handleBulkDelete() {
    if (!active || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} item${count === 1 ? '' : 's'}? This cannot be undone.`)) return;

    // Group selection by chatIdx so we can apply all deletions within a burst
    // sequentially to a single rolling chatMsg copy.
    const byChatIdx = new Map();
    for (const key of selectedIds) {
        const [kind, chatIdxStr, msgIdxStr] = key.split(':');
        const chatIdx = Number(chatIdxStr);
        if (!byChatIdx.has(chatIdx)) byChatIdx.set(chatIdx, { msgIdxs: [], attachment: false });
        const entry = byChatIdx.get(chatIdx);
        if (kind === 'att') entry.attachment = true;
        else entry.msgIdxs.push(Number(msgIdxStr));
    }

    // Descending chatIdx first so later deletions don't shift earlier indices.
    const chatIdxs = Array.from(byChatIdx.keys()).sort((a, b) => b - a);
    // Candidate paths: the image any mutated burst USED to carry. Not yet
    // confirmed orphans — we reconcile against the post-mutation chat state
    // below so a silently-failed /cut doesn't leave a ghost <img> 404'ing.
    const candidateOrphans = [];
    for (const chatIdx of chatIdxs) {
        const { msgIdxs, attachment } = byChatIdx.get(chatIdx);
        let current = ctx().chat?.[chatIdx];
        if (!current) continue;
        const originalImage = current?.extra?.sillyphone?.attachment?.image || null;

        let removed = false;
        // Bubbles first, descending msgIdx so splice indices stay valid.
        msgIdxs.sort((a, b) => b - a);
        for (const mi of msgIdxs) {
            const r = chatSms.deleteMessageFromBurst(current, mi);
            if (r.action === 'remove') { removed = true; break; }
            if (r.action === 'update') current = r.msg;
        }
        if (!removed && attachment) {
            const r = chatSms.deleteAttachmentFromBurst(current);
            if (r.action === 'remove') removed = true;
            else if (r.action === 'update') current = r.msg;
        }

        if (removed) {
            // eslint-disable-next-line no-await-in-loop
            await cutChatMessage(chatIdx);
            if (originalImage) candidateOrphans.push(originalImage);
        } else {
            replaceChatMessage(chatIdx, current);
            if (attachment && originalImage) candidateOrphans.push(originalImage);
        }
    }
    // Force an immediate save BEFORE running cleanup. replaceChatMessage
    // uses saveChatDebounced (1-2s delay) — without this, a fast refresh
    // after delete reloads the pre-mutation state from disk and the tag
    // "comes back". /cut already saves via its own path, but calling this
    // unconditionally is a harmless no-op for the cut case.
    try { await ctx().saveChat?.(); } catch (err) { console.warn('[SillyPhone] saveChat failed after delete', err); }

    // Reconcile: delete files ONLY if nothing in chat still points at them.
    // Guards against /cut silently no-op'ing (the failure that used to
    // produce "ghost" cards with a broken-image icon — file wiped on disk,
    // but the tag with its path still in extra.sillyphone.attachment.image).
    const stillReferenced = new Set();
    for (const msg of ctx().chat || []) {
        const p = msg?.extra?.sillyphone?.attachment?.image;
        if (typeof p === 'string' && p.length > 0) stillReferenced.add(p);
    }
    for (const p of candidateOrphans) {
        if (!stillReferenced.has(p)) deleteImage(p);
    }

    selectedIds.clear();
    exit();
    refresh();
}
