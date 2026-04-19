// Central SillyTavern API adapter.
// Uses the globally-exposed SillyTavern.getContext() — the documented extension API.
// Avoids fragile relative-path ES imports of ST internals.

export function ctx() {
    if (typeof SillyTavern === 'undefined' || typeof SillyTavern.getContext !== 'function') {
        throw new Error('[SillyPhone] SillyTavern.getContext() unavailable — extension loaded too early or host version incompatible');
    }
    return SillyTavern.getContext();
}

// Extension prompt constants (values are stable across ST versions).
export const EXTENSION_PROMPT = Object.freeze({
    NONE: 0,
    AFTER_SCENARIO: 1,
    IN_CHAT: 2,
    IN_PROMPT: 3,
    BEFORE_PROMPT: 4,
    AT_DEPTH: 5,
});

export const EXTENSION_PROMPT_ROLE = Object.freeze({
    SYSTEM: 0,
    USER: 1,
    ASSISTANT: 2,
});

// setExtensionPrompt isn't on ctx; check globals and fall back gracefully.
export function setExtensionPrompt(key, text, position, depth, role) {
    const fn = globalThis.setExtensionPrompt;
    if (typeof fn === 'function') {
        return fn(key, text, position, depth, false, role);
    }
    console.warn('[SillyPhone] setExtensionPrompt not exposed — SMS context injection disabled');
}

// Slash command runner — used for /hide in rolling memory.
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
