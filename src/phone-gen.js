// Flow B: user sends SMS → dedicated generateRaw call → parse JSON → bubbles.
import { ctx } from './st.js';
import { buildPhonePrompt } from './prompt-builder.js';
import * as storage from './storage.js';
import * as settings from './settings.js';
import * as memory from './memory.js';

const RECENT_MAIN_MSGS = 10;
const GEN_TIMEOUT_MS = 60000;

function getCharCard() {
    try {
        const c = ctx();
        const id = c.characterId;
        if (id == null || !Array.isArray(c.characters)) return '';
        const char = c.characters[id];
        if (!char) return '';
        return [
            char.description,
            char.personality,
            char.scenario,
            char.mes_example,
        ].filter(Boolean).join('\n\n');
    } catch { return ''; }
}

function getRecentMainMsgs(n) {
    const chat = ctx().chat;
    if (!Array.isArray(chat)) return [];
    return chat
        .slice(-n)
        .filter(m => !m.is_system)
        .map(m => `[${m.is_user ? 'User' : m.name || 'Char'}]: ${m.mes || ''}`);
}

export function parseResponse(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let s = raw.trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1) s = s.slice(first, last + 1);
    try {
        const obj = JSON.parse(s);
        if (!obj || !Array.isArray(obj.msgs)) return null;
        const msgs = obj.msgs.filter(m => typeof m === 'string' && m.length > 0);
        return msgs.length ? { msgs } : null;
    } catch {
        return null;
    }
}

async function runGen(prompt) {
    const c = ctx();
    const result = await Promise.race([
        c.generateRaw({ prompt }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('generateRaw timeout')), GEN_TIMEOUT_MS)),
    ]);
    return typeof result === 'string' ? result : (result?.text ?? '');
}

export async function generateReply(userMsg) {
    const summary = await memory.ensureFresh();
    const charName = ctx().name2 || 'the character';
    const charCard = getCharCard();
    const recentMainMsgs = getRecentMainMsgs(RECENT_MAIN_MSGS);
    const smsThread = storage.getThread();

    const prompt = buildPhonePrompt({
        charName,
        charCard,
        summary,
        recentMainMsgs,
        smsThread,
        userMsg,
        template: settings.get('flowBPromptTemplate'),
    });

    let raw = await runGen(prompt);
    let parsed = parseResponse(raw);

    if (!parsed) {
        const retryPrompt = prompt + '\n\nREMINDER: Output ONLY JSON like {"msgs":["text"]}. No other text.';
        raw = await runGen(retryPrompt);
        parsed = parseResponse(raw);
    }

    return parsed;
}
