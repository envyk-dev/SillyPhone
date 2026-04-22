// Bottom-sheet primitive. Renders a transient action list over the modal.
// Pure — no state, no knowledge of what actions do.
import { escapeHtml } from '../../util.js';

// host: any element that already contains .sp-modal-inner (the sheet mounts
// inside it so it inherits the modal's stacking context).
// items: [{ label, icon?, destructive?, action }]
export function showSheet(host, items) {
    const root = host.querySelector('.sp-modal-inner') || host;
    const existing = root.querySelector('.sp-sheet');
    if (existing) existing.remove();

    const sheet = document.createElement('div');
    sheet.className = 'sp-sheet';
    sheet.innerHTML = `
        <div class="sp-sheet-backdrop"></div>
        <div class="sp-sheet-content">
            ${items.map((item, i) => `
                <button class="sp-sheet-btn ${item.destructive ? 'sp-sheet-destructive' : ''}" data-idx="${i}">
                    <span class="sp-sheet-icon">${item.icon || ''}</span>
                    <span>${escapeHtml(item.label)}</span>
                </button>
            `).join('')}
            <button class="sp-sheet-btn sp-sheet-cancel" data-cancel>Cancel</button>
        </div>
    `;
    root.appendChild(sheet);

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
