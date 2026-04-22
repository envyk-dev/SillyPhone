// @ts-check
// Auto-applies the .sp-chat-sms class to any .mes row whose backing chat
// message carries extra.sillyphone. Replaces the old rAF-retry loop +
// MESSAGE_RENDERED safety-net + restyleAllSmsRows scan with a single
// MutationObserver watching #chat. Idempotent class add means spurious fires
// are harmless.
import { ctx } from './st.js';

let observer = null;

/**
 * Apply the class to a single .mes[mesid] row if its chat[idx] is tagged.
 * @param {Element} row
 */
function styleRow(row) {
    const idAttr = row.getAttribute('mesid');
    if (idAttr == null) return;
    const idx = Number(idAttr);
    if (!Number.isInteger(idx)) return;
    const msg = ctx().chat?.[idx];
    if (msg?.extra?.sillyphone) row.classList.add('sp-chat-sms');
}

/**
 * Start watching #chat for added .mes rows. Idempotent — subsequent calls
 * no-op until stop(). Returns true on a successful bind, false if #chat
 * isn't in the DOM yet.
 * @returns {boolean}
 */
export function start() {
    if (observer) return true;
    const chatEl = document.getElementById('chat');
    if (!chatEl) return false;
    observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (!(node instanceof Element)) continue;
                // ST usually appends .mes directly; guard against wrappers too.
                if (node.matches?.('.mes[mesid]')) {
                    styleRow(node);
                    continue;
                }
                const nested = node.querySelectorAll?.('.mes[mesid]');
                if (nested) for (const row of nested) styleRow(row);
            }
        }
    });
    observer.observe(chatEl, { childList: true, subtree: true });
    return true;
}

export function stop() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
}

/**
 * One-shot sweep: style every currently-rendered tagged row. Used after
 * CHAT_CHANGED (ST rebuilds #chat's children) as a belt-and-suspenders
 * fallback even though the observer should catch the re-adds too.
 */
export function styleAllTaggedRows() {
    const chat = ctx().chat;
    if (!Array.isArray(chat)) return;
    for (let i = 0; i < chat.length; i++) {
        if (!chat[i]?.extra?.sillyphone) continue;
        const row = document.querySelector(`#chat .mes[mesid="${i}"]`);
        if (row) row.classList.add('sp-chat-sms');
    }
}
