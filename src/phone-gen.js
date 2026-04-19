// Flow B: user sends SMS → dedicated /genraw call → parse JSON → bubbles.
import { executeSlashCommandsWithOptions, name2, chat, getCharacterCardFields } from '../../../../../script.js';
import { buildPhonePrompt } from './prompt-builder.js';
import * as storage from './storage.js';
import * as settings from './settings.js';
import * as memory from './memory.js';

const RECENT_MAIN_MSGS = 10;
const GEN_TIMEOUT_MS = 60000;

function getCharCard() {
    try {
        const fields = getCharacterCardFields?.();
        if (!fields) return '';
        return [
            fields.description,
            fields.personality,
            fields.scenario,
            fields.mes_example,
        ].filter(Boolean).join('\n\n');
    } catch { return ''; }
}

function getRecentMainMsgs(n) {
    if (!Array.isArray(chat)) return [];
    return chat
        .slice(-n)
        .filter(m => !m.is_system)
        .map(m => `[${m.is_user ? 'User' : m.name || 'Char'}]: ${m.mes || ''}`);
}

export function parseResponse(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let s = raw.trim();
    // strip ```json ... ``` fences
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    // find first { ... } block defensively
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

function escapeForSlash(s) {
    return s
        .replaceAll('\\', '\\\\')
        .replaceAll('|', '\\|')
        .replaceAll('{{', '\\{\\{')
        .replaceAll('}}', '\\}\\}');
}

async function runGenraw(prompt) {
    const safe = escapeForSlash(prompt);
    const cmd = `/genraw lock=off instruct=off ${safe}`;
    const result = await Promise.race([
        executeSlashCommandsWithOptions(cmd, { showOutput: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('genraw timeout')), GEN_TIMEOUT_MS)),
    ]);
    return result?.pipe ?? '';
}

export async function generateReply(userMsg) {
    const summary = await memory.ensureFresh();
    const charName = name2 || 'the character';
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

    let raw = await runGenraw(prompt);
    let parsed = parseResponse(raw);

    if (!parsed) {
        const retryPrompt = prompt + '\n\nREMINDER: Output ONLY JSON like {"msgs":["text"]}. No other text.';
        raw = await runGenraw(retryPrompt);
        parsed = parseResponse(raw);
    }

    return parsed;
}
