// Tagged-chat-message API for SMS bursts. Each burst lives as one entry in
// ctx().chat with extra.sillyphone = { from, msgs, ts, attachment? }.

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

// Plaintext transcript used as chat message `mes`. The LLM reads this form.
// The [SMS] prefix plus bullet list reads unambiguously as a text-message
// exchange rather than dialogue prose. Attachment lines like `[image: ...]`
// are visible to the LLM (giving it the attachment's content) but stripped
// from the user's view by the MESSAGE_RENDERED handler in index.js.
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

// Build a chat-message object tagged as an SMS burst. Not pushed — caller
// decides when to append to ctx().chat so tests and runtime can share logic.
// Accepts optional attachment: { kind: 'image'|'video', description: string }.
// The `image` slot is reserved for a future upload feature; this patch
// always stores null there regardless of what callers pass.
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

function normalizeAttachment(a) {
    if (!a || typeof a !== 'object') return null;
    const kind = a.kind;
    const description = a.description;
    if (kind !== 'image' && kind !== 'video') return null;
    if (typeof description !== 'string' || description.length === 0) return null;
    return { kind, description, image: null };
}

// Remove one msg from a tagged chat message. Returns a directive:
// { action: 'update', msg } → replace chat[i] with msg
// { action: 'remove' }       → cut chat[i] entirely (burst is empty)
// { action: 'noop' }         → nothing to do
// A burst is considered empty only if both msgs AND attachment are gone.
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

// Strip the attachment off a tagged chat message. Mirror contract to
// deleteMessageFromBurst: update | remove | noop.
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
