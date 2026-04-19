// SillyPhone entry point — wires events, UI, and generation flows.
import { ctx } from './src/st.js';
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

let lastParsedKey = null;

function currentCharName() {
    return ctx().name2 || 'Contact';
}

function getCharAvatar() {
    try {
        const c = ctx();
        return c.getThumbnailUrl?.('avatar', c.name2) || '';
    } catch { return ''; }
}

function openPhone() {
    modal.setCharInfo(currentCharName(), getCharAvatar());
    modal.open();
    badge.refresh();
}

function handleMessageReceived(messageIdx) {
    if (!settings.get('enabled')) return;
    memory.checkRollingTrigger();

    const chat = ctx().chat;
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
    try {
        const c = ctx();
        settings.init();
        modal.mount({ onSend: handleSend });
        modal.setCharInfo(currentCharName(), getCharAvatar());
        badge.mount(openPhone);
        settingsPanel.mount();

        c.eventSource.on(c.eventTypes.MESSAGE_RECEIVED, handleMessageReceived);
        c.eventSource.on(c.eventTypes.MESSAGE_SENT, handleMessageSent);
        c.eventSource.on(c.eventTypes.CHAT_CHANGED, handleChatChanged);

        context.updateAll();
        console.log('[SillyPhone] loaded v0.2.0');
    } catch (err) {
        console.error('[SillyPhone] init failed', err);
    }
}

// SillyTavern may load extensions before its own context is ready — wait for body idle.
if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
    init();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(init, 100);
    });
}
