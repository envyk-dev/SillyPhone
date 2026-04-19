import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, strip } from '../src/marker.js';

test('parse: single marker at end of message', () => {
    const text = 'Normal reply.\n<!--Phone:{"msgs":["hi","u up?"]}-->';
    assert.deepEqual(parse(text), { msgs: ['hi', 'u up?'] });
});

test('parse: marker in middle of message', () => {
    const text = 'Hello <!--Phone:{"msgs":["a"]}--> world';
    assert.deepEqual(parse(text), { msgs: ['a'] });
});

test('parse: multiple markers concat into one burst', () => {
    const text = '<!--Phone:{"msgs":["a"]}--> x <!--Phone:{"msgs":["b","c"]}-->';
    assert.deepEqual(parse(text), { msgs: ['a', 'b', 'c'] });
});

test('parse: no marker returns null', () => {
    assert.equal(parse('just regular text'), null);
});

test('parse: malformed JSON returns null', () => {
    const text = '<!--Phone:{"msgs":[broken]}-->';
    assert.equal(parse(text), null);
});

test('parse: marker with no msgs key returns null', () => {
    const text = '<!--Phone:{"other":"x"}-->';
    assert.equal(parse(text), null);
});

test('parse: msgs not an array returns null', () => {
    const text = '<!--Phone:{"msgs":"oops"}-->';
    assert.equal(parse(text), null);
});

test('parse: whitespace tolerance around JSON', () => {
    const text = '<!--Phone:  {"msgs":["a"]}  -->';
    assert.deepEqual(parse(text), { msgs: ['a'] });
});

test('parse: filters empty strings from msgs', () => {
    const text = '<!--Phone:{"msgs":["a","","b"]}-->';
    assert.deepEqual(parse(text), { msgs: ['a', 'b'] });
});

test('parse: null/undefined/non-string input', () => {
    assert.equal(parse(null), null);
    assert.equal(parse(undefined), null);
    assert.equal(parse(42), null);
});

test('strip: removes all markers from text', () => {
    const text = 'hello <!--Phone:{"msgs":["x"]}--> world <!--Phone:{"msgs":["y"]}-->';
    assert.equal(strip(text), 'hello  world ');
});

test('strip: text with no marker unchanged', () => {
    assert.equal(strip('plain text'), 'plain text');
});
