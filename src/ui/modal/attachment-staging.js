// Staged attachment for the next outgoing user message: the chip shown above
// the input, the "Send image/video" picker sheet, the file-picker flow, and
// the description prompt. The shell reads .get() when building the send
// payload and calls .clear() after the send completes (or the user cancels).
import { escapeHtml } from '../../util.js';
import { showPopover } from './popover.js';
import { uploadImage, deleteImage } from '../../image-upload.js';

let chipEl = null;
let inputEl = null;
let sheetHost = null;
let triggerEl = null;
let isBlocked = () => false;
let fileInputEl = null;
let staged = null;

export function init(deps) {
    chipEl = deps.chipEl;
    inputEl = deps.inputEl;
    sheetHost = deps.sheetHost;
    triggerEl = deps.triggerEl;
    isBlocked = deps.isBlocked || (() => false);

    // Hidden input — one per init, reused across picks. Reset .value on each
    // open so selecting the same file twice still fires 'change'.
    fileInputEl = document.createElement('input');
    fileInputEl.type = 'file';
    fileInputEl.accept = 'image/*';
    fileInputEl.hidden = true;
    fileInputEl.addEventListener('change', handleFilePicked);
    sheetHost.appendChild(fileInputEl);
}

export function get() {
    return staged;
}

// Called after a successful send: the file on disk is now owned by the
// committed burst's attachment.image, so do NOT delete it here — just wipe
// the staging slot.
export function reset() {
    staged = null;
    render();
}

// Called when the user actively removes a staged chip (× button) or when
// the flow aborts before send: the file was uploaded but is no longer
// referenced by anything, so remove it from disk.
export function discard() {
    if (staged?.image) deleteImage(staged.image);
    staged = null;
    render();
}

export function render() {
    if (!chipEl) return;
    if (!staged) {
        chipEl.hidden = true;
        chipEl.innerHTML = '';
        chipEl.classList.remove('sp-attachment-chip-thumb');
        return;
    }
    const kindLabel = staged.kind === 'video' ? 'Video' : 'Image';
    chipEl.hidden = false;
    // Variant C layout: thumbnail (if we have one) + stacked heading +
    // description subline. Image-only when attachment.image is set; otherwise
    // the kind icon stands in for the thumbnail. <img> is used instead of
    // background-image so a 404 is visible (broken-image icon) rather than
    // silently blank — makes misconfigured paths easy to spot.
    const hasThumb = !!staged.image;
    chipEl.classList.toggle('sp-attachment-chip-thumb', hasThumb);
    // Kind class on the thumb frame so CSS can drop a play-icon overlay for
    // video-kind attachments (same selector works for the bubble card).
    const kindClass = staged.kind === 'video' ? 'sp-attachment-video' : 'sp-attachment-image';
    chipEl.innerHTML = `
        <div class="sp-attachment-chip-thumb-img ${kindClass}${hasThumb ? '' : ' sp-attachment-chip-thumb-icon'}">${
            hasThumb ? '' : (staged.kind === 'video' ? '🎥' : '📷')
        }</div>
        <div class="sp-attachment-chip-text">
            <div class="sp-attachment-chip-heading">${kindLabel}</div>
            <div class="sp-attachment-chip-desc">${escapeHtml(staged.description)}</div>
        </div>
        <button type="button" class="sp-attachment-chip-clear" aria-label="Remove attachment">×</button>
    `;
    // Build the thumb <img> programmatically so the src goes through the same
    // DOM API the bubble uses (no innerHTML parse path). onerror surfaces a
    // load failure to the console with the exact URL so URL-encoding or
    // path-shape issues are easy to spot.
    if (hasThumb) {
        const frame = chipEl.querySelector('.sp-attachment-chip-thumb-img');
        const img = document.createElement('img');
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = 'inherit';
        img.onerror = () => console.warn('[SillyPhone] chip thumb failed to load', img.src, 'staged.image =', staged.image);
        img.src = '/' + String(staged.image).replace(/^\/+/, '');
        frame.appendChild(img);
    }
    chipEl.querySelector('.sp-attachment-chip-clear').addEventListener('click', discard);
}

export function openMenu() {
    if (isBlocked()) return;
    if (!triggerEl) return;
    showPopover(sheetHost, triggerEl, [
        { label: 'Send image', icon: '📷', action: () => openFilePicker('image') },
        { label: 'Send video', icon: '🎥', action: () => openFilePicker('video') },
    ]);
}

// Entry point for the "Send image" / "Send video" menu items. Opens the OS
// file picker (always accept=image/*; "video" is a label, not a real video —
// the user picks a still that gets rendered with a play-icon overlay to
// stand in for a video message). Cancel falls back to description-only so
// "imagine a video" still works.
let pendingKind = null;
function openFilePicker(kind) {
    if (!fileInputEl) return;
    pendingKind = kind === 'video' ? 'video' : 'image';
    fileInputEl.value = '';
    // Cancel/Escape on a file input doesn't fire a 'change' event in any
    // browser. Detect cancel by listening for the window refocus that
    // follows the dialog closing, then check whether a file was picked.
    const onFocus = () => {
        window.removeEventListener('focus', onFocus);
        setTimeout(() => {
            if (!fileInputEl.files || fileInputEl.files.length === 0) {
                // No file → fall back to description-only.
                promptDescription(pendingKind);
                pendingKind = null;
            }
        }, 100);
    };
    window.addEventListener('focus', onFocus, { once: true });
    fileInputEl.click();
}

async function handleFilePicked() {
    const file = fileInputEl?.files?.[0];
    const kind = pendingKind || 'image';
    pendingKind = null;
    if (!file) return;
    // A second pick while one is already staged replaces the prior upload —
    // delete the old file on disk before overwriting the staging slot so the
    // old upload doesn't linger as an orphan.
    if (staged?.image) deleteImage(staged.image);
    let path = null;
    try {
        path = await uploadImage(file);
    } catch (err) {
        console.error('[SillyPhone] image upload failed', err);
        window.alert('Image upload failed — sending as description only.');
        promptDescription(kind);
        return;
    }
    const label = kind === 'video' ? 'video' : 'image';
    const desc = window.prompt(`Describe the ${label} you're sending:\n(Visible to the character's context — the visual itself stays a preview)`);
    const trimmed = typeof desc === 'string' ? desc.trim() : '';
    if (!trimmed) {
        // User bailed out of the description step — don't stage a halfway
        // attachment, but do delete the file we just uploaded.
        deleteImage(path);
        return;
    }
    staged = { kind, description: trimmed, image: path };
    render();
    inputEl?.focus();
}

function promptDescription(kind) {
    const label = kind === 'video' ? 'video' : 'image';
    const desc = window.prompt(`Describe the ${label} you want to send:\n(Visible to the character's context — hover or tap the card in chat to preview)`);
    if (desc == null) return;
    const trimmed = desc.trim();
    if (!trimmed) return;
    staged = { kind, description: trimmed, image: null };
    render();
    inputEl?.focus();
}
