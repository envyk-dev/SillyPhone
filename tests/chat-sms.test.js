import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listBursts, formatBurstMes, buildBurstMessage, deleteMessageFromBurst, deleteAttachmentFromBurst, parseBurstMes, rebuildBurstFromMes } from '../src/chat-sms.js';

test('listBursts: returns chat messages tagged with sillyphone, with chatIdx', () => {
    const chat = [
        { mes: 'hello', extra: {} },
        { mes: '[SMS]\n- hi', extra: { sillyphone: { from: 'char', msgs: ['hi'], ts: 10 } } },
        { mes: 'scene prose', extra: {} },
        { mes: '[SMS]\n- yo', extra: { sillyphone: { from: 'user', msgs: ['yo'], ts: 20 } } },
    ];
    assert.deepEqual(listBursts(chat), [
        { chatIdx: 1, from: 'char', msgs: ['hi'], ts: 10 },
        { chatIdx: 3, from: 'user', msgs: ['yo'], ts: 20 },
    ]);
});

test('listBursts: includes attachment when present', () => {
    const chat = [
        {
            mes: '[SMS]\n[image: a puppy]\n- hi',
            extra: {
                sillyphone: {
                    from: 'char', msgs: ['hi'], ts: 10,
                    attachment: { kind: 'image', description: 'a puppy', image: null },
                },
            },
        },
    ];
    const r = listBursts(chat);
    assert.equal(r.length, 1);
    assert.deepEqual(r[0].attachment, { kind: 'image', description: 'a puppy', image: null });
});

test('listBursts: empty chat → empty array', () => {
    assert.deepEqual(listBursts([]), []);
});

test('listBursts: no tagged messages → empty array', () => {
    assert.deepEqual(listBursts([{ mes: 'x', extra: {} }]), []);
});

test('listBursts: tolerates missing extra', () => {
    assert.deepEqual(listBursts([{ mes: 'x' }]), []);
});

test('formatBurstMes: single message → [SMS] header + bullet', () => {
    assert.equal(formatBurstMes(['hi']), '[SMS]\n- hi');
});

test('formatBurstMes: multi message → one bullet per line', () => {
    assert.equal(
        formatBurstMes(['hey u here yet?', 'im at the mall']),
        '[SMS]\n- hey u here yet?\n- im at the mall'
    );
});

test('formatBurstMes: empty array → header only', () => {
    assert.equal(formatBurstMes([]), '[SMS]');
});

test('formatBurstMes: with image attachment → prepends [image: description]', () => {
    assert.equal(
        formatBurstMes(['look'], { kind: 'image', description: 'a puppy' }),
        '[SMS]\n[image: a puppy]\n- look'
    );
});

test('formatBurstMes: with video attachment → prepends [video: description]', () => {
    assert.equal(
        formatBurstMes([], { kind: 'video', description: 'a sunset' }),
        '[SMS]\n[video: a sunset]'
    );
});

test('formatBurstMes: attachment with missing fields → ignored', () => {
    assert.equal(formatBurstMes(['hi'], { kind: 'image' }), '[SMS]\n- hi');
    assert.equal(formatBurstMes(['hi'], { description: 'x' }), '[SMS]\n- hi');
    assert.equal(formatBurstMes(['hi'], null), '[SMS]\n- hi');
});

test('buildBurstMessage: char burst — is_user false, tagged, plaintext mes', () => {
    const m = buildBurstMessage({
        from: 'char', msgs: ['hi', 'there'], ts: 1234, charName: 'Aria', userName: 'You',
    });
    assert.equal(m.is_user, false);
    assert.equal(m.name, 'Aria');
    assert.equal(m.mes, '[SMS]\n- hi\n- there');
    assert.equal(m.send_date, 1234);
    assert.deepEqual(m.extra.sillyphone, { from: 'char', msgs: ['hi', 'there'], ts: 1234 });
});

test('buildBurstMessage: user burst — is_user true, user name', () => {
    const m = buildBurstMessage({
        from: 'user', msgs: ['yo'], ts: 5, charName: 'Aria', userName: 'You',
    });
    assert.equal(m.is_user, true);
    assert.equal(m.name, 'You');
    assert.deepEqual(m.extra.sillyphone, { from: 'user', msgs: ['yo'], ts: 5 });
});

test('buildBurstMessage: defaults ts when missing', () => {
    const before = Date.now();
    const m = buildBurstMessage({ from: 'char', msgs: ['a'], charName: 'A', userName: 'U' });
    assert.ok(m.send_date >= before);
    assert.ok(m.extra.sillyphone.ts === m.send_date);
});

test('buildBurstMessage: with attachment → mes includes description, extra carries normalized attachment', () => {
    const m = buildBurstMessage({
        from: 'char', msgs: ['look'], ts: 5, charName: 'Aria', userName: 'You',
        attachment: { kind: 'image', description: 'a puppy' },
    });
    assert.equal(m.mes, '[SMS]\n[image: a puppy]\n- look');
    assert.deepEqual(m.extra.sillyphone.attachment, {
        kind: 'image', description: 'a puppy', image: null,
    });
});

test('buildBurstMessage: attachment without bubbles is allowed', () => {
    const m = buildBurstMessage({
        from: 'user', msgs: [], ts: 5, charName: 'Aria', userName: 'You',
        attachment: { kind: 'video', description: 'a sunset' },
    });
    assert.equal(m.mes, '[SMS]\n[video: a sunset]');
    assert.deepEqual(m.extra.sillyphone.msgs, []);
    assert.deepEqual(m.extra.sillyphone.attachment, {
        kind: 'video', description: 'a sunset', image: null,
    });
});

test('buildBurstMessage: attachment.image reserved for future (always null now)', () => {
    const m = buildBurstMessage({
        from: 'char', msgs: [], ts: 1, charName: 'A', userName: 'U',
        attachment: { kind: 'image', description: 'x', image: { dataUri: 'data:...', width: 1, height: 1 } },
    });
    assert.equal(m.extra.sillyphone.attachment.image, null);
});

test('deleteMessageFromBurst: removes msg, returns updated chat msg', () => {
    const chatMsg = {
        mes: '[SMS]\n- a\n- b\n- c',
        extra: { sillyphone: { from: 'char', msgs: ['a', 'b', 'c'], ts: 10 } },
    };
    const r = deleteMessageFromBurst(chatMsg, 1);
    assert.equal(r.action, 'update');
    assert.deepEqual(r.msg.extra.sillyphone.msgs, ['a', 'c']);
    assert.equal(r.msg.mes, '[SMS]\n- a\n- c');
});

test('deleteMessageFromBurst: last msg AND no attachment → action=remove', () => {
    const chatMsg = {
        mes: '[SMS]\n- a',
        extra: { sillyphone: { from: 'char', msgs: ['a'], ts: 10 } },
    };
    assert.equal(deleteMessageFromBurst(chatMsg, 0).action, 'remove');
});

test('deleteMessageFromBurst: last msg BUT attachment remains → action=update', () => {
    const chatMsg = {
        mes: '[SMS]\n[image: a puppy]\n- a',
        extra: {
            sillyphone: {
                from: 'char', msgs: ['a'], ts: 10,
                attachment: { kind: 'image', description: 'a puppy', image: null },
            },
        },
    };
    const r = deleteMessageFromBurst(chatMsg, 0);
    assert.equal(r.action, 'update');
    assert.deepEqual(r.msg.extra.sillyphone.msgs, []);
    assert.equal(r.msg.mes, '[SMS]\n[image: a puppy]');
});

test('deleteMessageFromBurst: out-of-range → action=noop', () => {
    const chatMsg = { extra: { sillyphone: { from: 'char', msgs: ['a'], ts: 10 } } };
    assert.equal(deleteMessageFromBurst(chatMsg, 5).action, 'noop');
    assert.equal(deleteMessageFromBurst(chatMsg, -1).action, 'noop');
});

test('deleteMessageFromBurst: non-tagged msg → action=noop', () => {
    assert.equal(deleteMessageFromBurst({ extra: {} }, 0).action, 'noop');
});

test('deleteAttachmentFromBurst: removes attachment, keeps msgs', () => {
    const chatMsg = {
        mes: '[SMS]\n[image: a puppy]\n- look',
        extra: {
            sillyphone: {
                from: 'char', msgs: ['look'], ts: 10,
                attachment: { kind: 'image', description: 'a puppy', image: null },
            },
        },
    };
    const r = deleteAttachmentFromBurst(chatMsg);
    assert.equal(r.action, 'update');
    assert.equal(r.msg.extra.sillyphone.attachment, undefined);
    assert.equal(r.msg.mes, '[SMS]\n- look');
});

test('deleteAttachmentFromBurst: attachment-only burst → action=remove', () => {
    const chatMsg = {
        mes: '[SMS]\n[image: a puppy]',
        extra: {
            sillyphone: {
                from: 'char', msgs: [], ts: 10,
                attachment: { kind: 'image', description: 'a puppy', image: null },
            },
        },
    };
    assert.equal(deleteAttachmentFromBurst(chatMsg).action, 'remove');
});

test('deleteAttachmentFromBurst: no attachment → action=noop', () => {
    const chatMsg = {
        extra: { sillyphone: { from: 'char', msgs: ['a'], ts: 10 } },
    };
    assert.equal(deleteAttachmentFromBurst(chatMsg).action, 'noop');
});

test('deleteAttachmentFromBurst: not tagged → action=noop', () => {
    assert.equal(deleteAttachmentFromBurst({ extra: {} }).action, 'noop');
});

test('parseBurstMes: standard format with header and bullets', () => {
    assert.deepEqual(parseBurstMes('[SMS]\n- hello\n- world'), { msgs: ['hello', 'world'] });
});

test('parseBurstMes: attachment line parsed into attachment object', () => {
    assert.deepEqual(parseBurstMes('[SMS]\n[image: a sunset]\n- look at this'), {
        msgs: ['look at this'],
        attachment: { kind: 'image', description: 'a sunset', image: null },
    });
});

test('parseBurstMes: lines without "- " prefix still accepted as bubbles', () => {
    assert.deepEqual(parseBurstMes('[SMS]\nhello\nworld'), { msgs: ['hello', 'world'] });
});

test('parseBurstMes: blank lines ignored', () => {
    assert.deepEqual(parseBurstMes('[SMS]\n\n- hi\n\n- yo\n'), { msgs: ['hi', 'yo'] });
});

test('parseBurstMes: empty/non-string input', () => {
    assert.deepEqual(parseBurstMes(''), { msgs: [] });
    assert.deepEqual(parseBurstMes(null), { msgs: [] });
});

test('rebuildBurstFromMes: user edit shrinks bubble list', () => {
    const chatMsg = {
        mes: '[SMS]\n- hello',
        extra: { sillyphone: { from: 'char', msgs: ['hello', 'extra'], ts: 42 } },
    };
    const r = rebuildBurstFromMes(chatMsg);
    assert.equal(r.action, 'update');
    assert.deepEqual(r.msg.extra.sillyphone.msgs, ['hello']);
    assert.equal(r.msg.extra.sillyphone.ts, 42);
    assert.equal(r.msg.extra.sillyphone.from, 'char');
});

test('rebuildBurstFromMes: emptied mes → action=remove', () => {
    const chatMsg = {
        mes: '[SMS]',
        extra: { sillyphone: { from: 'char', msgs: ['hi'], ts: 10 } },
    };
    assert.equal(rebuildBurstFromMes(chatMsg).action, 'remove');
});

test('rebuildBurstFromMes: non-tagged chat message → action=noop', () => {
    assert.equal(rebuildBurstFromMes({ mes: 'prose', extra: {} }).action, 'noop');
});

test('rebuildBurstFromMes: reformats mes so displayed text is canonical', () => {
    const chatMsg = {
        mes: '[SMS]\nhello\nworld',
        extra: { sillyphone: { from: 'user', msgs: [], ts: 7 } },
    };
    const r = rebuildBurstFromMes(chatMsg);
    assert.equal(r.action, 'update');
    assert.equal(r.msg.mes, '[SMS]\n- hello\n- world');
});
