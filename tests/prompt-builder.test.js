import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatSmsLog,
    buildPhonePrompt,
    buildSummarizationPrompt,
    DEFAULT_FLOW_A_INSTRUCTIONS,
    DEFAULT_FLOW_B_TEMPLATE,
    DEFAULT_SUMMARIZATION_PROMPT,
} from '../src/prompt-builder.js';

test('formatSmsLog: empty thread returns empty string', () => {
    assert.equal(formatSmsLog([]), '');
    assert.equal(formatSmsLog(null), '');
});

test('formatSmsLog: single burst renders with timestamps', () => {
    const thread = [
        { from: 'char', msgs: ['hey', 'u up?'], ts: new Date('2026-04-18T10:34:00Z').getTime() },
    ];
    const out = formatSmsLog(thread);
    assert.match(out, /Phone conversation log/);
    assert.match(out, /Char:/);
    assert.match(out, /hey/);
    assert.match(out, /u up\?/);
});

test('formatSmsLog: user and char bursts interleave', () => {
    const thread = [
        { from: 'char', msgs: ['hi'], ts: 1 },
        { from: 'user', msgs: ['sup'], ts: 2 },
    ];
    const out = formatSmsLog(thread);
    assert.match(out, /Char:[\s\S]*hi/);
    assert.match(out, /User:[\s\S]*sup/);
});

test('buildPhonePrompt: includes character card, summary, recent, thread, user msg', () => {
    const prompt = buildPhonePrompt({
        charName: 'Aria',
        charCard: 'Aria is 25, graphic designer.',
        summary: 'Scene: they argued about dinner.',
        recentMainMsgs: ['[You]: fine whatever', '[Aria]: ...'],
        smsThread: [{ from: 'user', msgs: ['u ok?'], ts: 1 }],
        userMsg: 'hello?',
    });
    assert.match(prompt, /Aria is 25/);
    assert.match(prompt, /argued about dinner/);
    assert.match(prompt, /fine whatever/);
    assert.match(prompt, /u ok\?/);
    assert.match(prompt, /hello\?/);
    assert.match(prompt, /"msgs":/);
});

test('buildPhonePrompt: omits summary section when null', () => {
    const prompt = buildPhonePrompt({
        charName: 'Aria',
        charCard: 'c',
        summary: null,
        recentMainMsgs: [],
        smsThread: [],
        userMsg: 'hi',
    });
    assert.doesNotMatch(prompt, /Scene summary/);
});

test('buildPhonePrompt: replaces {{char}} and {{user}} in template', () => {
    const prompt = buildPhonePrompt({
        charName: 'Aria',
        charCard: 'c',
        summary: null,
        recentMainMsgs: [],
        smsThread: [],
        userMsg: 'hi',
    });
    assert.match(prompt, /You are Aria/);
    assert.doesNotMatch(prompt, /\{\{char\}\}/);
    assert.doesNotMatch(prompt, /\{\{user\}\}/);
});

test('buildPhonePrompt: custom template override', () => {
    const prompt = buildPhonePrompt({
        charName: 'Aria',
        charCard: 'c',
        summary: null,
        recentMainMsgs: [],
        smsThread: [],
        userMsg: 'hi',
        template: 'CUSTOM {{char}} TEMPLATE',
    });
    assert.match(prompt, /CUSTOM Aria TEMPLATE/);
});

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

test('DEFAULT_FLOW_A_INSTRUCTIONS mentions marker format', () => {
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /<!--Phone:/);
    assert.match(DEFAULT_FLOW_A_INSTRUCTIONS, /"msgs":/);
});

test('DEFAULT_FLOW_B_TEMPLATE mentions JSON-only output', () => {
    assert.match(DEFAULT_FLOW_B_TEMPLATE, /JSON/i);
    assert.match(DEFAULT_FLOW_B_TEMPLATE, /"msgs":/);
});

test('DEFAULT_SUMMARIZATION_PROMPT mentions summarize', () => {
    assert.match(DEFAULT_SUMMARIZATION_PROMPT, /[Ss]ummarize/);
});
