// Bubble rendering utilities. DOM-producing, no business logic.

const TIMESTAMP_GAP_MS = 5 * 60 * 1000;

function bubble(text, from) {
    const b = document.createElement('div');
    b.className = `sp-bubble sp-bubble-${from === 'user' ? 'user' : 'char'}`;
    b.textContent = text;
    return b;
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
    // Preserve position if user scrolled up intentionally.
    const threshold = 60;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom) {
        requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
}

export function renderThread(thread, containerEl) {
    containerEl.innerHTML = '';
    let lastTs = 0;
    for (const entry of thread) {
        if (!lastTs || entry.ts - lastTs > TIMESTAMP_GAP_MS) {
            containerEl.appendChild(timestampHeader(entry.ts));
        }
        for (const msg of entry.msgs) {
            const b = bubble(msg, entry.from);
            b.dataset.ts = String(entry.ts);
            containerEl.appendChild(b);
        }
        lastTs = entry.ts;
    }
    requestAnimationFrame(() => { containerEl.scrollTop = containerEl.scrollHeight; });
}

export function appendBurst(burst, containerEl) {
    const bubbles = containerEl.querySelectorAll('.sp-bubble');
    const last = bubbles[bubbles.length - 1];
    const lastTs = last ? Number(last.dataset.ts || 0) : 0;
    if (!lastTs || burst.ts - lastTs > TIMESTAMP_GAP_MS) {
        containerEl.appendChild(timestampHeader(burst.ts));
    }
    for (const msg of burst.msgs) {
        const b = bubble(msg, burst.from);
        b.dataset.ts = String(burst.ts);
        containerEl.appendChild(b);
    }
    scrollToBottom(containerEl);
}

export function appendSingle(msg, from, ts, containerEl) {
    const b = bubble(msg, from);
    b.dataset.ts = String(ts);
    containerEl.appendChild(b);
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
