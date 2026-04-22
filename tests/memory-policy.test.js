import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldTriggerRolling } from '../src/memory-policy.js';

const ON = { enabled: true, every: 10, keepRecent: 10 };

test('shouldTriggerRolling: disabled config → false', () => {
    assert.equal(shouldTriggerRolling(100, { enabled: false, every: 10, keepRecent: 10 }, 0), false);
});

test('shouldTriggerRolling: missing rm → false', () => {
    assert.equal(shouldTriggerRolling(100, undefined, 0), false);
    assert.equal(shouldTriggerRolling(100, null, 0), false);
});

test('shouldTriggerRolling: chat shorter than keepRecent → false', () => {
    assert.equal(shouldTriggerRolling(5, ON, 0), false);
    assert.equal(shouldTriggerRolling(10, ON, 0), false); // exactly keepRecent → not > 0
});

test('shouldTriggerRolling: at the trigger boundary (len=every, len>keepRecent)', () => {
    // len=20, keepRecent=10 → hiddenUpTo=10 > 0, len%10===0 → fire.
    assert.equal(shouldTriggerRolling(20, ON, 0), true);
});

test('shouldTriggerRolling: len not divisible by every → false', () => {
    assert.equal(shouldTriggerRolling(21, ON, 0), false);
    assert.equal(shouldTriggerRolling(29, ON, 0), false);
});

test('shouldTriggerRolling: same length as last trigger → false (idempotent)', () => {
    assert.equal(shouldTriggerRolling(20, ON, 20), false);
});

test('shouldTriggerRolling: next boundary after last trigger → true', () => {
    assert.equal(shouldTriggerRolling(30, ON, 20), true);
});

test('shouldTriggerRolling: custom every (every=5)', () => {
    const rm = { enabled: true, every: 5, keepRecent: 10 };
    assert.equal(shouldTriggerRolling(15, rm, 0), true);
    assert.equal(shouldTriggerRolling(14, rm, 0), false);
    assert.equal(shouldTriggerRolling(11, rm, 0), false);
});

test('shouldTriggerRolling: custom keepRecent (keepRecent=3)', () => {
    const rm = { enabled: true, every: 10, keepRecent: 3 };
    // len=10, keepRecent=3 → hiddenUpTo=7 > 0, fires.
    assert.equal(shouldTriggerRolling(10, rm, 0), true);
    // len=3 → hiddenUpTo=0, no fire.
    assert.equal(shouldTriggerRolling(3, rm, 0), false);
});

test('shouldTriggerRolling: missing every defaults to 10', () => {
    const rm = { enabled: true, keepRecent: 10 };
    assert.equal(shouldTriggerRolling(20, rm, 0), true);
    assert.equal(shouldTriggerRolling(21, rm, 0), false);
});

test('shouldTriggerRolling: missing keepRecent defaults to 10', () => {
    const rm = { enabled: true, every: 10 };
    assert.equal(shouldTriggerRolling(10, rm, 0), false); // default keepRecent=10 → hiddenUpTo=0
    assert.equal(shouldTriggerRolling(20, rm, 0), true);
});
