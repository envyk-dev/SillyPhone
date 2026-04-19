// Global extension settings. UI is mounted in Task 12.
import { extension_settings, saveSettingsDebounced } from '../../../../script.js';
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

function ensureInitialized() {
    if (!extension_settings[KEY]) {
        extension_settings[KEY] = structuredClone(DEFAULTS);
        saveSettingsDebounced();
        return;
    }
    // Merge new defaults for forward-compat — don't overwrite user changes
    const s = extension_settings[KEY];
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (s[k] === undefined) {
            s[k] = structuredClone(v);
        } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            for (const [ik, iv] of Object.entries(v)) {
                if (s[k][ik] === undefined) s[k][ik] = iv;
            }
        }
    }
    saveSettingsDebounced();
}

export function init() {
    ensureInitialized();
}

export function get(key) {
    ensureInitialized();
    return extension_settings[KEY][key];
}

export function set(key, value) {
    ensureInitialized();
    extension_settings[KEY][key] = value;
    saveSettingsDebounced();
}

export function setNested(key, subKey, value) {
    ensureInitialized();
    extension_settings[KEY][key][subKey] = value;
    saveSettingsDebounced();
}

export function getAll() {
    ensureInitialized();
    return extension_settings[KEY];
}
