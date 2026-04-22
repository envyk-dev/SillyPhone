// Bubble rendering utilities. Bursts are wrapped in a "turn" div so:
// - vertical spacing between different speakers' turns is consistent
// - CSS can round bubble corners based on position within the turn
// - an optional attachment row sits at the top of the turn
import { REROLL_ICON } from './icons.js';

const TIMESTAMP_GAP_MS = 5 * 60 * 1000;

function bubble(text, from) {
    const b = document.createElement('div');
    b.className = `sp-bubble sp-bubble-${from === 'user' ? 'user' : 'char'}`;
    b.textContent = text;
    return b;
}

function turnContainer(from, ts) {
    const t = document.createElement('div');
    t.className = `sp-turn sp-turn-${from === 'user' ? 'user' : 'char'}`;
    if (ts) t.dataset.ts = String(ts);
    return t;
}

function timestampHeader(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const el = document.createElement('div');
    el.className = 'sp-timestamp';
    el.textContent = `${hh}:${mm}`;
    return el;
}

function scrollToBottom(el) {
    const threshold = 60;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom) {
        requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
}

// Attachment placeholder element. Card stays a pristine photo-frame — just
// the kind icon + generic "Image"/"Video" label. When a description exists,
// it rides on the element as a native `title` tooltip (desktop hover) and is
// also surfaced as a tap-to-reveal popover (wired in modal.js). Kept off the
// card itself to preserve the IM-app immersion.
function attachmentPlaceholder(attachment, from, chatIdx) {
    if (!attachment) return null;
    const el = document.createElement('div');
    el.className = `sp-attachment-placeholder sp-attachment-placeholder-${from === 'user' ? 'user' : 'char'} sp-attachment-${attachment.kind}`;
    const icon = attachment.kind === 'video' ? '🎥' : '📷';
    const label = attachment.kind === 'video' ? 'Video' : 'Image';
    const iconEl = document.createElement('span');
    iconEl.className = 'sp-attachment-placeholder-icon';
    iconEl.textContent = icon;
    const labelEl = document.createElement('span');
    labelEl.className = 'sp-attachment-placeholder-label';
    labelEl.textContent = label;
    el.append(iconEl, labelEl);
    // data-entry-idx is what the reveal-popover handler in modal.js keys
    // off. It MUST be set for live-appended cards too, not just on full
    // re-renders, or the popover silently no-ops until the next refresh.
    if (Number.isInteger(chatIdx)) {
        el.dataset.entryIdx = String(chatIdx);
        el.dataset.attachment = '1';
    }
    const desc = typeof attachment.description === 'string' ? attachment.description.trim() : '';
    if (desc) {
        el.title = desc;
        el.dataset.hasDescription = '1';
    }
    return el;
}

export function renderThread(thread, containerEl) {
    containerEl.innerHTML = '';
    let lastTs = 0;
    for (let ei = 0; ei < thread.length; ei++) {
        const entry = thread[ei];
        if (!lastTs || entry.ts - lastTs > TIMESTAMP_GAP_MS) {
            containerEl.appendChild(timestampHeader(entry.ts));
        }
        const turn = turnContainer(entry.from, entry.ts);
        const entryKey = typeof entry.chatIdx === 'number' ? entry.chatIdx : ei;
        const att = attachmentPlaceholder(entry.attachment, entry.from, entryKey);
        if (att) turn.appendChild(att);
        for (let mi = 0; mi < entry.msgs.length; mi++) {
            const b = bubble(entry.msgs[mi], entry.from);
            b.dataset.entryIdx = String(entryKey);
            b.dataset.msgIdx = String(mi);
            turn.appendChild(b);
        }
        containerEl.appendChild(turn);
        lastTs = entry.ts;
    }
    requestAnimationFrame(() => { containerEl.scrollTop = containerEl.scrollHeight; });
}

export function appendBurst(burst, containerEl) {
    const turns = containerEl.querySelectorAll('.sp-turn');
    const last = turns[turns.length - 1];
    const lastTs = last ? Number(last.dataset.ts || 0) : 0;
    if (!lastTs || burst.ts - lastTs > TIMESTAMP_GAP_MS) {
        containerEl.appendChild(timestampHeader(burst.ts));
    }
    const turn = turnContainer(burst.from, burst.ts);
    const att = attachmentPlaceholder(burst.attachment, burst.from, burst.chatIdx);
    if (att) turn.appendChild(att);
    for (const msg of burst.msgs || []) {
        turn.appendChild(bubble(msg, burst.from));
    }
    containerEl.appendChild(turn);
    scrollToBottom(containerEl);
    return turn;
}

export function openTurn(from, ts, containerEl, attachment, chatIdx) {
    const turns = containerEl.querySelectorAll('.sp-turn');
    const last = turns[turns.length - 1];
    const lastTs = last ? Number(last.dataset.ts || 0) : 0;
    if (!lastTs || ts - lastTs > TIMESTAMP_GAP_MS) {
        containerEl.appendChild(timestampHeader(ts));
    }
    const turn = turnContainer(from, ts);
    const att = attachmentPlaceholder(attachment, from, chatIdx);
    if (att) turn.appendChild(att);
    containerEl.appendChild(turn);
    return turn;
}

export function appendToTurn(msg, from, turnEl, containerEl) {
    const b = bubble(msg, from);
    turnEl.appendChild(b);
    scrollToBottom(containerEl);
    return b;
}

export function showTyping(containerEl) {
    const existing = containerEl.querySelector('.sp-typing');
    if (existing) return existing;
    const t = document.createElement('div');
    t.className = 'sp-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    containerEl.appendChild(t);
    scrollToBottom(containerEl);
    return t;
}

export function hideTyping(containerEl) {
    const t = containerEl.querySelector('.sp-typing');
    if (t) t.remove();
}

// Ensures at most one reroll icon exists, attached to the last char turn,
// visible only when `enabled`. Called after any thread mutation.
export function reconcileReroll(containerEl, onClick, enabled) {
    for (const old of containerEl.querySelectorAll('.sp-reroll')) old.remove();
    if (!enabled) return;
    const turns = containerEl.querySelectorAll('.sp-turn');
    const lastTurn = turns[turns.length - 1];
    if (!lastTurn || !lastTurn.classList.contains('sp-turn-char')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sp-reroll';
    btn.setAttribute('aria-label', 'Regenerate reply');
    btn.title = 'Regenerate reply';
    btn.innerHTML = REROLL_ICON;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof onClick === 'function') onClick();
    });
    lastTurn.appendChild(btn);
}
