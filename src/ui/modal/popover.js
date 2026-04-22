// Anchored popover primitive — renders a small action menu above (or below)
// a trigger element. Same item shape as sheet.js so consumers stay symmetric.
// Pure: no state, no knowledge of what actions do.
import { escapeHtml } from '../../util.js';

// host: any element that already contains .sp-modal-inner (popover mounts
//       inside it so it inherits the modal's stacking context).
// trigger: the element the menu anchors to. Popover opens above it,
//          left-edge aligned, with 8px breathing room.
// items: [{ label, icon?, destructive?, action }]
export function showPopover(host, trigger, items) {
    const root = host.querySelector('.sp-modal-inner') || host;
    const existing = root.querySelector('.sp-popover');
    if (existing) existing.remove();

    const popover = document.createElement('div');
    popover.className = 'sp-popover';
    popover.innerHTML = `
        <div class="sp-popover-backdrop"></div>
        <div class="sp-popover-menu">
            ${items.map((item, i) => `
                <button class="sp-popover-btn ${item.destructive ? 'sp-popover-destructive' : ''}" data-idx="${i}">
                    <span class="sp-popover-icon">${item.icon || ''}</span>
                    <span class="sp-popover-label">${escapeHtml(item.label)}</span>
                </button>
            `).join('')}
        </div>
    `;
    root.appendChild(popover);

    // Anchor the menu above the trigger. We position via `bottom`/`left`
    // relative to root so the popover stays glued to the trigger even if
    // root resizes between open/close.
    const menu = popover.querySelector('.sp-popover-menu');
    const triggerRect = trigger.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    menu.style.left = `${Math.max(8, triggerRect.left - rootRect.left)}px`;
    menu.style.bottom = `${rootRect.bottom - triggerRect.top + 8}px`;

    const dismiss = () => popover.remove();
    popover.querySelector('.sp-popover-backdrop').addEventListener('click', dismiss);
    popover.querySelectorAll('[data-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.idx);
            dismiss();
            items[idx].action();
        });
    });
}
