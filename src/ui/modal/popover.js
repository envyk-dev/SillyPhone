// Anchored popover primitive — renders content above (or below) a trigger
// element. Two flavours share the same shell/anchor math:
//   - showPopover: action menu (buttons)
//   - showInfoPopover: read-only info card (attachment descriptions, etc.)
// Pure: no state, no knowledge of what actions do.
import { escapeHtml } from '../../util.js';

// Mount a popover shell inside `host`, anchored above `trigger`, with
// arbitrary inner HTML. Shared by showPopover / showInfoPopover.
// Returns { popover, dismiss } so callers can wire per-flavour buttons.
function mountPopover(host, trigger, innerHtml, onDismiss) {
    const root = host.querySelector('.sp-modal-inner') || host;
    const existing = root.querySelector('.sp-popover');
    if (existing) existing.remove();

    const popover = document.createElement('div');
    popover.className = 'sp-popover';
    popover.innerHTML = `
        <div class="sp-popover-backdrop"></div>
        <div class="sp-popover-menu">${innerHtml}</div>
    `;
    root.appendChild(popover);

    // Anchor the menu above the trigger. Positioned via `bottom`/`left`
    // relative to root so the popover stays glued to the trigger even if
    // root resizes between open/close.
    const menu = popover.querySelector('.sp-popover-menu');
    const triggerRect = trigger.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    menu.style.left = `${Math.max(8, triggerRect.left - rootRect.left)}px`;
    menu.style.bottom = `${rootRect.bottom - triggerRect.top + 8}px`;

    const dismiss = () => {
        popover.remove();
        if (onDismiss) onDismiss();
    };
    popover.querySelector('.sp-popover-backdrop').addEventListener('click', dismiss);
    return { popover, dismiss };
}

// host: any element that already contains .sp-modal-inner (popover mounts
//       inside it so it inherits the modal's stacking context).
// trigger: the element the menu anchors to. Popover opens above it,
//          left-edge aligned, with 8px breathing room.
// items: [{ label, icon?, destructive?, action }]
export function showPopover(host, trigger, items) {
    const html = items.map((item, i) => `
        <button class="sp-popover-btn ${item.destructive ? 'sp-popover-destructive' : ''}" data-idx="${i}">
            <span class="sp-popover-icon">${item.icon || ''}</span>
            <span class="sp-popover-label">${escapeHtml(item.label)}</span>
        </button>
    `).join('');
    const { popover, dismiss } = mountPopover(host, trigger, html);
    popover.querySelectorAll('[data-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.idx);
            dismiss();
            items[idx].action();
        });
    });
}

// Dismiss any popover currently mounted inside `host`. Triggers the
// backdrop click so onDismiss callbacks (e.g. clearing .sp-attachment-open
// from an info-popover trigger) still fire. No-op if no popover is open.
export function dismissPopover(host) {
    const root = host.querySelector('.sp-modal-inner') || host;
    const backdrop = root.querySelector('.sp-popover-backdrop');
    if (backdrop) backdrop.click();
}

// Read-only info popover. Currently used to reveal attachment descriptions
// without printing them on the card itself (keeps IM immersion). The trigger
// gets `.sp-attachment-open` while the popover is mounted so CSS can ring it.
// info: { kind: 'image' | 'video', body: string }
export function showInfoPopover(host, trigger, { kind, body }) {
    const icon = kind === 'video' ? '🎥' : '📷';
    const kindLabel = kind === 'video' ? 'Video' : 'Image';
    const html = `
        <div class="sp-popover-info">
            <div class="sp-popover-info-kind">
                <span class="sp-popover-info-icon">${icon}</span>${escapeHtml(kindLabel)}
            </div>
            <div class="sp-popover-info-body">${escapeHtml(body)}</div>
        </div>
    `;
    trigger.classList.add('sp-attachment-open');
    mountPopover(host, trigger, html, () => {
        trigger.classList.remove('sp-attachment-open');
    });
}
