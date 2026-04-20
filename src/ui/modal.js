// Full-screen phone modal: header, messages, input bar, menu sheet, manage mode.
// Bursts are sourced from ctx().chat via chat-sms; storage is only used for
// the unread counter.
import * as storage from '../storage.js';
import * as bubbles from './bubbles.js';
import * as chatSms from '../chat-sms.js';
import { deleteMessageFromBurst, deleteAttachmentFromBurst } from '../chat-sms.js';
import { ctx, cutChatMessage, replaceChatMessage } from '../st.js';
import { playBubbles } from './playback.js';

let modalEl = null;
let messagesEl = null;
let inputEl = null;
let sendBtn = null;
let closeBtn = null;
let menuBtn = null;
let trashBtn = null;
let attachBtn = null;
let attachmentChipEl = null;
let onSendHandler = null;
let charName = 'Contact';
let manageMode = false;

// Set of composite keys identifying selected items in manage mode.
// Keys: `msg:<chatIdx>:<msgIdx>` or `att:<chatIdx>`. Cleared on enter/exit.
const selectedIds = new Set();

const SEND_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/></svg>';
const PLUS_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
const BACK_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>';
const TRASH_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

// Attachment staged for the next send. null when none. Cleared on send or
// when the user clicks the chip's × button.
let stagedAttachment = null;

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

export function mount({ onSend }) {
    onSendHandler = onSend;
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'sillyphone-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.style.display = 'none';
    modalEl.innerHTML = `
        <div class="sp-modal-inner">
            <header class="sp-modal-header">
                <button class="sp-modal-close" aria-label="Close phone">${BACK_ICON_SVG}</button>
                <div class="sp-modal-name"></div>
                <button class="sp-modal-menu" aria-label="Menu">⋮</button>
                <button class="sp-modal-trash" aria-label="Delete selected" hidden disabled>${TRASH_ICON_SVG}</button>
            </header>
            <div class="sp-modal-messages" role="log" aria-live="polite"></div>
            <form class="sp-modal-input">
                <div class="sp-attachment-chip" hidden></div>
                <div class="sp-input-row">
                    <button type="button" class="sp-attachment-btn" aria-label="Add attachment">${PLUS_ICON_SVG}</button>
                    <textarea placeholder="Type a mesage... (line = bubble)" rows="1" aria-label="Message input"></textarea>
                    <button type="submit" aria-label="Send">${SEND_ICON_SVG}</button>
                </div>
            </form>
        </div>
    `;
    (document.documentElement || document.body).appendChild(modalEl);

    messagesEl = modalEl.querySelector('.sp-modal-messages');
    inputEl = modalEl.querySelector('textarea');
    sendBtn = modalEl.querySelector('.sp-modal-input button[type="submit"]');
    closeBtn = modalEl.querySelector('.sp-modal-close');
    menuBtn = modalEl.querySelector('.sp-modal-menu');
    trashBtn = modalEl.querySelector('.sp-modal-trash');
    attachBtn = modalEl.querySelector('.sp-attachment-btn');
    attachmentChipEl = modalEl.querySelector('.sp-attachment-chip');

    closeBtn.addEventListener('click', handleCloseClick);
    menuBtn.addEventListener('click', openMenu);
    trashBtn.addEventListener('click', handleBulkDeleteClick);
    attachBtn.addEventListener('click', openAttachmentMenu);

    modalEl.addEventListener('click', (e) => {
        // Only trigger on true backdrop clicks. closest() would misfire when
        // a child (e.g. sheet button) is removed mid-click — its detached
        // target returns null from closest and spuriously dismisses.
        if (e.target === modalEl) handleCloseClick();
    });

    modalEl.querySelector('.sp-modal-input').addEventListener('submit', (e) => {
        e.preventDefault();
        submitInput();
    });

    inputEl.addEventListener('keydown', (e) => {
        // On touch devices there's no Shift key — Enter always inserts a
        // newline, send button is the only submit. Desktop keeps Enter=send,
        // Shift+Enter=newline.
        const isTouch = window.matchMedia('(pointer: coarse)').matches;
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch) {
            e.preventDefault();
            submitInput();
        }
    });

    inputEl.addEventListener('input', autoGrow);

    messagesEl.addEventListener('click', handleMessagesClick);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) {
            if (manageMode) exitManageMode();
            else close();
        }
    });
}

function autoGrow() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
}

function submitInput() {
    const text = inputEl.value;
    if (!text.trim() && !stagedAttachment) return;
    if (sendBtn.disabled) return;
    const payload = { text, attachment: stagedAttachment };
    inputEl.value = '';
    stagedAttachment = null;
    renderStagedAttachment();
    autoGrow();
    if (onSendHandler) onSendHandler(payload);
}

export function setCharInfo(name) {
    charName = name || 'Contact';
    if (!modalEl) return;
    modalEl.querySelector('.sp-modal-name').textContent = charName;
}

export function open() {
    if (!modalEl) return;
    modalEl.style.display = 'flex';
    storage.clearUnread();
    refresh();
    setTimeout(() => inputEl?.focus(), 50);
}

export function close() {
    if (!modalEl) return;
    if (manageMode) exitManageMode();
    modalEl.style.display = 'none';
}

export function isOpen() {
    return !!modalEl && modalEl.style.display !== 'none';
}

export function isManageMode() {
    return manageMode;
}

export function refresh() {
    if (!modalEl) return;
    const bursts = chatSms.listBursts(ctx().chat);
    bubbles.renderThread(bursts, messagesEl);
    if (manageMode) reapplySelection();
}

export function appendBurst(burst) {
    if (!modalEl || !isOpen()) return;
    if (manageMode) {
        refresh();
    } else {
        bubbles.appendBurst(burst, messagesEl);
    }
}

export function showTyping() {
    if (!modalEl || !isOpen() || manageMode) return;
    bubbles.showTyping(messagesEl);
}

export function hideTyping() {
    if (!modalEl) return;
    bubbles.hideTyping(messagesEl);
}

export function setSendDisabled(disabled) {
    if (sendBtn) sendBtn.disabled = disabled;
}

// Force scroll to bottom, bypassing the "only if near bottom" heuristic.
// Used when the user sends a message so their own text is always visible.
export function scrollToBottom() {
    if (!messagesEl) return;
    requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    });
}

export async function playCharBurst(msgs, ts, attachment, timing) {
    if (!modalEl || !isOpen()) return;
    if (manageMode) {
        refresh();
        return;
    }
    // Snap to bottom before the sequenced reveal starts so the user never
    // misses the first typing dots / bubble.
    scrollToBottom();
    await playBubbles(msgs, messagesEl, 'char', ts, attachment ?? null, timing ?? null);
}

// ---------- Attachment staging ----------

function renderStagedAttachment() {
    if (!attachmentChipEl) return;
    if (!stagedAttachment) {
        attachmentChipEl.hidden = true;
        attachmentChipEl.innerHTML = '';
        return;
    }
    const icon = stagedAttachment.kind === 'video' ? '🎥' : '📷';
    const kindLabel = stagedAttachment.kind === 'video' ? 'Video' : 'Image';
    attachmentChipEl.hidden = false;
    attachmentChipEl.innerHTML = `
        <span class="sp-attachment-chip-icon">${icon}</span>
        <span class="sp-attachment-chip-label">${kindLabel}: ${escapeHtml(stagedAttachment.description)}</span>
        <button type="button" class="sp-attachment-chip-clear" aria-label="Remove attachment">×</button>
    `;
    attachmentChipEl.querySelector('.sp-attachment-chip-clear')
        .addEventListener('click', clearStagedAttachment);
}

function clearStagedAttachment() {
    stagedAttachment = null;
    renderStagedAttachment();
}

function openAttachmentMenu() {
    if (manageMode) return;
    showSheet([
        { label: 'Send image', icon: '📷', action: () => promptAttachmentDescription('image') },
        { label: 'Send video', icon: '🎥', action: () => promptAttachmentDescription('video') },
    ]);
}

function promptAttachmentDescription(kind) {
    const label = kind === 'video' ? 'video' : 'image';
    const desc = window.prompt(`Describe the ${label} you want to send:\n(Visible to the character's context, not shown in the chat)`);
    if (desc == null) return;
    const trimmed = desc.trim();
    if (!trimmed) return;
    stagedAttachment = { kind, description: trimmed };
    renderStagedAttachment();
    inputEl?.focus();
}

// ---------- Menu sheet ----------

function handleCloseClick() {
    if (manageMode) exitManageMode();
    else close();
}

function openMenu() {
    if (manageMode) return;
    showSheet([
        { label: 'Delete messages', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>', action: enterManageMode },
        { label: 'Clear chat', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', action: confirmClearChat, destructive: true },
    ]);
}

function showSheet(items) {
    const existing = modalEl.querySelector('.sp-sheet');
    if (existing) existing.remove();

    const sheet = document.createElement('div');
    sheet.className = 'sp-sheet';
    sheet.innerHTML = `
        <div class="sp-sheet-backdrop"></div>
        <div class="sp-sheet-content">
            ${items.map((item, i) => `
                <button class="sp-sheet-btn ${item.destructive ? 'sp-sheet-destructive' : ''}" data-idx="${i}">
                    <span class="sp-sheet-icon">${item.icon || ''}</span>
                    <span>${item.label}</span>
                </button>
            `).join('')}
            <button class="sp-sheet-btn sp-sheet-cancel" data-cancel>Cancel</button>
        </div>
    `;
    modalEl.querySelector('.sp-modal-inner').appendChild(sheet);

    const dismiss = () => sheet.remove();
    sheet.querySelector('.sp-sheet-backdrop').addEventListener('click', dismiss);
    sheet.querySelector('[data-cancel]').addEventListener('click', dismiss);
    sheet.querySelectorAll('[data-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.idx);
            dismiss();
            items[idx].action();
        });
    });
}

async function confirmClearChat() {
    if (!confirm('Clear entire phone conversation for this chat? This cannot be undone.')) return;
    const bursts = chatSms.listBursts(ctx().chat);
    // Cut highest index first so earlier indices stay valid during deletion.
    for (let i = bursts.length - 1; i >= 0; i--) {
        // eslint-disable-next-line no-await-in-loop
        await cutChatMessage(bursts[i].chatIdx);
    }
    storage.clearUnread();
    refresh();
}

// ---------- Manage mode ----------

function enterManageMode() {
    manageMode = true;
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

function exitManageMode() {
    manageMode = false;
    selectedIds.clear();
    messagesEl.classList.remove('sp-manage-mode');
    closeBtn.innerHTML = BACK_ICON_SVG;
    closeBtn.classList.remove('sp-manage-done');
    closeBtn.setAttribute('aria-label', 'Close phone');
    menuBtn.hidden = false;
    trashBtn.hidden = true;
    sendBtn.disabled = false;
    attachBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.placeholder = 'Type a mesage... (line = bubble)';
}

// Toggle selection: clicks in manage mode mark items for bulk delete instead
// of deleting them one by one.
function handleMessagesClick(e) {
    if (!manageMode) return;
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

// After a thread re-render, the DOM loses the sp-selected class. Reapply it
// from our Set so selection survives incoming bursts while in manage mode.
function reapplySelection() {
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

async function handleBulkDeleteClick() {
    if (!manageMode || selectedIds.size === 0) return;
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
    for (const chatIdx of chatIdxs) {
        const { msgIdxs, attachment } = byChatIdx.get(chatIdx);
        let current = ctx().chat?.[chatIdx];
        if (!current) continue;

        let removed = false;
        // Bubbles first, descending msgIdx so splice indices stay valid.
        msgIdxs.sort((a, b) => b - a);
        for (const mi of msgIdxs) {
            const r = deleteMessageFromBurst(current, mi);
            if (r.action === 'remove') { removed = true; break; }
            if (r.action === 'update') current = r.msg;
        }
        if (!removed && attachment) {
            const r = deleteAttachmentFromBurst(current);
            if (r.action === 'remove') removed = true;
            else if (r.action === 'update') current = r.msg;
        }

        if (removed) {
            // eslint-disable-next-line no-await-in-loop
            await cutChatMessage(chatIdx);
        } else {
            replaceChatMessage(chatIdx, current);
        }
    }

    selectedIds.clear();
    exitManageMode();
    refresh();
}
