// @ts-check
// Tagged-chat-message API for SMS bursts. Each burst lives as one entry in
// ctx().chat with extra.sillyphone = { from, msgs, ts, attachment? }.

/** @typedef {import('./types.js').Attachment} Attachment */
/** @typedef {import('./types.js').Burst} Burst */
/** @typedef {import('./types.js').ChatMessage} ChatMessage */
/**
 * @typedef {{ action: 'update', msg: ChatMessage } | { action: 'remove' } | { action: 'noop' }} BurstMutation
 */

/**
 * Cut every tagged burst from `chat` using the caller-supplied `cut(idx)`.
 * Descending order so later deletions don't shift earlier indices. Pure
 * signature (no st.js import) keeps this module testable.
 * @param {ChatMessage[]} chat
 * @param {(idx: number) => Promise<void> | void} cut
 * @returns {Promise<void>}
 */
export async function clearAllBursts(chat, cut) {
    if (!Array.isArray(chat) || typeof cut !== 'function') return;
    const indices = [];
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i]?.extra?.sillyphone) indices.push(i);
    }
    for (const idx of indices) {
        // eslint-disable-next-line no-await-in-loop
        await cut(idx);
    }
}

/**
 * @param {ChatMessage[]} chat
 * @returns {Burst[]}
 */
export function listBursts(chat) {
    if (!Array.isArray(chat)) return [];
    const out = [];
    for (let i = 0; i < chat.length; i++) {
        const tag = chat[i]?.extra?.sillyphone;
        if (!tag || !Array.isArray(tag.msgs)) continue;
        const entry = { chatIdx: i, from: tag.from, msgs: tag.msgs.slice(), ts: tag.ts };
        if (tag.attachment) entry.attachment = { ...tag.attachment };
        out.push(entry);
    }
    return out;
}

/**
 * Returns the chat index of the last SMS burst IF it's a char burst AND is
 * the final burst in the thread. Used by the phone modal to decide whether
 * a reroll icon should be offered. Returns -1 otherwise.
 * @param {ChatMessage[]} chat
 * @returns {number}
 */
export function findLastCharBurstForReroll(chat) {
    const bursts = listBursts(chat);
    if (bursts.length === 0) return -1;
    const last = bursts[bursts.length - 1];
    return last.from === 'char' ? last.chatIdx : -1;
}

/**
 * Plaintext transcript used as chat message `mes`. The LLM reads this form.
 * The [SMS] prefix plus bullet list reads unambiguously as a text-message
 * exchange rather than dialogue prose. Attachment lines like `[image: ...]`
 * are visible to the LLM (giving it the attachment's content) but stripped
 * from the user's view by the MESSAGE_RENDERED handler in index.js.
 * @param {string[]} msgs
 * @param {Attachment | null} [attachment]
 * @returns {string}
 */
export function formatBurstMes(msgs, attachment) {
    const lines = ['[SMS]'];
    if (attachment && typeof attachment.kind === 'string' && typeof attachment.description === 'string') {
        lines.push(`[${attachment.kind}: ${attachment.description}]`);
    }
    if (Array.isArray(msgs)) {
        for (const m of msgs) lines.push(`- ${m}`);
    }
    return lines.join('\n');
}

/**
 * Build a chat-message object tagged as an SMS burst. Not pushed — caller
 * decides when to append to ctx().chat so tests and runtime can share logic.
 * Attachment `image` (when present) is the relative URL path of an uploaded
 * file; it's kept out of `mes` so the LLM sees only the description.
 * @param {Object} args
 * @param {'user'|'char'} args.from
 * @param {string[]} args.msgs
 * @param {number} [args.ts]
 * @param {string} args.charName
 * @param {string} args.userName
 * @param {Attachment | null} [args.attachment]
 * @returns {ChatMessage}
 */
export function buildBurstMessage({ from, msgs, ts, charName, userName, attachment }) {
    const finalTs = ts ?? Date.now();
    const isUser = from === 'user';
    const cleanMsgs = Array.isArray(msgs) ? msgs.slice() : [];
    const att = normalizeAttachment(attachment);
    return {
        name: isUser ? userName : charName,
        is_user: isUser,
        is_system: false,
        send_date: finalTs,
        mes: formatBurstMes(cleanMsgs, att),
        extra: {
            sillyphone: {
                from,
                msgs: cleanMsgs,
                ts: finalTs,
                ...(att ? { attachment: att } : {}),
            },
        },
    };
}

/**
 * Canonical attachment shape used across modules (marker.parse, burst rows,
 * UI bubbles). `image` holds the relative URL path of an uploaded file when
 * present (image-kind only), null otherwise. Marker-parsed attachments
 * (char-initiated) can't carry an image path — the model has no way to
 * upload files — so the string path only ever reaches this function from
 * local user-initiated stages and stored tags.
 * @param {unknown} a
 * @returns {Attachment | null}
 */
export function normalizeAttachment(a) {
    if (!a || typeof a !== 'object') return null;
    const kind = a.kind;
    const description = a.description;
    if (kind !== 'image' && kind !== 'video') return null;
    if (typeof description !== 'string' || description.length === 0) return null;
    // `image` is a relative URL path (e.g. "user/images/Alice/sp_k2m8x.jpg")
    // to an uploaded still. Video-kind attachments carry a still here too —
    // it's the thumbnail shown with a play overlay (videos don't actually
    // play; the still stands in for one).
    const image = (typeof a.image === 'string' && a.image.length > 0) ? a.image : null;
    return { kind, description, image };
}

/**
 * Reverse formatBurstMes: parse the displayed [SMS] text back into
 * { msgs, attachment? }. Used when the user edits an SMS row directly in
 * the main chat log so we can re-sync extra.sillyphone.
 * @param {string} text
 * @returns {{ msgs: string[], attachment?: Attachment }}
 */
export function parseBurstMes(text) {
    const out = { msgs: [] };
    if (typeof text !== 'string') return out;
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line || line === '[SMS]') continue;
        const attMatch = /^\[(image|video):\s*([\s\S]+)\]$/.exec(line);
        if (attMatch) {
            out.attachment = { kind: attMatch[1], description: attMatch[2].trim(), image: null };
            continue;
        }
        out.msgs.push(line.startsWith('- ') ? line.slice(2) : line);
    }
    return out;
}

/**
 * Given a chat message whose `mes` has been edited externally (e.g. by the
 * user via ST's built-in message edit), return a rebuilt tag reflecting the
 * new text. Same action contract as deleteMessageFromBurst.
 * @param {ChatMessage} chatMsg
 * @returns {BurstMutation}
 */
export function rebuildBurstFromMes(chatMsg) {
    const tag = chatMsg?.extra?.sillyphone;
    if (!tag) return { action: 'noop' };
    const parsed = parseBurstMes(chatMsg.mes || '');
    let attachment = parsed.attachment || null;
    // Image bytes live outside `mes` (on disk, path in extra.sillyphone).
    // parseBurstMes rebuilds attachment from text only, so image is always
    // null on its output. Inherit the prior tag's image when the kind still
    // matches — an edit to the description line shouldn't nuke the file.
    // Dropping the attachment line entirely still drops the image binding;
    // the caller is responsible for deleting the orphan file.
    if (attachment && tag.attachment && tag.attachment.kind === attachment.kind && tag.attachment.image) {
        attachment = { ...attachment, image: tag.attachment.image };
    }
    if (parsed.msgs.length === 0 && !attachment) return { action: 'remove' };
    const nextTag = {
        from: tag.from,
        ts: tag.ts,
        msgs: parsed.msgs,
        ...(attachment ? { attachment } : {}),
    };
    const updated = {
        ...chatMsg,
        mes: formatBurstMes(parsed.msgs, attachment || null),
        extra: { ...chatMsg.extra, sillyphone: nextTag },
    };
    return { action: 'update', msg: updated };
}

/**
 * Remove one msg from a tagged chat message. Returns a directive:
 * - `{ action: 'update', msg }` → replace chat[i] with msg
 * - `{ action: 'remove' }`      → cut chat[i] entirely (burst is empty)
 * - `{ action: 'noop' }`        → nothing to do
 * A burst is considered empty only if both msgs AND attachment are gone.
 * @param {ChatMessage} chatMsg
 * @param {number} msgIdx
 * @returns {BurstMutation}
 */
export function deleteMessageFromBurst(chatMsg, msgIdx) {
    const tag = chatMsg?.extra?.sillyphone;
    if (!tag || !Array.isArray(tag.msgs)) return { action: 'noop' };
    if (msgIdx < 0 || msgIdx >= tag.msgs.length) return { action: 'noop' };
    const nextMsgs = tag.msgs.slice();
    nextMsgs.splice(msgIdx, 1);
    if (nextMsgs.length === 0 && !tag.attachment) return { action: 'remove' };
    const updated = {
        ...chatMsg,
        mes: formatBurstMes(nextMsgs, tag.attachment || null),
        extra: {
            ...chatMsg.extra,
            sillyphone: { ...tag, msgs: nextMsgs },
        },
    };
    return { action: 'update', msg: updated };
}

/**
 * Strip the attachment off a tagged chat message. Mirror contract to
 * deleteMessageFromBurst: update | remove | noop.
 * @param {ChatMessage} chatMsg
 * @returns {BurstMutation}
 */
export function deleteAttachmentFromBurst(chatMsg) {
    const tag = chatMsg?.extra?.sillyphone;
    if (!tag || !tag.attachment) return { action: 'noop' };
    const nextMsgs = Array.isArray(tag.msgs) ? tag.msgs : [];
    if (nextMsgs.length === 0) return { action: 'remove' };
    const nextTag = { from: tag.from, msgs: nextMsgs, ts: tag.ts };
    const updated = {
        ...chatMsg,
        mes: formatBurstMes(nextMsgs, null),
        extra: { ...chatMsg.extra, sillyphone: nextTag },
    };
    return { action: 'update', msg: updated };
}
