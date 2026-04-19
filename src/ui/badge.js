// Floating phone badge in bottom-right corner. Click → open modal.
import * as storage from '../storage.js';
import * as settings from '../settings.js';

let badgeEl = null;
let onClickHandler = null;

export function mount(onClick) {
    onClickHandler = onClick;
    if (badgeEl) return;
    badgeEl = document.createElement('button');
    badgeEl.id = 'sillyphone-badge';
    badgeEl.setAttribute('aria-label', 'Open phone, 0 unread');
    badgeEl.innerHTML = `
        <span class="sp-badge-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
                <path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/>
                <path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>
            </svg>
        </span>
        <span class="sp-badge-count" aria-hidden="true">0</span>
    `;
    badgeEl.addEventListener('click', () => {
        if (onClickHandler) onClickHandler();
    });
    // Append to <html> to escape any body-level transforms that break position:fixed.
    (document.documentElement || document.body).appendChild(badgeEl);
    refresh();
}

export function refresh() {
    if (!badgeEl) return;
    const visible = settings.get('enabled') && settings.get('showBadge');
    badgeEl.style.display = visible ? 'flex' : 'none';
    const n = storage.getUnread();
    const counter = badgeEl.querySelector('.sp-badge-count');
    counter.textContent = String(n);
    counter.style.display = n > 0 ? 'flex' : 'none';
    badgeEl.setAttribute('aria-label', `Open phone, ${n} unread`);
}

export function unmount() {
    if (badgeEl) {
        badgeEl.remove();
        badgeEl = null;
    }
}
