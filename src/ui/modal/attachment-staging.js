// Staged attachment for the next outgoing user message: the chip shown above
// the input, the "Send image/video" picker sheet, and the description prompt.
// The shell reads .get() when building the send payload and calls .clear()
// after the send completes.
import { escapeHtml } from '../../util.js';
import { showPopover } from './popover.js';

let chipEl = null;
let inputEl = null;
let sheetHost = null;
let triggerEl = null;
let isBlocked = () => false;
let staged = null;

export function init(deps) {
    chipEl = deps.chipEl;
    inputEl = deps.inputEl;
    sheetHost = deps.sheetHost;
    triggerEl = deps.triggerEl;
    isBlocked = deps.isBlocked || (() => false);
}

export function get() {
    return staged;
}

export function clear() {
    staged = null;
    render();
}

export function render() {
    if (!chipEl) return;
    if (!staged) {
        chipEl.hidden = true;
        chipEl.innerHTML = '';
        return;
    }
    const icon = staged.kind === 'video' ? '🎥' : '📷';
    const kindLabel = staged.kind === 'video' ? 'Video' : 'Image';
    chipEl.hidden = false;
    chipEl.innerHTML = `
        <span class="sp-attachment-chip-icon">${icon}</span>
        <span class="sp-attachment-chip-label">${kindLabel}: ${escapeHtml(staged.description)}</span>
        <button type="button" class="sp-attachment-chip-clear" aria-label="Remove attachment">×</button>
    `;
    chipEl.querySelector('.sp-attachment-chip-clear').addEventListener('click', clear);
}

export function openMenu() {
    if (isBlocked()) return;
    if (!triggerEl) return;
    showPopover(sheetHost, triggerEl, [
        { label: 'Send image', icon: '📷', action: () => promptDescription('image') },
        { label: 'Send video', icon: '🎥', action: () => promptDescription('video') },
    ]);
}

function promptDescription(kind) {
    const label = kind === 'video' ? 'video' : 'image';
    const desc = window.prompt(`Describe the ${label} you want to send:\n(Visible to the character's context, not shown in the chat)`);
    if (desc == null) return;
    const trimmed = desc.trim();
    if (!trimmed) return;
    staged = { kind, description: trimmed };
    render();
    inputEl?.focus();
}
