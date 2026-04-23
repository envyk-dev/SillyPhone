import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSummarizationPrompt,
    DEFAULT_FLOW_A_INSTRUCTIONS,
    DEFAULT_SUMMARIZATION_PROMPT,
} from '../src/prompt-builder.js';

test('buildSummarizationPrompt: includes instruction and messages', () => {
    const msgs = [{ name: 'Alice', mes: 'hi' }, { name: 'Bob', mes: 'hey' }];
    const prompt = buildSummarizationPrompt(msgs);
    assert.match(prompt, /Summarize/);
    assert.match(prompt, /\[0\] Alice: hi/);
    assert.match(prompt, /\[1\] Bob: hey/);
});

test('buildSummarizationPrompt: custom instruction override', () => {
    const prompt = buildSummarizationPrompt([], 'Different instruction');
    assert.match(prompt, /Different instruction/);
});

test('DEFAULT_FLOW_A_INSTRUCTIONS mentions marker format and [SMS] context', () => {
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /<!--Phone:/);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /"msgs":/);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /\[SMS\]/);
});

test('DEFAULT_FLOW_A_INSTRUCTIONS documents the attachment field', () => {
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /attachment/i);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /"kind":/);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /"description":/);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /image/);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /video/);
});

test('DEFAULT_FLOW_A_INSTRUCTIONS frames prior SMS as already-in-context, not a state block', () => {
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /already (appear|in)/i);
    assert.doesNotMatch(DEFAULT_FLOW_A_INSTRUCTIONS, /Phone state — already sent/);
});

test('DEFAULT_SUMMARIZATION_PROMPT mentions summarize', () => {
    assert.match(DEFAULT_SUMMARIZATION_PROMPT, /[Ss]ummarize/);
});

test('DEFAULT_FLOW_A_INSTRUCTIONS documents per-bubble timing', () => {
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /delay/);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /typeDuration/);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /millisecond/i);
});

test('DEFAULT_FLOW_A_INSTRUCTIONS instructs per-character style derivation', () => {
    // Must tell the model style comes from the character, not a universal default.
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /character card/i);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /[Ss]tyle/);
    // Must give explicit fallback for unset style.
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /isn't explicitly established|in doubt|infer/i);
    // Must not re-introduce the old universal lowercase/sloppy priming.
    assert.doesNotMatch(DEFAULT_FLOW_A_INSTRUCTIONS, /short, lowercase, a little sloppy/);
});
