// Full-screen phone modal: header, messages area, input bar.
import * as storage from '../storage.js';
import * as bubbles from './bubbles.js';
import { playBubbles } from './playback.js';

let modalEl = null;
let messagesEl = null;
let inputEl = null;
let sendBtn = null;
let onSendHandler = null;
let charName = 'Contact';

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
                <button class="sp-modal-close" aria-label="Close phone">←</button>
                <img class="sp-modal-avatar" alt="" src="" />
                <div class="sp-modal-name"></div>
                <button class="sp-modal-menu" aria-label="Menu">⋮</button>
            </header>
            <div class="sp-modal-messages" role="log" aria-live="polite"></div>
            <form class="sp-modal-input">
                <textarea placeholder="Type a message..." rows="1" aria-label="Message input"></textarea>
                <button type="submit" aria-label="Send">➤</button>
            </form>
        </div>
    `;
    document.body.appendChild(modalEl);

    messagesEl = modalEl.querySelector('.sp-modal-messages');
    inputEl = modalEl.querySelector('textarea');
    sendBtn = modalEl.querySelector('.sp-modal-input button');

    modalEl.querySelector('.sp-modal-close').addEventListener('click', close);
    modalEl.querySelector('.sp-modal-menu').addEventListener('click', openMenu);

    modalEl.querySelector('.sp-modal-input').addEventListener('submit', (e) => {
        e.preventDefault();
        submitInput();
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitInput();
        }
    });

    inputEl.addEventListener('input', autoGrow);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) close();
    });
}

function autoGrow() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
}

function submitInput() {
    const text = inputEl.value.trim();
    if (!text) return;
    if (sendBtn.disabled) return;
    inputEl.value = '';
    autoGrow();
    if (onSendHandler) onSendHandler(text);
}

export function setCharInfo(name, avatarUrl) {
    charName = name || 'Contact';
    if (!modalEl) return;
    modalEl.querySelector('.sp-modal-name').textContent = charName;
    const img = modalEl.querySelector('.sp-modal-avatar');
    if (avatarUrl) {
        img.src = avatarUrl;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
    }
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
    modalEl.style.display = 'none';
}

export function isOpen() {
    return !!modalEl && modalEl.style.display !== 'none';
}

export function refresh() {
    if (!modalEl) return;
    bubbles.renderThread(storage.getThread(), messagesEl);
}

export function appendBurst(burst) {
    if (!modalEl || !isOpen()) return;
    bubbles.appendBurst(burst, messagesEl);
}

export function appendSingle(msg, from, ts) {
    if (!modalEl) return null;
    return bubbles.appendSingle(msg, from, ts, messagesEl);
}

export function showTyping() {
    if (!modalEl || !isOpen()) return;
    bubbles.showTyping(messagesEl);
}

export function hideTyping() {
    if (!modalEl) return;
    bubbles.hideTyping(messagesEl);
}

export function setSendDisabled(disabled) {
    if (sendBtn) sendBtn.disabled = disabled;
}

export async function playCharBurst(msgs) {
    if (!modalEl || !isOpen()) return;
    await playBubbles(msgs, messagesEl, 'char');
}

function openMenu() {
    const choice = prompt('Menu:\n1. Clear thread\n2. Cancel\nEnter 1 or 2:');
    if (choice === '1') {
        if (confirm('Clear entire phone conversation for this chat?')) {
            storage.clearThread();
            refresh();
        }
    }
}
