// Bind / replace / unbind a real image on an existing char-burst attachment.
// AI cards arrive with attachment.image = null (the model can't upload) —
// this lets the user decide what the card actually looks like. Description
// is never touched; only the visual binding on extra.sillyphone.attachment.
import { ctx, replaceChatMessage } from '../../st.js';
import { uploadImage, deleteImage } from '../../image-upload.js';

let sheetHost = null;
let onChange = () => {};
let fileInputEl = null;
let pending = null; // { chatIdx, existingPath }

export function init(deps) {
    sheetHost = deps.sheetHost;
    onChange = deps.onChange || onChange;

    // Hidden input — one per init, reused across picks. Reset .value on each
    // open so selecting the same file twice still fires 'change'. No focus-
    // based cancel detection: cancel just means do nothing, unlike the user
    // staging flow which falls back to a description-only prompt.
    fileInputEl = document.createElement('input');
    fileInputEl.type = 'file';
    fileInputEl.accept = 'image/*';
    fileInputEl.hidden = true;
    fileInputEl.addEventListener('change', handleFilePicked);
    sheetHost.appendChild(fileInputEl);
}

export function bindImage(chatIdx, existingPath) {
    if (!fileInputEl) return;
    pending = { chatIdx, existingPath: existingPath || null };
    fileInputEl.value = '';
    fileInputEl.click();
}

export async function unbindImage(chatIdx, kind, existingPath) {
    const label = kind === 'video' ? 'video' : 'image';
    if (!confirm(`Clear the ${label} from this message? The description stays.`)) return;
    const msg = ctx().chat?.[chatIdx];
    if (!msg?.extra?.sillyphone?.attachment) return;
    const next = applyAttachmentImage(msg, null);
    replaceChatMessage(chatIdx, next);
    // Force immediate save — replaceChatMessage uses saveChatDebounced and a
    // fast refresh could reload pre-mutation state from disk otherwise.
    try { await ctx().saveChat?.(); } catch (err) { console.warn('[SillyPhone] saveChat failed after image unbind', err); }
    if (existingPath) deleteImage(existingPath);
    onChange();
}

async function handleFilePicked() {
    const file = fileInputEl?.files?.[0];
    const task = pending;
    pending = null;
    if (!file || !task) return;

    const original = ctx().chat?.[task.chatIdx];
    if (!original?.extra?.sillyphone?.attachment) return;

    let path = null;
    try {
        path = await uploadImage(file);
    } catch (err) {
        console.error('[SillyPhone] image upload failed', err);
        window.alert('Image upload failed.');
        return;
    }

    // Re-read the target after the async upload — chat may have mutated
    // while the upload was in flight (edit, /cut, etc). If the attachment
    // is gone, don't strand the freshly uploaded file on disk.
    const current = ctx().chat?.[task.chatIdx];
    if (!current?.extra?.sillyphone?.attachment) {
        deleteImage(path);
        return;
    }

    const next = applyAttachmentImage(current, path);
    replaceChatMessage(task.chatIdx, next);
    try { await ctx().saveChat?.(); } catch (err) { console.warn('[SillyPhone] saveChat failed after image bind', err); }
    // Replace case: delete the old file AFTER the new one is bound, so a
    // failed upload doesn't leave the card with a broken reference.
    if (task.existingPath && task.existingPath !== path) deleteImage(task.existingPath);
    onChange();
}

function applyAttachmentImage(msg, imagePath) {
    const tag = msg.extra.sillyphone;
    const nextAttachment = { ...tag.attachment, image: imagePath };
    return {
        ...msg,
        extra: {
            ...msg.extra,
            sillyphone: { ...tag, attachment: nextAttachment },
        },
    };
}
