// Global extension settings — stored in ctx().extensionSettings.
import { ctx } from './st.js';
import {
    DEFAULT_FLOW_A_INSTRUCTIONS,
    DEFAULT_SUMMARIZATION_PROMPT,
} from './prompt-builder.js';

const KEY = 'sillyphone';

const DEFAULTS = {
    enabled: true,
    fastSms: false,
    showBadge: true,
    toastSound: false,
    rollingMemory: {
        enabled: false,
        every: 10,
        keepRecent: 10,
        summarizationPrompt: DEFAULT_SUMMARIZATION_PROMPT,
    },
    flowAInstructions: DEFAULT_FLOW_A_INSTRUCTIONS,
};

function getStore() {
    return ctx().extensionSettings;
}

function persist() {
    ctx().saveSettingsDebounced();
}

// Fingerprint snippets from previous default Flow A instructions. If the user's
// saved value still contains any of these, they never customized it — upgrade
// them to the current DEFAULT_FLOW_A_INSTRUCTIONS so the fix actually takes
// effect in live testing. Customized prompts (no fingerprint match) are left
// untouched.
const OLD_FLOW_A_FINGERPRINTS = [
    // v0.2.x / early-v0.3 defaults
    'HISTORICAL phone conversation reference',
    'NEVER duplicate, echo, or near-duplicate',
    'duplicate, echo, or near-duplicate any message that already appears',
    'from where the phone state leaves off',
    // v0.3.x default — replaced in v0.4.0 rearchitecture (SMS-as-chat-messages).
    // These users were still on the big-block-inject design.
    'Phone conversation log',
    'Use it sparingly — for later-beats',
    'flirty check-ins',
    'reply via the marker, ignore it in-character',
    // v0.4.x default — replaced in v0.5.0 with per-bubble timing docs.
    // Distinctive phrases that only existed in the v0.4 Flow A default.
    'holding up a coffee mug, slightly out of focus',
    'briefly narrate the act of texting or sending',
];

// Additional fingerprint: v0.4 users who never customized but ALSO don't
// match any old-phrase fingerprint can be detected by the absence of the
// new timing section. We only trigger this path when the value still looks
// like a default (has the marker example AND the rules list) but lacks the
// timing docs. This avoids clobbering customized prompts.
function v04DefaultMissingTiming(value) {
    if (typeof value !== 'string' || !value) return false;
    const looksLikeDefault = value.includes('<!--Phone:{"msgs":["text1","text2"]}-->')
        && value.includes('Phone / SMS system (SillyPhone extension)')
        && value.includes('Previous SMS in this conversation already appear');
    const hasTimingDocs = value.includes('typeDuration');
    return looksLikeDefault && !hasTimingDocs;
}

// v0.5 → v0.6: added a small example exchange after the timing docs.
// Looks-like-default, has timing, but lacks the example block.
function v05DefaultMissingExample(value) {
    if (typeof value !== 'string' || !value) return false;
    const looksLikeDefault = value.includes('<!--Phone:{"msgs":["text1","text2"]}-->')
        && value.includes('Phone / SMS system (SillyPhone extension)')
        && value.includes('typeDuration');
    const hasExample = value.includes('Example exchange');
    return looksLikeDefault && !hasExample;
}

function isLikelyStaleDefaultFlowA(value) {
    if (typeof value !== 'string' || !value) return false;
    for (const fp of OLD_FLOW_A_FINGERPRINTS) {
        if (value.includes(fp)) return true;
    }
    if (v04DefaultMissingTiming(value)) return true;
    if (v05DefaultMissingExample(value)) return true;
    return false;
}

function ensureInitialized() {
    const store = getStore();
    if (!store[KEY]) {
        store[KEY] = structuredClone(DEFAULTS);
        persist();
        return;
    }
    const s = store[KEY];
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (s[k] === undefined) {
            s[k] = structuredClone(v);
        } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            for (const [ik, iv] of Object.entries(v)) {
                if (s[k][ik] === undefined) s[k][ik] = iv;
            }
        }
    }
    // One-shot migration: if flowAInstructions still carries any of the old
    // default fingerprints, replace with the current default. See comment on
    // OLD_FLOW_A_FINGERPRINTS above.
    if (isLikelyStaleDefaultFlowA(s.flowAInstructions)) {
        s.flowAInstructions = DEFAULTS.flowAInstructions;
    }
    persist();
}

export function init() {
    ensureInitialized();
}

export function get(key) {
    ensureInitialized();
    return getStore()[KEY][key];
}

export function set(key, value) {
    ensureInitialized();
    getStore()[KEY][key] = value;
    persist();
}

export function setNested(key, subKey, value) {
    ensureInitialized();
    getStore()[KEY][key][subKey] = value;
    persist();
}

export function getAll() {
    ensureInitialized();
    return getStore()[KEY];
}
