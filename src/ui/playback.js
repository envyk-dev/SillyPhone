// Sequenced bubble reveal with typing indicator between bubbles.
import * as bubbles from './bubbles.js';

const BASE_TYPING_MS = 400;
const PER_CHAR_MS = 40;
const BETWEEN_BUBBLES_MS = 300;
const MAX_TYPING_MS = 3000;

function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export async function playBubbles(msgs, containerEl, side = 'char') {
    if (reducedMotion()) {
        for (const m of msgs) bubbles.appendSingle(m, side, Date.now(), containerEl);
        return;
    }
    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        bubbles.showTyping(containerEl);
        const duration = Math.min(BASE_TYPING_MS + m.length * PER_CHAR_MS, MAX_TYPING_MS);
        await delay(duration);
        bubbles.hideTyping(containerEl);
        bubbles.appendSingle(m, side, Date.now(), containerEl);
        if (i < msgs.length - 1) await delay(BETWEEN_BUBBLES_MS);
    }
}
