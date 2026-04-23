// Global extension settings — stored in ctx().extensionSettings.
// Migration logic lives in settings-migrate.js (pure, testable under node).
import { ctx } from './st.js';
import {
    DEFAULT_FLOW_A_INSTRUCTIONS,
    DEFAULT_SUMMARIZATION_PROMPT,
} from './prompt-builder.js';
import { migrate, CURRENT_VERSION } from './settings-migrate.js';

/** @typedef {import('./types.js').SillyPhoneSettings} SillyPhoneSettings */

const KEY = 'sillyphone';

const DEFAULTS = {
    version: CURRENT_VERSION,
    enabled: true,
    smsOnly: false,
    showBadge: true,
    showSmsRows: false,
    toastSound: false,
    forcefulChatInject: false,
    theme: 'violet',
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

// Fill any keys the saved blob is missing (new settings added across
// versions). Separate from migration, which transforms existing keys.
function hydrate(s) {
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (s[k] === undefined) {
            s[k] = structuredClone(v);
        } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            for (const [ik, iv] of Object.entries(v)) {
                if (s[k][ik] === undefined) s[k][ik] = iv;
            }
        }
    }
}

function ensureInitialized() {
    const store = getStore();
    if (!store[KEY]) {
        store[KEY] = structuredClone(DEFAULTS);
        persist();
        return;
    }
    const s = store[KEY];
    hydrate(s);
    const migrated = migrate(s, DEFAULT_FLOW_A_INSTRUCTIONS);
    if (migrated) persist();
}

export function init() {
    ensureInitialized();
}

/**
 * @template {keyof SillyPhoneSettings} K
 * @param {K} key
 * @returns {SillyPhoneSettings[K]}
 */
export function get(key) {
    ensureInitialized();
    return getStore()[KEY][key];
}

/**
 * @template {keyof SillyPhoneSettings} K
 * @param {K} key
 * @param {SillyPhoneSettings[K]} value
 */
export function set(key, value) {
    ensureInitialized();
    getStore()[KEY][key] = value;
    persist();
}

/**
 * @param {string} key
 * @param {string} subKey
 * @param {unknown} value
 */
export function setNested(key, subKey, value) {
    ensureInitialized();
    getStore()[KEY][key][subKey] = value;
    persist();
}

/** @returns {SillyPhoneSettings} */
export function getAll() {
    ensureInitialized();
    return getStore()[KEY];
}
