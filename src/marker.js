// Extracts and strips <!--Phone:{...}--> markers from AI message text.

const MARKER_RE = /<!--Phone:\s*(\{[\s\S]*?\})\s*-->/g;

function normalizeAttachment(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const kind = raw.kind;
    const description = raw.description;
    if (kind !== 'image' && kind !== 'video') return null;
    if (typeof description !== 'string' || description.length === 0) return null;
    return { kind, description };
}

// Accepts string or {text, delay?, typeDuration?}. Returns {text, timing}
// where timing is either a normalized object or null (instant default).
function normalizeBubble(raw) {
    if (typeof raw === 'string') {
        if (raw.length === 0) return null;
        return { text: raw, timing: null };
    }
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.text !== 'string' || raw.text.length === 0) return null;
    const timing = {};
    let hasAny = false;
    if (Number.isFinite(raw.delay) && raw.delay >= 0) {
        timing.delay = raw.delay;
        hasAny = true;
    }
    if (Number.isFinite(raw.typeDuration) && raw.typeDuration >= 0) {
        timing.typeDuration = raw.typeDuration;
        hasAny = true;
    }
    return { text: raw.text, timing: hasAny ? timing : null };
}

export function parse(text) {
    if (!text || typeof text !== 'string') return null;
    const msgs = [];
    const timing = [];
    let hasAnyTiming = false;
    let attachment = null;
    let match;
    MARKER_RE.lastIndex = 0;
    while ((match = MARKER_RE.exec(text)) !== null) {
        let obj;
        try { obj = JSON.parse(match[1]); }
        catch { continue; }
        if (!obj) continue;
        if (Array.isArray(obj.msgs)) {
            for (const m of obj.msgs) {
                const b = normalizeBubble(m);
                if (!b) continue;
                msgs.push(b.text);
                timing.push(b.timing);
                if (b.timing) hasAnyTiming = true;
            }
        }
        if (!attachment) attachment = normalizeAttachment(obj.attachment);
    }
    if (msgs.length === 0 && !attachment) return null;
    const result = { msgs };
    if (attachment) result.attachment = attachment;
    if (hasAnyTiming) result.timing = timing.map(t => t || {});
    return result;
}

export function strip(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(MARKER_RE, '');
}
