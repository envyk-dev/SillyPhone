// SillyPhone entry point — wires events, UI, and generation flows.
import { eventSource, event_types, name2, chat, getThumbnailUrl } from '../../../../script.js';
import * as settings from './src/settings.js';
import * as storage from './src/storage.js';
import * as context from './src/context.js';
import * as marker from './src/marker.js';
import * as memory from './src/memory.js';
import * as phoneGen from './src/phone-gen.js';
import * as badge from './src/ui/badge.js';
import * as toast from './src/ui/toast.js';
import * as modal from './src/ui/modal.js';
import * as settingsPanel from './src/ui/settings-panel.js';

// Dedupe Flow A parsing by (messageIdx, swipeId)
let lastParsedKey = null;

function getCharAvatar() {
    try { return getThumbnailUrl?.('avatar', name2) || ''; }
    catch { return ''; }
}

function currentCharName() {
    return name2 || 'Contact';
}

function openPhone() {
    modal.setCharInfo(currentCharName(), getCharAvatar());
    modal.open();
    badge.refresh();
}

function handleMessageReceived(messageIdx) {
    if (!settings.get('enabled')) return;

    // Rolling memory is independent of marker parsing — always check
    memory.checkRollingTrigger();

    if (messageIdx == null || !Array.isArray(chat) || !chat[messageIdx]) return;
    const msg = chat[messageIdx];
    if (msg.is_user) return;

    const swipeId = msg.swipe_id ?? 0;
    const key = `${messageIdx}:${swipeId}`;
    if (key === lastParsedKey) return;
    lastParsedKey = key;

    const parsed = marker.parse(msg.mes || '');
    if (!parsed) return;

    const ts = Date.now();
    storage.addToThread({ from: 'char', msgs: parsed.msgs, ts });
    context.updateSmsPrompt();

    if (modal.isOpen()) {
        modal.appendBurst({ from: 'char', msgs: parsed.msgs, ts });
    } else {
        storage.incUnread(parsed.msgs.length);
        badge.refresh();
        toast.show({
            charName: currentCharName(),
            msgs: parsed.msgs,
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
    modal.setCharInfo(currentCharName(), getCharAvatar());
    modal.refresh();
    badge.refresh();
    context.updateAll();
}

async function handleSend(text) {
    const ts = Date.now();
    storage.addToThread({ from: 'user', msgs: [text], ts });
    modal.appendSingle(text, 'user', ts);
    context.updateSmsPrompt();

    modal.setSendDisabled(true);
    modal.showTyping();
    try {
        const result = await phoneGen.generateReply(text);
        modal.hideTyping();
        if (result) {
            const charTs = Date.now();
            storage.addToThread({ from: 'char', msgs: result.msgs, ts: charTs });
            context.updateSmsPrompt();
            await modal.playCharBurst(result.msgs);
        } else {
            modal.appendSingle('…', 'char', Date.now());
        }
    } catch (err) {
        console.error('[SillyPhone] phone gen failed', err);
        modal.hideTyping();
        modal.appendSingle('(message not delivered)', 'char', Date.now());
    } finally {
        modal.setSendDisabled(false);
    }
}

function init() {
    settings.init();
    modal.mount({ onSend: handleSend });
    modal.setCharInfo(currentCharName(), getCharAvatar());
    badge.mount(openPhone);
    settingsPanel.mount();

    eventSource.on(event_types.MESSAGE_RECEIVED, handleMessageReceived);
    eventSource.on(event_types.MESSAGE_SENT, handleMessageSent);
    eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);

    context.updateAll();
    console.log('[SillyPhone] loaded');
}

init();
