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

test('parse: marker with attachment + msgs', () => {
    const text = '<!--Phone:{"attachment":{"kind":"image","description":"a puppy"},"msgs":["look"]}-->';
    assert.deepEqual(parse(text), {
        msgs: ['look'],
        attachment: { kind: 'image', description: 'a puppy', image: null },
    });
});

test('parse: marker with attachment only (no msgs)', () => {
    const text = '<!--Phone:{"attachment":{"kind":"video","description":"a sunset"}}-->';
    assert.deepEqual(parse(text), {
        msgs: [],
        attachment: { kind: 'video', description: 'a sunset', image: null },
    });
});

test('parse: marker without attachment omits attachment key', () => {
    const r = parse('<!--Phone:{"msgs":["hi"]}-->');
    assert.deepEqual(r, { msgs: ['hi'] });
    assert.equal(r.attachment, undefined);
});

test('parse: attachment with unknown kind → attachment dropped', () => {
    const text = '<!--Phone:{"attachment":{"kind":"gif","description":"x"},"msgs":["hi"]}-->';
    assert.deepEqual(parse(text), { msgs: ['hi'] });
});

test('parse: attachment with missing description → attachment dropped', () => {
    const text = '<!--Phone:{"attachment":{"kind":"image"},"msgs":["hi"]}-->';
    assert.deepEqual(parse(text), { msgs: ['hi'] });
});

test('parse: attachment only AND invalid → returns null', () => {
    const text = '<!--Phone:{"attachment":"broken"}-->';
    assert.equal(parse(text), null);
});

test('parse: first attachment wins across multiple markers', () => {
    const text = '<!--Phone:{"attachment":{"kind":"image","description":"a"}}--> '
        + '<!--Phone:{"attachment":{"kind":"image","description":"b"},"msgs":["x"]}-->';
    const r = parse(text);
    assert.deepEqual(r.attachment, { kind: 'image', description: 'a', image: null });
    assert.deepEqual(r.msgs, ['x']);
});

test('parse: object-form bubble with full timing', () => {
    const text = '<!--Phone:{"msgs":[{"text":"hey","delay":500,"typeDuration":1200}]}-->';
    assert.deepEqual(parse(text), {
        msgs: ['hey'],
        timing: [{ delay: 500, typeDuration: 1200 }],
    });
});

test('parse: mixed string + object bubbles — timing field present for all', () => {
    const text = '<!--Phone:{"msgs":["hey",{"text":"sup","delay":400,"typeDuration":900}]}-->';
    assert.deepEqual(parse(text), {
        msgs: ['hey', 'sup'],
        timing: [{}, { delay: 400, typeDuration: 900 }],
    });
});

test('parse: plain-string bubbles produce no timing key', () => {
    const r = parse('<!--Phone:{"msgs":["a","b"]}-->');
    assert.deepEqual(r, { msgs: ['a', 'b'] });
    assert.equal(r.timing, undefined);
});

test('parse: object bubble with partial timing', () => {
    const text = '<!--Phone:{"msgs":[{"text":"yeah","delay":800}]}-->';
    assert.deepEqual(parse(text), {
        msgs: ['yeah'],
        timing: [{ delay: 800 }],
    });
});

test('parse: object bubble with no timing fields → no timing key emitted', () => {
    const r = parse('<!--Phone:{"msgs":[{"text":"yeah"}]}-->');
    assert.deepEqual(r, { msgs: ['yeah'] });
    assert.equal(r.timing, undefined);
});

test('parse: negative timing values rejected', () => {
    const text = '<!--Phone:{"msgs":[{"text":"x","delay":-100,"typeDuration":-1}]}-->';
    const r = parse(text);
    assert.deepEqual(r, { msgs: ['x'] });
});

test('parse: non-numeric timing values rejected', () => {
    const text = '<!--Phone:{"msgs":[{"text":"x","delay":"soon","typeDuration":null}]}-->';
    const r = parse(text);
    assert.deepEqual(r, { msgs: ['x'] });
});

test('parse: object-form bubble with empty text dropped', () => {
    const text = '<!--Phone:{"msgs":[{"text":"","delay":500},{"text":"ok"}]}-->';
    assert.deepEqual(parse(text), { msgs: ['ok'] });
});

test('parse: timing carries across multi-marker when first has timing', () => {
    const text = '<!--Phone:{"msgs":[{"text":"a","delay":500}]}--><!--Phone:{"msgs":["b"]}-->';
    assert.deepEqual(parse(text), {
        msgs: ['a', 'b'],
        timing: [{ delay: 500 }, {}],
    });
});

test('parse: fallback — leaked [SMS] block with bullets is accepted when no marker', () => {
    const text = '[SMS]\n- hey\n- u free';
    assert.deepEqual(parse(text), { msgs: ['hey', 'u free'] });
});

test('parse: fallback — leaked block embedded in prose still parses', () => {
    const text = 'she checks her phone and taps out:\n[SMS]\n- hey\n- u around';
    assert.deepEqual(parse(text), { msgs: ['hey', 'u around'] });
});

test('parse: fallback — bare [SMS] header with no bullets returns null', () => {
    assert.equal(parse('[SMS]'), null);
});

test('parse: marker takes priority over leaked block if both present', () => {
    const text = '[SMS]\n- stale\n<!--Phone:{"msgs":["fresh"]}-->';
    assert.deepEqual(parse(text), { msgs: ['fresh'] });
});

test('parse: fallback — leaked block inside a code fence is ignored', () => {
    const text = 'Here is what the format looks like:\n```\n[SMS]\n- example one\n- example two\n```\nThat\'s it.';
    assert.equal(parse(text), null);
});

test('parse: fallback — block after a closed code fence still parses', () => {
    const text = '```\nirrelevant\n```\n[SMS]\n- hi\n- u up';
    assert.deepEqual(parse(text), { msgs: ['hi', 'u up'] });
});

test('parse: fallback — second block parses if first is fenced', () => {
    const text = '```\n[SMS]\n- ignored\n```\nlater:\n[SMS]\n- real one';
    assert.deepEqual(parse(text), { msgs: ['real one'] });
});

test('parse: fallback — mid-line [SMS] reference does not parse', () => {
    // [SMS] mid-line, no following bullets directly under a [SMS] header line.
    const text = 'She glanced at her [SMS] inbox - nothing new.';
    assert.equal(parse(text), null);
});

test('strip: removes leaked [SMS] block from displayed text', () => {
    const text = 'prose before\n[SMS]\n- hey\n- there\nprose after';
    const cleaned = strip(text);
    assert.ok(!cleaned.includes('[SMS]'));
    assert.ok(cleaned.startsWith('prose before') && cleaned.endsWith('prose after'));
});

test('strip: removes both marker AND leaked block together', () => {
    const text = 'hi\n[SMS]\n- a\n<!--Phone:{"msgs":["b"]}-->\nend';
    const cleaned = strip(text);
    assert.ok(!cleaned.includes('[SMS]'), 'SMS header removed');
    assert.ok(!cleaned.includes('<!--Phone'), 'marker removed');
    assert.ok(cleaned.includes('hi') && cleaned.includes('end'), 'surrounding prose kept');
});
