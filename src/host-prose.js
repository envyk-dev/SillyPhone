// @ts-check
// Pure helpers for cleaning the host AI message around a marker and for
// splitting the user's compose-box input into individual SMS bubbles.
// Kept dependency-free (only marker.js, which is itself pure) so it runs
// under node --test.
import { strip as stripMarker } from './marker.js';

/**
 * Escape a string for use inside a RegExp pattern.
 * @param {string} s
 * @returns {string}
 */
export function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split a multi-line compose-box string into individual SMS bubbles. Each
 * non-empty trimmed line becomes one bubble; blank lines are dropped.
 * @param {string} text
 * @returns {string[]}
 */
export function splitUserInput(text) {
    return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

/**
 * Remove the SMS marker, blockquote pseudo-transcript lines, AND any line
 * that contains a parsed SMS message verbatim (the model sometimes writes
 * the message body as prose despite Flow A rule 5). Returns the cleaned
 * host text with leading/trailing whitespace trimmed and runs of blank
 * lines collapsed.
 * @param {string} text
 * @param {string[] | null | undefined} parsedMsgs
 * @returns {string}
 */
export function cleanHostProse(text, parsedMsgs) {
    let cleaned = stripMarker(text);
    cleaned = cleaned.replace(/^\s*>.*$/gm, '');
    for (const m of parsedMsgs || []) {
        if (!m || typeof m !== 'string') continue;
        const pat = new RegExp(`^.*${escapeRegex(m)}.*$`, 'gm');
        cleaned = cleaned.replace(pat, '');
    }
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}
