// Sequenced bubble reveal with typing indicator between bubbles.
// All bubbles of one burst land in a single .sp-turn container for grouped styling.
import * as bubbles from './bubbles.js';

const BASE_TYPING_MS = 400;
const PER_CHAR_MS = 40;
const BETWEEN_BUBBLES_MS = 400;
const MAX_TYPING_MS = 3000;

function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function defaultTypeDuration(text) {
    return Math.min(BASE_TYPING_MS + text.length * PER_CHAR_MS, MAX_TYPING_MS);
}

function resolveTiming(text, t, isFirst) {
    const delay = Number.isFinite(t?.delay) && t.delay >= 0
        ? t.delay
        : (isFirst ? 0 : BETWEEN_BUBBLES_MS);
    const typeDuration = Number.isFinite(t?.typeDuration) && t.typeDuration >= 0
        ? t.typeDuration
        : defaultTypeDuration(text);
    return { delay, typeDuration };
}

export async function playBubbles(msgs, containerEl, side = 'char', ts = Date.now(), attachment = null, timing = null, chatIdx = null) {
    if (reducedMotion()) {
        bubbles.appendBurst({ from: side, msgs, ts, attachment, chatIdx }, containerEl);
        return;
    }
    // Pre-reply typing (if any) is repositioned below the new turn by
    // removing and letting showTyping re-append inside the container flow.
    bubbles.hideTyping(containerEl);
    const turn = bubbles.openTurn(side, ts, containerEl, attachment, chatIdx);
    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const t = resolveTiming(m, timing?.[i], i === 0);
        if (t.delay > 0) {
            bubbles.hideTyping(containerEl);
            await wait(t.delay);
        }
        bubbles.showTyping(containerEl);
        await wait(t.typeDuration);
        bubbles.hideTyping(containerEl);
        bubbles.appendToTurn(m, side, turn, containerEl);
    }
}
