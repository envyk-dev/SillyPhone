import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanHostProse, escapeRegex, splitUserInput } from '../src/host-prose.js';

test('escapeRegex: escapes regex metacharacters', () => {
    assert.equal(escapeRegex('a.b*c+d?'), 'a\\.b\\*c\\+d\\?');
    assert.equal(escapeRegex('(x|y)'), '\\(x\\|y\\)');
    assert.equal(escapeRegex('a[b]c{d}e'), 'a\\[b\\]c\\{d\\}e');
    assert.equal(escapeRegex('plain'), 'plain');
});

test('splitUserInput: splits on newlines and trims', () => {
    assert.deepEqual(splitUserInput('hi\nu up?'), ['hi', 'u up?']);
    assert.deepEqual(splitUserInput('  hi  \n\n  there  '), ['hi', 'there']);
});

test('splitUserInput: handles CRLF', () => {
    assert.deepEqual(splitUserInput('a\r\nb\r\nc'), ['a', 'b', 'c']);
});

test('splitUserInput: drops blank lines', () => {
    assert.deepEqual(splitUserInput('\n\na\n\n\nb\n'), ['a', 'b']);
});

test('splitUserInput: empty string yields empty array', () => {
    assert.deepEqual(splitUserInput(''), []);
    assert.deepEqual(splitUserInput('   \n\t\n'), []);
});

test('cleanHostProse: strips marker', () => {
    const text = 'Some prose.\n<!--Phone:{"msgs":["hi"]}-->';
    assert.equal(cleanHostProse(text, ['hi']), 'Some prose.');
});

test('cleanHostProse: strips blockquote pseudo-transcript lines', () => {
    const text = 'Real prose.\n> [SMS] hi\n> [SMS] u up?\nMore prose.';
    assert.equal(cleanHostProse(text, []), 'Real prose.\n\nMore prose.');
});

test('cleanHostProse: removes lines containing parsed message verbatim', () => {
    const text = 'She types out: hello there\nAnd then waits.\n<!--Phone:{"msgs":["hello there"]}-->';
    const out = cleanHostProse(text, ['hello there']);
    assert.equal(out, 'And then waits.');
});

test('cleanHostProse: collapses runs of blank lines', () => {
    const text = 'a\n\n\n\n\nb';
    assert.equal(cleanHostProse(text, []), 'a\n\nb');
});

test('cleanHostProse: parsed message containing regex metachars is treated literally', () => {
    const text = 'She says (probably): are you there?\nThen she waits.';
    const out = cleanHostProse(text, ['are you there?']);
    assert.equal(out, 'Then she waits.');
});

test('cleanHostProse: ignores non-string entries in parsedMsgs', () => {
    const text = 'plain prose with no marker';
    // null/undefined/numeric entries must not throw and must not match anything
    assert.equal(cleanHostProse(text, [null, undefined, 42, '']), 'plain prose with no marker');
});

test('cleanHostProse: empty input yields empty string', () => {
    assert.equal(cleanHostProse('', []), '');
    assert.equal(cleanHostProse('', null), '');
});

test('cleanHostProse: pure prose with no marker is preserved (modulo trim)', () => {
    const text = '  Hello world.\nSecond line.  ';
    assert.equal(cleanHostProse(text, []), 'Hello world.\nSecond line.');
});
