// SillyPhone entry point — wires events, UI, and generation flows.
import { ctx, pushChatMessage, cutChatMessage, runSlashCommand, updateMessageDom, replaceChatMessage } from './src/st.js';
import * as settings from './src/settings.js';
import * as storage from './src/storage.js';
import * as context from './src/context.js';
import * as marker from './src/marker.js';
import * as memory from './src/memory.js';
import * as chatSms from './src/chat-sms.js';
import * as badge from './src/ui/badge.js';
import * as toast from './src/ui/toast.js';
import * as modal from './src/ui/modal.js';
import * as settingsPanel from './src/ui/settings-panel.js';
import * as extensionsMenu from './src/ui/extensions-menu.js';
import * as rowObserver from './src/row-observer.js';
import * as events from './src/events.js';
import { cleanHostProse, splitUserInput } from './src/host-prose.js';

let lastParsedKey = null;

function currentCharName() {
    return ctx().name2 || 'Contact';
}

function currentUserName() {
    return ctx().name1 || 'You';
}

function openPhone() {
    modal.setCharInfo(currentCharName());
    modal.open();
    badge.refresh();
}

// Dedup on idx + swipe + content fingerprint. Position alone isn't enough:
// after a reroll (cut burst + /trigger), a brand-new generation lands at
// the same idx:swipe as the previous one and would be falsely dropped as
// a duplicate. Fingerprint = length + first 64 chars is plenty to
// disambiguate distinct generations while still catching genuine double-
// fires (tool calls, continue/append) whose content is identical.
function isDuplicateReceive(messageIdx, swipeId, text) {
    const key = `${messageIdx}:${swipeId}:${text.length}:${text.slice(0, 64)}`;
    if (key === lastParsedKey) return { dup: true, key };
    return { dup: false, key };
}

async function commitCharBurstFromMarker(hostIdx, parsedMsgs, attachment, hostResidualText) {
    const charName = currentCharName();
    const userName = currentUserName();
    const ts = Date.now();
    const burstMsg = chatSms.buildBurstMessage({
        from: 'char', msgs: parsedMsgs, ts, charName, userName, attachment,
    });

    // If the host is empty (prose stripped away, or fast-SMS mode) cut it
    // BEFORE pushing the burst. Doing it after-push has proven racy — the
    // blank prose row would occasionally survive the /cut. Cutting first
    // also means the burst lands at the host's former chat index.
    if (hostResidualText.trim() === '') {
        await cutChatMessage(hostIdx);
    }

    const burstIdx = pushChatMessage(burstMsg);
    // The row-observer will add .sp-chat-sms as soon as ST renders the row.
    return burstIdx;
}

// Strip marker/blockquote/verbatim-line prose from the host AI message and
// commit the SMS burst. Mutates msg.mes only when residual prose remains,
// otherwise the empty host gets cut by commitCharBurstFromMarker.
async function cleanAndCommitCharBurst(messageIdx, msg, parsed) {
    let stripped = cleanHostProse(msg.mes || '', parsed.msgs);
    if (settings.get('smsOnly')) stripped = '';

    if (stripped !== '') {
        msg.mes = stripped;
        // Re-render through ST's own formatter so markdown and linebreaks
        // survive. Raw textContent would collapse \n to spaces and break paragraphs.
        updateMessageDom(messageIdx, msg);
    }

    return commitCharBurstFromMarker(messageIdx, parsed.msgs, parsed.attachment ?? null, stripped);
}

// Either play the burst inside the open modal (with timing if specified)
// or bump the unread badge and surface a toast.
async function notifyOrPlay(parsed, chatIdx) {
    const ts = Date.now();
    if (modal.isOpen()) {
        if (parsed.timing) {
            await modal.playCharBurst(parsed.msgs, ts, parsed.attachment ?? null, parsed.timing, chatIdx);
        } else {
            modal.appendBurst({ from: 'char', msgs: parsed.msgs, ts, attachment: parsed.attachment ?? null, chatIdx });
        }
        return;
    }
    const unreadBump = parsed.msgs.length + (parsed.attachment ? 1 : 0);
    storage.incUnread(unreadBump);
    badge.refresh();
    toast.show({
        charName: currentCharName(),
        msgs: parsed.attachment ? [...parsed.msgs, '[attachment]'] : parsed.msgs,
        onClick: openPhone,
    });
}

async function handleMessageReceived(messageIdx) {
    if (!settings.get('enabled')) return;
    memory.checkRollingTrigger();

    const chat = ctx().chat;
    if (messageIdx == null || !Array.isArray(chat) || !chat[messageIdx]) return;
    const msg = chat[messageIdx];
    if (msg.is_user) return;
    if (msg.extra?.sillyphone) return;

    const text = msg.mes || '';
    const { dup, key } = isDuplicateReceive(messageIdx, msg.swipe_id ?? 0, text);
    if (dup) return;

    const parsed = marker.parse(text);
    // Don't claim the dedup key until parse succeeds. ST double-fires
    // MESSAGE_RECEIVED on some paths and the first fire can land with an
    // empty or partial mes. Locking the key here would cause the real
    // second fire — the one carrying the marker — to hit dedup and get
    // dropped.
    if (!parsed) return;
    lastParsedKey = key;

    const burstIdx = await cleanAndCommitCharBurst(messageIdx, msg, parsed);
    await notifyOrPlay(parsed, burstIdx);
}

function handleMessageSent() {
    memory.checkRollingTrigger();
}

function handleChatChanged() {
    lastParsedKey = null;
    memory.resetRollingTrigger();
    modal.close();
    modal.setCharInfo(currentCharName());
    modal.refresh();
    badge.refresh();
    context.updateAll();
    // ST may re-mount #chat; re-bind the observer if needed, then sweep any
    // rows it already rendered in this frame.
    rowObserver.start();
    requestAnimationFrame(rowObserver.styleAllTaggedRows);
}

// When the user edits an SMS row directly in the main chat log, re-parse
// its `mes` back into `extra.sillyphone` so the phone modal stays in sync.
// Non-SMS edits are a no-op (guard on the tag).
async function handleMessageEdited(messageIdx) {
    const idx = Number(messageIdx);
    const chat = ctx().chat;
    if (!Number.isInteger(idx) || !Array.isArray(chat) || !chat[idx]) return;
    const msg = chat[idx];
    if (!msg.extra?.sillyphone) return;
    const r = chatSms.rebuildBurstFromMes(msg);
    if (r.action === 'update') replaceChatMessage(idx, r.msg);
    else if (r.action === 'remove') await cutChatMessage(idx);
    modal.refresh();
    badge.refresh();
}

async function handleSend(payload) {
    const rawText = payload?.text || '';
    const attachment = payload?.attachment || null;
    const msgs = splitUserInput(rawText);
    if (msgs.length === 0 && !attachment) return;

    const ts = Date.now();
    const charName = currentCharName();
    const userName = currentUserName();
    const userBurst = chatSms.buildBurstMessage({
        from: 'user', msgs, ts, charName, userName, attachment,
    });
    const userBurstIdx = pushChatMessage(userBurst);
    // Row-observer styles the new .mes row once ST renders it.
    modal.appendBurst({ from: 'user', msgs, ts, attachment, chatIdx: userBurstIdx });
    modal.scrollToBottom();

    modal.setSendDisabled(true);
    modal.showTyping();
    context.setSmsMode(true);
    try {
        await runSlashCommand('/trigger');
        // Reply lands via MESSAGE_RECEIVED → commitCharBurstFromMarker.
    } catch (err) {
        console.error('[SillyPhone] Flow B /trigger failed', err);
        modal.appendBurst({ from: 'char', msgs: ['(message not delivered)'], ts: Date.now() });
    } finally {
        context.setSmsMode(false);
        modal.hideTyping();
        modal.setSendDisabled(false);
    }
}

async function handleReroll() {
    const chat = ctx().chat;
    const lastIdx = chatSms.findLastCharBurstForReroll(chat);
    if (lastIdx < 0) return;

    modal.setRerollInFlight(true);
    modal.setSendDisabled(true);
    try {
        await cutChatMessage(lastIdx);
        modal.refresh();
        modal.showTyping();
        context.setSmsMode(true);
        try {
            await runSlashCommand('/trigger');
        } catch (err) {
            console.error('[SillyPhone] reroll /trigger failed', err);
            modal.appendBurst({ from: 'char', msgs: ['(reroll failed)'], ts: Date.now() });
        } finally {
            context.setSmsMode(false);
            modal.hideTyping();
        }
    } finally {
        modal.setSendDisabled(false);
        modal.setRerollInFlight(false);
    }
}

function init() {
    try {
        settings.init();
        lockStatusBarBlack();
        paintStatusBarSafeArea();
        modal.mount({ onSend: handleSend, onReroll: handleReroll });
        modal.setCharInfo(currentCharName());
        badge.mount(openPhone);
        settingsPanel.mount();
        settingsPanel.applySmsRowVisibility();
        extensionsMenu.mount();

        events.bindAll({
            onReceived: handleMessageReceived,
            onSent: handleMessageSent,
            onChanged: handleChatChanged,
            onEdited: handleMessageEdited,
        });

        context.updateAll();
        rowObserver.start();
        rowObserver.styleAllTaggedRows();
        console.log('[SillyPhone] loaded v0.8.0');
    } catch (err) {
        console.error('[SillyPhone] init failed', err);
    }
}

// Pin the iOS PWA status bar to black so it blends with the phone modal
// chrome. ST's power-user.js rewrites <meta name="theme-color"> to the
// active theme's "Blur Tint" color on every theme apply — this observer
// wins the race and snaps it back. `content`-attribute filter keeps the
// callback narrow; the TARGET check prevents an infinite loop when our
// own set fires the observer.
function lockStatusBarBlack() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const TARGET = '#000000';
    meta.setAttribute('content', TARGET);
    new MutationObserver(() => {
        if (meta.getAttribute('content') !== TARGET) {
            meta.setAttribute('content', TARGET);
        }
    }).observe(meta, { attributes: true, attributeFilter: ['content'] });
}

// iOS 17+ tends to render the PWA status bar translucent regardless of
// what apple-mobile-web-app-status-bar-style says, so the bar shows
// whatever page content is underneath it (dark during load, gray once
// ST's top bar paints). Mounting a fixed black strip sized to
// env(safe-area-inset-top) makes "whatever's underneath" solid black on
// iOS and zero-height nothing everywhere else. See style.css for the rule.
function paintStatusBarSafeArea() {
    if (document.getElementById('sillyphone-status-bar-bg')) return;
    const bar = document.createElement('div');
    bar.id = 'sillyphone-status-bar-bg';
    (document.documentElement || document.body).appendChild(bar);
}

// Poll via rAF until SillyTavern.getContext is available, then init().
// rAF naturally gates on the first frame, so this also covers the
// pre-DOMContentLoaded case without a separate listener. 10s ceiling keeps
// a never-loading host from spinning forever.
function waitForSillyTavern(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
                resolve();
                return;
            }
            if (Date.now() - start > timeoutMs) {
                reject(new Error(`SillyTavern context did not become available within ${timeoutMs}ms`));
                return;
            }
            requestAnimationFrame(check);
        };
        check();
    });
}

waitForSillyTavern()
    .then(init)
    .catch(err => console.error('[SillyPhone]', err));
