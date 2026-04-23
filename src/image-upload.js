// Real-image upload helpers. Saves through ST's own /api/images/upload so
// chat JSON only carries the relative path string, not base64 bytes. Resize
// caps memory + storage bloat before the round trip.
import { ctx } from './st.js';
import { saveBase64AsFile } from '../../../../utils.js';

const MAX_DIM = 1024;
const JPEG_QUALITY = 0.85;
const FILENAME_PREFIX = 'sp_';

/**
 * 5-char base36 id. Collision-resistant enough at this scale, no timestamp
 * leak. Used as the filename body after the sp_ prefix.
 * @returns {string}
 */
export function shortId() {
    return Math.random().toString(36).slice(2, 7).padEnd(5, '0');
}

/**
 * Read a File/Blob into an HTMLImageElement via data URL. Data URLs instead
 * of object URLs so we don't have to plumb revocation through the resize
 * pipeline — the intermediate string is transient.
 * @param {File|Blob} file
 * @returns {Promise<HTMLImageElement>}
 */
function loadFileAsImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('File read failed'));
        reader.onload = () => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image decode failed'));
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Downscale to fit within maxDim × maxDim (preserving aspect) and encode as
 * JPEG. Returns base64 with the mime prefix stripped — that's what
 * saveBase64AsFile expects.
 * @param {File|Blob} file
 * @param {Object} [opts]
 * @param {number} [opts.maxDim]
 * @param {number} [opts.quality]
 * @returns {Promise<string>} base64 body (no "data:image/jpeg;base64," prefix)
 */
export async function resizeToJpegBase64(file, { maxDim = MAX_DIM, quality = JPEG_QUALITY } = {}) {
    const img = await loadFileAsImage(file);
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext('2d');
    c.fillStyle = '#000'; // JPEG has no alpha; black floor beats random memory garbage for transparent PNGs
    c.fillRect(0, 0, w, h);
    c.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const match = /^data:image\/jpeg;base64,(.*)$/.exec(dataUrl);
    if (!match) throw new Error('canvas.toDataURL did not produce a jpeg');
    return match[1];
}

/**
 * Upload a picked image file and return the ST-relative URL path.
 * @param {File|Blob} file
 * @returns {Promise<string>} e.g. "user/images/Alice/sp_k2m8x.jpg"
 */
export async function uploadImage(file) {
    const base64 = await resizeToJpegBase64(file);
    const charName = ctx()?.name2 || 'Shared';
    const filename = FILENAME_PREFIX + shortId();
    return saveBase64AsFile(base64, charName, filename, 'jpg');
}

/**
 * Fire-and-forget delete of an uploaded image. Called on burst delete,
 * chat clear, or staged-chip clear (user cancelled before send). Failures
 * are swallowed — an orphan file on disk is not a user-visible defect and
 * matches how ST's own inline attachments behave.
 * @param {string | null | undefined} path
 */
export function deleteImage(path) {
    if (!path || typeof path !== 'string') return;
    try {
        const headers = ctx()?.getRequestHeaders?.() || { 'Content-Type': 'application/json' };
        fetch('/api/images/delete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ path }),
        }).catch(() => { /* orphans are acceptable */ });
    } catch { /* ctx unavailable, nothing to do */ }
}

/**
 * Collect the set of attachment.image paths carried by a chat array.
 * Used by delete paths so we can clean up file-system orphans after
 * /cut'ing the tagged messages.
 * @param {Array<{extra?: {sillyphone?: {attachment?: {image?: string | null}}}}>} chat
 * @param {number[]} [indices]
 * @returns {string[]}
 */
export function collectImagePaths(chat, indices) {
    if (!Array.isArray(chat)) return [];
    const out = [];
    const range = Array.isArray(indices) ? indices : chat.map((_, i) => i);
    for (const idx of range) {
        const p = chat[idx]?.extra?.sillyphone?.attachment?.image;
        if (typeof p === 'string' && p.length > 0) out.push(p);
    }
    return out;
}
