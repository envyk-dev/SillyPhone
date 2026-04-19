// Global extension settings — stored in ctx().extensionSettings.
import { ctx } from './st.js';
import {
    DEFAULT_FLOW_A_INSTRUCTIONS,
    DEFAULT_FLOW_B_TEMPLATE,
    DEFAULT_SUMMARIZATION_PROMPT,
} from './prompt-builder.js';

const KEY = 'sillyphone';

const DEFAULTS = {
    enabled: true,
    showBadge: true,
    toastSound: false,
    rollingMemory: {
        enabled: false,
        every: 10,
        keepRecent: 10,
        summarizationPrompt: DEFAULT_SUMMARIZATION_PROMPT,
    },
    flowAInstructions: DEFAULT_FLOW_A_INSTRUCTIONS,
    flowBPromptTemplate: DEFAULT_FLOW_B_TEMPLATE,
};

function getStore() {
    return ctx().extensionSettings;
}

function persist() {
    ctx().saveSettingsDebounced();
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
