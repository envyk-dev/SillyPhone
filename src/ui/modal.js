// Full-screen phone modal: header, messages, input bar. Submodules handle
// manage mode (multi-select delete), attachment staging, and the bottom-sheet
// primitive. Bursts are sourced from ctx().chat via chat-sms; storage is
// only used for the unread counter.
import * as storage from '../storage.js';
import * as bubbles from './bubbles.js';
import * as chatSms from '../chat-sms.js';
import * as commands from '../commands.js';
import { ctx } from '../st.js';
import { playBubbles } from './playback.js';
import { SEND_ICON, PLUS_ICON, BACK_ICON, TRASH_ICON } from './icons.js';
import { showInfoPopover, dismissPopover } from './modal/popover.js';
import { showSettingsSheet, dismissSettingsSheet } from './modal/settings-sheet.js';
import * as manageMode from './modal/manage-mode.js';
import * as attachmentStaging from './modal/attachment-staging.js';

let modalEl = null;
let messagesEl = null;
let inputEl = null;
let sendBtn = null;
let closeBtn = null;
let menuBtn = null;
let trashBtn = null;
let attachBtn = null;
let avatarImgEl = null;
let avatarFallbackEl = null;
let statusEl = null;
let onSendHandler = null;
let onRerollHandler = null;
let charName = 'Contact';
let rerollInFlight = false;

export function mount({ onSend, onReroll }) {
    onSendHandler = onSend;
    onRerollHandler = onReroll;
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'sillyphone-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.style.display = 'none';
    modalEl.innerHTML = `
        <div class="sp-modal-inner">
            <header class="sp-modal-header">
                <button class="sp-modal-close" aria-label="Close phone">${BACK_ICON}</button>
                <div class="sp-modal-avatar">
                    <img class="sp-modal-avatar-img" alt="" hidden>
                    <span class="sp-modal-avatar-fallback"></span>
                    <span class="sp-modal-avatar-presence"></span>
                </div>
                <div class="sp-modal-name-block">
                    <div class="sp-modal-name"></div>
                    <div class="sp-modal-status">Active now</div>
                </div>
                <button class="sp-modal-menu" aria-label="Menu">⋮</button>
                <button class="sp-modal-trash" aria-label="Delete selected" hidden disabled>${TRASH_ICON}</button>
            </header>
            <div class="sp-modal-messages" role="log" aria-live="polite"></div>
            <form class="sp-modal-input">
                <div class="sp-attachment-chip" hidden></div>
                <div class="sp-input-row">
                    <button type="button" class="sp-attachment-btn" aria-label="Add attachment">${PLUS_ICON}</button>
                    <div class="sp-input-pill">
                        <textarea placeholder="Type a message... (line = bubble)" rows="1" aria-label="Message input"></textarea>
                        <button type="submit" class="sp-send-btn" aria-label="Send">${SEND_ICON}</button>
                    </div>
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
    avatarImgEl = modalEl.querySelector('.sp-modal-avatar-img');
    avatarFallbackEl = modalEl.querySelector('.sp-modal-avatar-fallback');
    statusEl = modalEl.querySelector('.sp-modal-status');
    const attachmentChipEl = modalEl.querySelector('.sp-attachment-chip');

    manageMode.init({
        messagesEl, closeBtn, menuBtn, trashBtn, sendBtn, attachBtn, inputEl,
        refresh,
        onExit: reconcileRerollIcon,
    });
    attachmentStaging.init({
        chipEl: attachmentChipEl,
        inputEl,
        sheetHost: modalEl,
        triggerEl: attachBtn,
        isBlocked: manageMode.isActive,
    });

    closeBtn.addEventListener('click', handleCloseClick);
    menuBtn.addEventListener('click', openMenu);
    attachBtn.addEventListener('click', attachmentStaging.openMenu);

    modalEl.addEventListener('click', (e) => {
        // Only trigger on true backdrop clicks. closest() would misfire when
        // a child (e.g. sheet button) is removed mid-click — its detached
        // target returns null from closest and spuriously dismisses.
        if (e.target === modalEl) handleCloseClick();
    });

    // Attachment description reveal — tap a card (outside manage mode) to
    // peek at the description that's otherwise only in the model's context.
    // Manage-mode owns the card click for selection, so bail out there.
    messagesEl.addEventListener('click', (e) => {
        if (manageMode.isActive()) return;
        const el = e.target.closest('.sp-attachment-placeholder');
        if (!el) return;
        const chatIdx = Number(el.dataset.entryIdx);
        if (!Number.isInteger(chatIdx)) return;
        const att = ctx().chat?.[chatIdx]?.extra?.sillyphone?.attachment;
        if (!att?.description) return;
        showInfoPopover(modalEl, el, { kind: att.kind, body: att.description });
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) {
            if (manageMode.isActive()) manageMode.exit();
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
    const attachment = attachmentStaging.get();
    if (!text.trim() && !attachment) return;
    if (sendBtn.disabled) return;
    const payload = { text, attachment };
    inputEl.value = '';
    attachmentStaging.clear();
    autoGrow();
    if (onSendHandler) onSendHandler(payload);
}

export function setCharInfo(name) {
    charName = name || 'Contact';
    if (!modalEl) return;
    modalEl.querySelector('.sp-modal-name').textContent = charName;
    applyAvatar();
    setStatus('Active now');
}

function applyAvatar() {
    if (!avatarImgEl || !avatarFallbackEl) return;
    avatarFallbackEl.textContent = (charName?.[0] || '?').toUpperCase();
    let url = null;
    try {
        const c = ctx();
        const file = c.characters?.[c.characterId]?.avatar;
        if (file && typeof c.getThumbnailUrl === 'function') {
            url = c.getThumbnailUrl('avatar', file);
        }
    } catch { /* ctx not ready, fall back to initial */ }
    if (url) {
        avatarImgEl.src = url;
        avatarImgEl.hidden = false;
        avatarFallbackEl.hidden = true;
    } else {
        avatarImgEl.hidden = true;
        avatarImgEl.removeAttribute('src');
        avatarFallbackEl.hidden = false;
    }
}

// Update the small "Active now" / "typing..." line under the contact name.
// No-op while in manage mode — the status row visually stays put but the
// state would be misleading.
function setStatus(text) {
    if (!statusEl) return;
    if (manageMode.isActive()) return;
    statusEl.textContent = text;
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
    // Dismiss any open popover / sheet first so nothing stale resurfaces
    // on reopen (popover anchor math would misalign; sheet would just
    // re-appear unexpectedly).
    dismissPopover(modalEl);
    dismissSettingsSheet(modalEl);
    manageMode.exit();
    modalEl.style.display = 'none';
}

export function isOpen() {
    return !!modalEl && modalEl.style.display !== 'none';
}

export function refresh() {
    if (!modalEl) return;
    const bursts = chatSms.listBursts(ctx().chat);
    bubbles.renderThread(bursts, messagesEl);
    if (manageMode.isActive()) manageMode.reapplySelection();
    reconcileRerollIcon();
}

export function appendBurst(burst) {
    if (!modalEl || !isOpen()) return;
    if (manageMode.isActive()) {
        refresh();
    } else {
        bubbles.appendBurst(burst, messagesEl);
        reconcileRerollIcon();
    }
}

function reconcileRerollIcon() {
    if (!messagesEl) return;
    const enabled = !manageMode.isActive()
        && !rerollInFlight
        && typeof onRerollHandler === 'function'
        && !sendBtn?.disabled;
    bubbles.reconcileReroll(messagesEl, handleRerollClick, enabled);
}

function handleRerollClick() {
    if (rerollInFlight) return;
    if (typeof onRerollHandler !== 'function') return;
    onRerollHandler();
}

// Called by index.js around the reroll lifecycle so the icon hides and
// the send/attach controls mirror a normal in-flight send.
export function setRerollInFlight(on) {
    rerollInFlight = !!on;
    reconcileRerollIcon();
}

export function showTyping() {
    if (!modalEl || !isOpen() || manageMode.isActive()) return;
    bubbles.showTyping(messagesEl);
    setStatus('typing…');
    reconcileRerollIcon();
}

export function hideTyping() {
    if (!modalEl) return;
    bubbles.hideTyping(messagesEl);
    setStatus('Active now');
    reconcileRerollIcon();
}

export function setSendDisabled(disabled) {
    if (sendBtn) sendBtn.disabled = disabled;
    reconcileRerollIcon();
}

// Force scroll to bottom, bypassing the "only if near bottom" heuristic.
// Used when the user sends a message so their own text is always visible.
export function scrollToBottom() {
    if (!messagesEl) return;
    requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    });
}

export async function playCharBurst(msgs, ts, attachment, timing, chatIdx) {
    if (!modalEl || !isOpen()) return;
    if (manageMode.isActive()) {
        refresh();
        return;
    }
    // Snap to bottom before the sequenced reveal starts so the user never
    // misses the first typing dots / bubble.
    scrollToBottom();
    await playBubbles(msgs, messagesEl, 'char', ts, attachment ?? null, timing ?? null, chatIdx ?? null);
    reconcileRerollIcon();
}

function handleCloseClick() {
    if (manageMode.isActive()) manageMode.exit();
    else close();
}

function openMenu() {
    if (manageMode.isActive()) return;
    showSettingsSheet(modalEl, {
        onEnterManage: manageMode.enter,
        onClearChat: confirmClearChat,
    });
}

async function confirmClearChat() {
    if (!confirm('Clear entire phone conversation for this chat? This cannot be undone.')) return;
    await commands.clearThread();
    refresh();
}
