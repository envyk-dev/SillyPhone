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
        <span class="sp-badge-icon">📱</span>
        <span class="sp-badge-count" aria-hidden="true">0</span>
    `;
    badgeEl.addEventListener('click', () => {
        if (onClickHandler) onClickHandler();
    });
    document.body.appendChild(badgeEl);
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
