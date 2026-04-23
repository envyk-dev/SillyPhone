import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, isStaleDefaultFlowA, CURRENT_VERSION } from '../src/settings-migrate.js';

const CURRENT_DEFAULT = '[current default Flow A — sentinel for tests]';

test('migrate: v0.2 legacy phrase → flowAInstructions refreshed', () => {
    const s = {
        flowAInstructions: 'HISTORICAL phone conversation reference. Treat as a log...',
    };
    const changed = migrate(s, CURRENT_DEFAULT);
    assert.equal(changed, true);
    assert.equal(s.flowAInstructions, CURRENT_DEFAULT);
    assert.equal(s.version, CURRENT_VERSION);
});

test('migrate: v0.3 "Phone conversation log" phrase → refreshed', () => {
    const s = {
        flowAInstructions: 'Phone conversation log\n- reply via the marker, ignore it in-character',
    };
    migrate(s, CURRENT_DEFAULT);
    assert.equal(s.flowAInstructions, CURRENT_DEFAULT);
});

test('migrate: v0.4 default missing typeDuration → refreshed', () => {
    const s = {
        flowAInstructions: [
            '# Phone / SMS system (SillyPhone extension)',
            '<!--Phone:{"msgs":["text1","text2"]}-->',
            'Previous SMS in this conversation already appear in the chat',
            // no typeDuration anywhere
        ].join('\n'),
    };
    migrate(s, CURRENT_DEFAULT);
    assert.equal(s.flowAInstructions, CURRENT_DEFAULT);
});

test('migrate: v0.5 default missing "Example exchange" → refreshed', () => {
    const s = {
        flowAInstructions: [
            '# Phone / SMS system (SillyPhone extension)',
            '<!--Phone:{"msgs":["text1","text2"]}-->',
            'typeDuration 500–3000ms feels human',
            // no "Example exchange"
        ].join('\n'),
    };
    migrate(s, CURRENT_DEFAULT);
    assert.equal(s.flowAInstructions, CURRENT_DEFAULT);
});

test('migrate: v0.7/v0.8 default with "short, lowercase, sloppy" priming → refreshed', () => {
    const s = {
        flowAInstructions: [
            '# Phone / SMS system (SillyPhone extension)',
            '<!--Phone:{"msgs":["text1","text2"]}-->',
            'Output format ≠ history format',
            'Example exchange (illustrative only)',
            'typeDuration 500–3000ms feels human',
            'Messages are short, lowercase, a little sloppy — like real texting.',
        ].join('\n'),
    };
    migrate(s, CURRENT_DEFAULT);
    assert.equal(s.flowAInstructions, CURRENT_DEFAULT);
});

test('migrate: v0.6 default missing "Output format" section → refreshed', () => {
    const s = {
        flowAInstructions: [
            '# Phone / SMS system (SillyPhone extension)',
            '<!--Phone:{"msgs":["text1","text2"]}-->',
            'Example exchange (illustrative only)',
            // no "Output format ≠ history format"
        ].join('\n'),
    };
    migrate(s, CURRENT_DEFAULT);
    assert.equal(s.flowAInstructions, CURRENT_DEFAULT);
});

test('migrate: customized prompt (no fingerprint) is preserved', () => {
    const custom = 'My own rules for the phone. Be terse. Use emoji liberally.';
    const s = { flowAInstructions: custom };
    migrate(s, CURRENT_DEFAULT);
    assert.equal(s.flowAInstructions, custom);
    assert.equal(s.version, CURRENT_VERSION);
});

test('migrate: fastSms → smsOnly when smsOnly missing', () => {
    const s = { fastSms: true };
    migrate(s, CURRENT_DEFAULT);
    assert.equal(s.smsOnly, true);
    assert.equal(s.fastSms, undefined);
});

test('migrate: fastSms dropped when smsOnly already set', () => {
    const s = { fastSms: true, smsOnly: false };
    migrate(s, CURRENT_DEFAULT);
    assert.equal(s.smsOnly, false);
    assert.equal(s.fastSms, undefined);
});

test('migrate: idempotent — second call is a no-op', () => {
    const s = { fastSms: true, flowAInstructions: 'Phone conversation log' };
    const first = migrate(s, CURRENT_DEFAULT);
    assert.equal(first, true);
    const snapshot = JSON.stringify(s);
    const second = migrate(s, CURRENT_DEFAULT);
    assert.equal(second, false);
    assert.equal(JSON.stringify(s), snapshot);
});

test('migrate: already-current blob short-circuits', () => {
    const s = { version: CURRENT_VERSION, flowAInstructions: 'Phone conversation log' };
    const changed = migrate(s, CURRENT_DEFAULT);
    assert.equal(changed, false);
    // Old-default phrase NOT replaced because the version gate short-circuits.
    assert.equal(s.flowAInstructions, 'Phone conversation log');
});

test('migrate: null/undefined input returns false', () => {
    assert.equal(migrate(null, CURRENT_DEFAULT), false);
    assert.equal(migrate(undefined, CURRENT_DEFAULT), false);
    assert.equal(migrate('not an object', CURRENT_DEFAULT), false);
});

test('migrate: empty blob still gets version stamp', () => {
    const s = {};
    migrate(s, CURRENT_DEFAULT);
    assert.equal(s.version, CURRENT_VERSION);
});

test('isStaleDefaultFlowA: current default is not stale', () => {
    const currentLooking = [
        '# Phone / SMS system (SillyPhone extension)',
        '<!--Phone:{"msgs":["text1","text2"]}-->',
        'typeDuration 500–3000ms',
        'Example exchange',
        'Output format ≠ history format',
    ].join('\n');
    assert.equal(isStaleDefaultFlowA(currentLooking), false);
});

test('isStaleDefaultFlowA: empty/non-string → false', () => {
    assert.equal(isStaleDefaultFlowA(''), false);
    assert.equal(isStaleDefaultFlowA(null), false);
    assert.equal(isStaleDefaultFlowA(undefined), false);
    assert.equal(isStaleDefaultFlowA(123), false);
});

test('isStaleDefaultFlowA: generic text without fingerprints → false', () => {
    assert.equal(isStaleDefaultFlowA('Just some random user-authored instructions.'), false);
});
