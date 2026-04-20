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

function splitUserInput(text) {
    return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
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
    // Apply styling immediately — MESSAGE_RENDERED may not fire for
    // programmatically-pushed messages in all ST builds.
    applySmsRowStyling(burstIdx);
    return burstIdx;
}

// Escape a string for use inside a RegExp pattern.
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Remove marker, blockquote pseudo-transcript lines, AND any line that
// contains a parsed SMS message verbatim (model writing the message body
// as prose despite Flow A rule 5). Returns the cleaned host text.
function cleanHostProse(text, parsedMsgs) {
    let cleaned = marker.strip(text);
    cleaned = cleaned.replace(/^\s*>.*$/gm, '');
    for (const m of parsedMsgs || []) {
        if (!m || typeof m !== 'string') continue;
        const pat = new RegExp(`^.*${escapeRegex(m)}.*$`, 'gm');
        cleaned = cleaned.replace(pat, '');
    }
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

// Tag SMS rows with a class so CSS can hide the entire .mes element.
// Retries across animation frames because ST's addOneMessage renders async —
// the first query can fire before the DOM element exists.
function applySmsRowStyling(messageIdx, retries = 10) {
    if (messageIdx == null) return;
    const msg = ctx().chat?.[messageIdx];
    if (!msg?.extra?.sillyphone) return;
    const row = document.querySelector(`#chat .mes[mesid="${messageIdx}"]`);
    if (!row) {
        if (retries > 0) {
            requestAnimationFrame(() => applySmsRowStyling(messageIdx, retries - 1));
        } else {
            console.warn('[SillyPhone] row not found for styling', messageIdx);
        }
        return;
    }
    row.classList.add('sp-chat-sms');
}

// Iterate current chat and restyle every tagged SMS row. Used on
// CHAT_CHANGED (reload) so existing bursts pick up their classes again
// after ST rebuilds the DOM.
function restyleAllSmsRows() {
    const chat = ctx().chat;
    if (!Array.isArray(chat)) return;
    for (let i = 0; i < chat.length; i++) {
        if (chat[i]?.extra?.sillyphone) applySmsRowStyling(i);
    }
}

async function handleMessageReceived(messageIdx) {
    if (!settings.get('enabled')) return;
    memory.checkRollingTrigger();

    const chat = ctx().chat;
    if (messageIdx == null || !Array.isArray(chat) || !chat[messageIdx]) return;
    const msg = chat[messageIdx];
    if (msg.is_user) return;
    if (msg.extra?.sillyphone) return;

    const swipeId = msg.swipe_id ?? 0;
    const key = `${messageIdx}:${swipeId}`;
    if (key === lastParsedKey) return;
    lastParsedKey = key;

    const text = msg.mes || '';
    const parsed = marker.parse(text);
    if (!parsed) return;

    let stripped = cleanHostProse(text, parsed.msgs);
    // SMS-only mode: discard any host prose around the marker so the row
    // ends up empty and gets cut by the empty-host path below.
    if (settings.get('smsOnly')) stripped = '';

    if (stripped !== '') {
        msg.mes = stripped;
        // Re-render through ST's own formatter so markdown and linebreaks
        // survive. Raw textContent would collapse \n to spaces and break paragraphs.
        updateMessageDom(messageIdx, msg);
    }
    // When stripped is '' we skip the DOM update — commitCharBurstFromMarker
    // will cut the host outright, so there's no point rendering it first.

    await commitCharBurstFromMarker(messageIdx, parsed.msgs, parsed.attachment ?? null, stripped);
    const ts = Date.now();

    if (modal.isOpen()) {
        if (parsed.timing) {
            await modal.playCharBurst(parsed.msgs, ts, parsed.attachment ?? null, parsed.timing);
        } else {
            modal.appendBurst({ from: 'char', msgs: parsed.msgs, ts, attachment: parsed.attachment ?? null });
        }
    } else {
        const unreadBump = parsed.msgs.length + (parsed.attachment ? 1 : 0);
        storage.incUnread(unreadBump);
        badge.refresh();
        toast.show({
            charName: currentCharName(),
            msgs: parsed.attachment ? [...parsed.msgs, '[attachment]'] : parsed.msgs,
            onClick: openPhone,
        });
    }
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
    // After ST rebuilds the chat DOM, restyle any tagged SMS rows.
    requestAnimationFrame(restyleAllSmsRows);
}

// MESSAGE_RENDERED handler — same styling as applySmsRowStyling. Kept as a
// safety net for messages that weren't styled via the direct call after push.
function handleMessageRendered(messageIdx) {
    applySmsRowStyling(messageIdx);
}

// When the user edits an SMS row directly in the main chat log, re-parse
// its `mes` back into `extra.sillyphone` so the phone modal stays in sync.
// Non-SMS edits are a no-op (guard on the tag).
async function handleMessageEdited(messageIdx) {
    console.debug('[SillyPhone] edit event fired', messageIdx);
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
    applySmsRowStyling(userBurstIdx);
    modal.appendBurst({ from: 'user', msgs, ts, attachment });
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

function init() {
    try {
        const c = ctx();
        settings.init();
        modal.mount({ onSend: handleSend });
        modal.setCharInfo(currentCharName());
        badge.mount(openPhone);
        settingsPanel.mount();
        settingsPanel.applySmsRowVisibility();
        extensionsMenu.mount();

        c.eventSource.on(c.eventTypes.MESSAGE_RECEIVED, handleMessageReceived);
        c.eventSource.on(c.eventTypes.MESSAGE_SENT, handleMessageSent);
        c.eventSource.on(c.eventTypes.CHAT_CHANGED, handleChatChanged);
        c.eventSource.on(c.eventTypes.MESSAGE_RENDERED, handleMessageRendered);
        // Subscribe to every event whose name hints at message edit/update.
        // Different ST builds expose different subsets; idempotent handler
        // makes dual fires harmless. Logs each subscription for diagnostic.
        const editEventNames = Object.keys(c.eventTypes).filter(k =>
            /MESSAGE_(UPDATED|EDITED|SAVED|CHANGED)/.test(k),
        );
        for (const name of editEventNames) {
            c.eventSource.on(c.eventTypes[name], handleMessageEdited);
        }
        console.debug('[SillyPhone] subscribed to edit events:', editEventNames);

        context.updateAll();
        console.log('[SillyPhone] loaded v0.4.0');
    } catch (err) {
        console.error('[SillyPhone] init failed', err);
    }
}

if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
    init();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(init, 100);
    });
}
