// @ts-check
// Pure settings-migration logic — no SillyTavern imports so it's testable
// under plain node --test. Called from settings.js during ensureInitialized().

/** @typedef {import('./types.js').SillyPhoneSettings} SillyPhoneSettings */
/**
 * Settings shape is partial during migration (blobs from old versions may
 * have extra/missing fields). Use Record for the migrator input.
 * @typedef {Record<string, any>} LegacySettings
 */
//
// The settings blob gains a `version` field at v7. Prior installs had no
// version, so the v7 migrator runs any pre-v7 fixups. Future migrations
// append new `{ to: N, apply }` entries; each runs only when s.version < to.
// Once all pre-v7 users have upgraded, the v7 entry can be removed.

export const CURRENT_VERSION = 8;

// Fingerprint snippets from previous default Flow A instructions. If the
// user's saved value still contains any of these, they never customized the
// prompt — migration refreshes it to the current default. Customized prompts
// (no fingerprint match) are left untouched.
//
// NOTE: keep this list narrow. Each phrase is a "tombstone" — a string that
// only ever appeared in an old default, so matching means the user is still
// on that default.
const OLD_FLOW_A_FINGERPRINTS = [
    // v0.2.x / early-v0.3 defaults
    'HISTORICAL phone conversation reference',
    'NEVER duplicate, echo, or near-duplicate',
    'duplicate, echo, or near-duplicate any message that already appears',
    'from where the phone state leaves off',
    // v0.3.x default — replaced in v0.4.0 rearchitecture (SMS-as-chat-messages).
    'Phone conversation log',
    'Use it sparingly — for later-beats',
    'flirty check-ins',
    'reply via the marker, ignore it in-character',
    // v0.4.x default — replaced in v0.5.0 with per-bubble timing docs.
    'holding up a coffee mug, slightly out of focus',
    'briefly narrate the act of texting or sending',
    // v0.5.x–v0.8.x default — replaced with style-derivation guidance that
    // lets characters text differently instead of all-lowercase-sloppy.
    'short, lowercase, a little sloppy',
];

// Heuristic fallback: looks like a default (has the marker example + header)
// but is missing a section that was added in the named version bump. The
// presence check for a later section acts as a fingerprint too.
function v04DefaultMissingTiming(value) {
    if (typeof value !== 'string' || !value) return false;
    const looksLikeDefault = value.includes('<!--Phone:{"msgs":["text1","text2"]}-->')
        && value.includes('Phone / SMS system (SillyPhone extension)')
        && value.includes('Previous SMS in this conversation already appear');
    const hasTimingDocs = value.includes('typeDuration');
    return looksLikeDefault && !hasTimingDocs;
}

function v05DefaultMissingExample(value) {
    if (typeof value !== 'string' || !value) return false;
    const looksLikeDefault = value.includes('<!--Phone:{"msgs":["text1","text2"]}-->')
        && value.includes('Phone / SMS system (SillyPhone extension)')
        && value.includes('typeDuration');
    const hasExample = value.includes('Example exchange');
    return looksLikeDefault && !hasExample;
}

function v06DefaultMissingOutputFormat(value) {
    if (typeof value !== 'string' || !value) return false;
    const looksLikeDefault = value.includes('<!--Phone:{"msgs":["text1","text2"]}-->')
        && value.includes('Phone / SMS system (SillyPhone extension)')
        && value.includes('Example exchange');
    const hasOutputFormat = value.includes('Output format ≠ history format');
    return looksLikeDefault && !hasOutputFormat;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isStaleDefaultFlowA(value) {
    if (typeof value !== 'string' || !value) return false;
    for (const fp of OLD_FLOW_A_FINGERPRINTS) {
        if (value.includes(fp)) return true;
    }
    if (v04DefaultMissingTiming(value)) return true;
    if (v05DefaultMissingExample(value)) return true;
    if (v06DefaultMissingOutputFormat(value)) return true;
    return false;
}

// Sequential migration table. Each entry transforms the settings blob from
// (version < to) to (version === to). Run in order; each gate on s.version.
const MIGRATIONS = [
    {
        to: 7,
        apply(s, currentDefaultFlowA) {
            // fastSms was renamed to smsOnly. Only ever shipped on dev, but a
            // few testers flipped it.
            if (s.fastSms !== undefined) {
                if (s.smsOnly === undefined) s.smsOnly = s.fastSms;
                delete s.fastSms;
            }
            // Refresh the Flow A prompt if it still matches any prior default.
            if (isStaleDefaultFlowA(s.flowAInstructions)) {
                s.flowAInstructions = currentDefaultFlowA;
            }
        },
    },
    {
        to: 8,
        apply(s, currentDefaultFlowA) {
            // v0.9 style-voice overhaul: refresh any saved blob still on a
            // pre-style-voice default (fingerprinted via "short, lowercase,
            // a little sloppy").
            if (isStaleDefaultFlowA(s.flowAInstructions)) {
                s.flowAInstructions = currentDefaultFlowA;
            }
        },
    },
];

/**
 * Mutates `s` to the current schema. Returns true if any migration ran.
 * `currentDefaultFlowA` is injected so tests can exercise the stale-default
 * refresh without depending on the real DEFAULT_FLOW_A_INSTRUCTIONS.
 * @param {LegacySettings | null | undefined} s
 * @param {string} currentDefaultFlowA
 * @returns {boolean}
 */
export function migrate(s, currentDefaultFlowA) {
    if (!s || typeof s !== 'object') return false;
    const from = Number.isInteger(s.version) ? s.version : 0;
    if (from >= CURRENT_VERSION) return false;
    for (const m of MIGRATIONS) {
        if (m.to > from) m.apply(s, currentDefaultFlowA);
    }
    s.version = CURRENT_VERSION;
    return true;
}
