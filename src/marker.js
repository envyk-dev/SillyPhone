// @ts-check
// Extracts and strips <!--Phone:{...}--> markers from AI message text.
// Also recognizes a leaked bullet-list format ("[SMS]\n- a\n- b") that the
// model sometimes produces after learning the displayed transcript shape
// in long chats. parse() falls back to it when no marker is found; strip()
// always removes it so the host row never carries the raw block.
import { normalizeAttachment } from './chat-sms.js';

/** @typedef {import('./types.js').Attachment} Attachment */
/** @typedef {import('./types.js').BubbleTiming} BubbleTiming */
/** @typedef {import('./types.js').MarkerParseResult} MarkerParseResult */

const MARKER_RE = /<!--Phone:\s*(\{[\s\S]*?\})\s*-->/g;

// Matches a [SMS] header line plus immediate bullet lines, e.g.:
//   [SMS]
//   - hey
//   - u free
const LEAKED_BLOCK_RE = /(?:^|\n)[ \t]*\[SMS\][ \t]*(?:\n[ \t]*-[^\n]*)*/g;

// Strict variant (requires at least one bullet) used only for fallback parsing.
// /g so .exec can advance past rejected matches (code-fenced, mid-prose) and
// keep scanning instead of locking onto the first hit.
const LEAKED_BULLETS_RE = /(?:^|\n)[ \t]*\[SMS\][ \t]*((?:\n[ \t]*-[^\n]*)+)/g;

// True if `pos` falls inside an unclosed ```...``` block, counting fences
// from the start of the text. Used to skip leaked blocks the model put inside
// example/tutorial code rather than as an actual send.
/**
 * @param {string} text
 * @param {number} pos
 * @returns {boolean}
 */
function isInsideCodeFence(text, pos) {
    let count = 0;
    let i = 0;
    while (i < pos) {
        if (text.startsWith('```', i)) {
            count++;
            i += 3;
        } else {
            i++;
        }
    }
    return count % 2 === 1;
}

/**
 * @param {string} text
 * @returns {{ msgs: string[] } | null}
 */
function parseLeakedBlock(text) {
    LEAKED_BULLETS_RE.lastIndex = 0;
    let m;
    while ((m = LEAKED_BULLETS_RE.exec(text)) !== null) {
        const headerStart = m.index + (text[m.index] === '\n' ? 1 : 0);
        if (isInsideCodeFence(text, headerStart)) continue;
        const msgs = [];
        for (const line of m[1].split('\n')) {
            const b = /^[ \t]*-\s*(.+?)[ \t]*$/.exec(line);
            if (b && b[1]) msgs.push(b[1]);
        }
        if (msgs.length === 0) continue;
        return { msgs };
    }
    return null;
}

// Accepts string or {text, delay?, typeDuration?}. Returns {text, timing}
// where timing is either a normalized object or null (instant default).
/**
 * @param {unknown} raw
 * @returns {{ text: string, timing: BubbleTiming | null } | null}
 */
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

/**
 * @param {string} text
 * @returns {MarkerParseResult | null}
 */
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
    if (msgs.length === 0 && !attachment) {
        // Fallback: long-context drift sometimes makes the model output the
        // display format directly instead of a hidden marker. Treat a bare
        // "[SMS]\n- a\n- b" block as if it were a marker.
        const leaked = parseLeakedBlock(text);
        if (leaked) return leaked;
        return null;
    }
    const result = { msgs };
    if (attachment) result.attachment = attachment;
    if (hasAnyTiming) result.timing = timing.map(t => t || {});
    return result;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function strip(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(MARKER_RE, '').replace(LEAKED_BLOCK_RE, '');
}
