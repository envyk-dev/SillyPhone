// Summary cache + rolling-memory orchestration.
// - ensureFresh(): on-demand summary for phone generation context
// - checkRollingTrigger(): opt-in periodic summarize + /hide for main chat
import { executeSlashCommandsWithOptions, chat } from '../../../../script.js';
import { buildSummarizationPrompt } from './prompt-builder.js';
import * as storage from './storage.js';
import * as settings from './settings.js';
import * as context from './context.js';

const SUMMARY_THRESHOLD = 10;
const STALE_DRIFT = 5;

let lastTriggerLen = 0;

export function needsSummary() {
    if (!Array.isArray(chat)) return false;
    return chat.length > SUMMARY_THRESHOLD;
}

function summaryStale() {
    const cached = storage.getSummary();
    if (!cached) return true;
    const expectedCoverage = chat.length - 10;
    if (cached.coveredUpToIdx < expectedCoverage - STALE_DRIFT) return true;
    if (cached.coveredUpToIdx > chat.length) return true; // chat shrunk → invalid
    return false;
}

function escapeForSlash(s) {
    return s
        .replaceAll('\\', '\\\\')
        .replaceAll('|', '\\|')
        .replaceAll('{{', '\\{\\{')
        .replaceAll('}}', '\\}\\}');
}

async function runSummarization(messages, customPrompt) {
    const prompt = buildSummarizationPrompt(messages, customPrompt);
    const safe = escapeForSlash(prompt);
    const result = await executeSlashCommandsWithOptions(
        `/genraw lock=off instruct=off ${safe}`,
        { showOutput: false },
    );
    return (result?.pipe ?? '').trim();
}

export async function ensureFresh() {
    if (!needsSummary()) {
        if (storage.getSummary()) storage.resetSummary();
        return null;
    }
    if (!summaryStale()) return storage.getSummary().text;

    const coveredUpToIdx = chat.length - 10;
    const toSummarize = chat.slice(0, coveredUpToIdx).filter(m => !m.is_system);
    if (toSummarize.length === 0) return null;

    const customPrompt = settings.get('rollingMemory')?.summarizationPrompt;
    try {
        const text = await runSummarization(toSummarize, customPrompt);
        if (!text) return null;
        storage.setSummary({ text, coveredUpToIdx, generatedAt: Date.now() });
        return text;
    } catch (err) {
        console.warn('[SillyPhone] summary generation failed', err);
        return null;
    }
}

export async function checkRollingTrigger() {
    const rm = settings.get('rollingMemory');
    if (!rm || !rm.enabled) return;
    if (!Array.isArray(chat)) return;

    const len = chat.length;
    const hiddenUpTo = len - (rm.keepRecent || 10);
    if (hiddenUpTo <= 0) return;
    if (len === lastTriggerLen) return;
    if (len % (rm.every || 10) !== 0) return;
    lastTriggerLen = len;

    await ensureFresh();
    const summary = storage.getSummary();
    if (!summary) return;

    try {
        await executeSlashCommandsWithOptions(
            `/hide 0-${hiddenUpTo - 1}`,
            { showOutput: false },
        );
    } catch (err) {
        console.warn('[SillyPhone] /hide failed', err);
    }

    context.updateSummaryPrompt();
}

export function resetRollingTrigger() {
    lastTriggerLen = 0;
}
