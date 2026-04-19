// Owns the setExtensionPrompt entries for SMS log, summary, and Flow A instructions.
import { setExtensionPrompt, EXTENSION_PROMPT, EXTENSION_PROMPT_ROLE } from './st.js';
import * as storage from './storage.js';
import * as settings from './settings.js';
import { formatSmsLog } from './prompt-builder.js';

const KEY_INSTRUCTIONS = 'sillyphone_instructions';
const KEY_SMS_LOG = 'sillyphone_sms_log';
const KEY_SUMMARY = 'sillyphone_summary';

export function updateInstructionsPrompt() {
    const enabled = settings.get('enabled');
    const text = enabled ? (settings.get('flowAInstructions') || '') : '';
    setExtensionPrompt(KEY_INSTRUCTIONS, text, EXTENSION_PROMPT.IN_CHAT, 4, EXTENSION_PROMPT_ROLE.SYSTEM);
}

export function updateSmsPrompt() {
    const thread = storage.getThread();
    const text = formatSmsLog(thread);
    setExtensionPrompt(KEY_SMS_LOG, text, EXTENSION_PROMPT.IN_CHAT, 2, EXTENSION_PROMPT_ROLE.SYSTEM);
}

export function updateSummaryPrompt() {
    const rolling = settings.get('rollingMemory');
    const summary = storage.getSummary();
    const text = (rolling?.enabled && summary?.text)
        ? `Main chat summary (older messages):\n${summary.text}`
        : '';
    setExtensionPrompt(KEY_SUMMARY, text, EXTENSION_PROMPT.IN_CHAT, 3, EXTENSION_PROMPT_ROLE.SYSTEM);
}

export function updateAll() {
    updateInstructionsPrompt();
    updateSmsPrompt();
    updateSummaryPrompt();
}
