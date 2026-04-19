// Extracts and strips <!--Phone:{...}--> markers from AI message text.

const MARKER_RE = /<!--Phone:\s*(\{[\s\S]*?\})\s*-->/g;

export function parse(text) {
    if (!text || typeof text !== 'string') return null;
    const allMsgs = [];
    let match;
    MARKER_RE.lastIndex = 0;
    while ((match = MARKER_RE.exec(text)) !== null) {
        try {
            const obj = JSON.parse(match[1]);
            if (!obj || !Array.isArray(obj.msgs)) continue;
            const clean = obj.msgs.filter(m => typeof m === 'string' && m.length > 0);
            allMsgs.push(...clean);
        } catch {
            // malformed — skip this marker, try others
        }
    }
    return allMsgs.length > 0 ? { msgs: allMsgs } : null;
}

export function strip(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(MARKER_RE, '');
}
