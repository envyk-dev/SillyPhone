// Central SillyTavern API adapter.
// Most access goes through SillyTavern.getContext() — the documented API.
// setExtensionPrompt isn't on ctx, so we import it statically from the canonical path.
import {
    setExtensionPrompt as _setExtensionPrompt,
    extension_prompt_types as _ept,
    extension_prompt_roles as _epr,
} from '../../../../../script.js';

export function ctx() {
    if (typeof SillyTavern === 'undefined' || typeof SillyTavern.getContext !== 'function') {
        throw new Error('[SillyPhone] SillyTavern.getContext() unavailable — extension loaded too early or host version incompatible');
    }
    return SillyTavern.getContext();
}

// Extension prompt enums — use imported values if available, fall back to defaults.
export const EXTENSION_PROMPT = _ept || Object.freeze({
    NONE: 0,
    AFTER_SCENARIO: 1,
    IN_CHAT: 2,
    IN_PROMPT: 3,
    BEFORE_PROMPT: 4,
    AT_DEPTH: 5,
});

export const EXTENSION_PROMPT_ROLE = _epr || Object.freeze({
    SYSTEM: 0,
    USER: 1,
    ASSISTANT: 2,
});

export function setExtensionPrompt(key, text, position, depth, role) {
    if (typeof _setExtensionPrompt !== 'function') {
        console.warn('[SillyPhone] setExtensionPrompt import failed — context injection disabled');
        return;
    }
    return _setExtensionPrompt(key, text, position, depth, false, role);
}

export async function runSlashCommand(cmd) {
    const c = ctx();
    const fn =
        (typeof c.executeSlashCommandsWithOptions === 'function' && c.executeSlashCommandsWithOptions) ||
        (typeof globalThis.executeSlashCommandsWithOptions === 'function' && globalThis.executeSlashCommandsWithOptions);
    if (!fn) {
        console.warn('[SillyPhone] slash command runner unavailable');
        return null;
    }
    return fn(cmd, { showOutput: false });
}

// Push a message object onto ctx().chat, render it, persist.
// Returns its chat index.
export function pushChatMessage(msg) {
    const c = ctx();
    if (!Array.isArray(c.chat)) throw new Error('[SillyPhone] ctx().chat is not an array');
    c.chat.push(msg);
    const idx = c.chat.length - 1;
    if (typeof c.addOneMessage === 'function') c.addOneMessage(msg);
    if (typeof c.saveChatDebounced === 'function') c.saveChatDebounced();
    return idx;
}

// Replace chat[idx] in place, update the rendered DOM's text, persist.
// Used when mutating a tagged burst (message removed, attachment stripped).
export function replaceChatMessage(idx, msg) {
    const c = ctx();
    if (!Array.isArray(c.chat) || idx < 0 || idx >= c.chat.length) return;
    c.chat[idx] = msg;
    updateMessageDom(idx, msg);
    if (typeof c.saveChatDebounced === 'function') c.saveChatDebounced();
}

// Re-render a chat message's DOM block after mutating msg.mes.
// Prefers ST's native updateMessageBlock (full re-render including markdown
// and linebreaks). Falls back to messageFormatting → innerHTML, then to raw
// textContent as a last resort. Plain textContent loses <br>/markdown, which
// is why the old path jumbled multi-line host prose after SMS extraction.
export function updateMessageDom(idx, msg) {
    const c = ctx();
    if (typeof c.updateMessageBlock === 'function') {
        try { c.updateMessageBlock(idx, msg); return; }
        catch (err) { console.warn('[SillyPhone] updateMessageBlock failed', err); }
    }
    const host = document.querySelector(`#chat .mes[mesid="${idx}"] .mes_text`);
    if (!host) return;
    const mes = typeof msg.mes === 'string' ? msg.mes : '';
    if (typeof c.messageFormatting === 'function') {
        try {
            host.innerHTML = c.messageFormatting(mes, msg.name, !!msg.is_system, !!msg.is_user, idx);
            return;
        } catch (err) { console.warn('[SillyPhone] messageFormatting failed', err); }
    }
    host.textContent = mes;
}

// Cut chat[idx] via the slash command so ST's own DOM + state stay in sync.
export async function cutChatMessage(idx) {
    if (typeof idx !== 'number' || idx < 0) return;
    await runSlashCommand(`/cut ${idx}`);
}
