// Combined settings + actions sheet. Mounted by modal.openMenu() as the new
// target of the header's ⋮ button. Replaces the old 2-item Delete/Clear
// menu with a single surface that also hosts the high-traffic toggles
// (SMS-only, Floating badge, Toast sound, Show [SMS] rows).
//
// Writes go through settings.set with the same post-write wiring as the
// Extensions drawer panel so the two surfaces stay behaviorally identical.
import * as settings from '../../settings.js';
import * as badge from '../badge.js';
import * as context from '../../context.js';
import { applySmsRowVisibility } from '../settings-panel.js';
import { escapeHtml } from '../../util.js';
import { TRASH_SMALL_ICON, CLOSE_ICON } from '../icons.js';

const TOGGLES = [
    { key: 'smsOnly',     label: 'SMS-only mode',   sub: 'Drop host prose around markers' },
    { key: 'showBadge',   label: 'Floating badge',  sub: 'Show phone button when closed' },
    { key: 'toastSound',  label: 'Toast sound',     sub: 'Play chime for new messages' },
    { key: 'showSmsRows', label: 'Show [SMS] rows', sub: 'Reveal hidden rows in main chat' },
];

// host: modal element containing .sp-modal-inner.
// callbacks: { onEnterManage, onClearChat } — fired by the two action rows.
export function showSettingsSheet(host, { onEnterManage, onClearChat }) {
    const root = host.querySelector('.sp-modal-inner') || host;
    const existing = root.querySelector('.sp-sheet');
    if (existing) existing.remove();

    const sheet = document.createElement('div');
    sheet.className = 'sp-sheet';
    sheet.innerHTML = `
        <div class="sp-sheet-backdrop"></div>
        <div class="sp-sheet-content">
            <div class="sp-sheet-handle"></div>
            <div class="sp-sheet-title">Phone settings</div>
            ${TOGGLES.map(toggleRow).join('')}
            <div class="sp-sheet-divider"></div>
            <button class="sp-sheet-btn" data-action="manage" type="button">
                <span class="sp-sheet-icon">${CLOSE_ICON}</span>
                <span>Delete messages</span>
            </button>
            <button class="sp-sheet-btn sp-sheet-destructive" data-action="clear" type="button">
                <span class="sp-sheet-icon">${TRASH_SMALL_ICON}</span>
                <span>Clear chat</span>
            </button>
            <button class="sp-sheet-btn sp-sheet-cancel" data-cancel type="button">Cancel</button>
        </div>
    `;
    root.appendChild(sheet);

    const dismiss = () => sheet.remove();

    sheet.querySelector('.sp-sheet-backdrop').addEventListener('click', dismiss);
    sheet.querySelector('[data-cancel]').addEventListener('click', dismiss);

    // Toggle rows are live — clicking flips the setting and updates the
    // switch in place. Sheet stays open so the user can flip several in
    // one session without re-opening.
    sheet.querySelectorAll('.sp-sheet-toggle').forEach(row => {
        row.addEventListener('click', () => {
            const key = row.dataset.key;
            const next = !settings.get(key);
            settings.set(key, next);
            row.querySelector('.sp-switch').classList.toggle('on', next);
            row.setAttribute('aria-checked', String(next));
            badge.refresh();
            context.updateAll();
            applySmsRowVisibility();
        });
    });

    sheet.querySelector('[data-action="manage"]').addEventListener('click', () => {
        dismiss();
        onEnterManage();
    });
    sheet.querySelector('[data-action="clear"]').addEventListener('click', () => {
        dismiss();
        onClearChat();
    });
}

// Dismiss the settings sheet if it's mounted inside host. Used by
// modal.close() so a sheet left open when the phone is closed doesn't
// resurface on reopen. No-op if no sheet is open.
export function dismissSettingsSheet(host) {
    const root = host.querySelector('.sp-modal-inner') || host;
    const sheet = root.querySelector('.sp-sheet');
    if (sheet) sheet.remove();
}

function toggleRow({ key, label, sub }) {
    const on = !!settings.get(key);
    return `
        <button class="sp-sheet-toggle" data-key="${escapeHtml(key)}" type="button" role="switch" aria-checked="${on}">
            <span class="sp-sheet-toggle-label">
                <span class="sp-sheet-toggle-main">${escapeHtml(label)}</span>
                <span class="sp-sheet-toggle-sub">${escapeHtml(sub)}</span>
            </span>
            <span class="sp-switch ${on ? 'on' : ''}"></span>
        </button>
    `;
}
