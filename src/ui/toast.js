// Toast notifications for new char messages while modal is closed.
import { escapeHtml } from '../util.js';

let container = null;
const AUTO_DISMISS_MS = 5000;
const MAX_STACK = 3;

function ensureContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.id = 'sillyphone-toast-container';
    document.body.appendChild(container);
    return container;
}

export function show({ charName, msgs, onClick }) {
    const c = ensureContainer();

    while (c.children.length >= MAX_STACK) {
        c.firstChild.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'sp-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-label', `New text from ${charName}`);

    const firstMsg = msgs[0] || '';
    const truncated = firstMsg.length > 60 ? firstMsg.slice(0, 57) + '…' : firstMsg;
    const moreNote = msgs.length > 1 ? ` +${msgs.length - 1} more` : '';

    toast.innerHTML = `
        <div class="sp-toast-name">${escapeHtml(charName || 'Contact')}</div>
        <div class="sp-toast-body">${escapeHtml(truncated)}${escapeHtml(moreNote)}</div>
    `;

    toast.addEventListener('click', () => {
        toast.remove();
        if (onClick) onClick();
    });

    c.appendChild(toast);

    const timer = setTimeout(() => {
        toast.classList.add('sp-toast-dismiss');
        setTimeout(() => toast.remove(), 300);
    }, AUTO_DISMISS_MS);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
}
