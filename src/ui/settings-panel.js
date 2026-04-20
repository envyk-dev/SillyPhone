// Settings panel mounted into SillyTavern's Extensions drawer.
import * as settings from '../settings.js';
import * as storage from '../storage.js';
import * as badge from './badge.js';
import * as modal from './modal.js';
import * as context from '../context.js';
import * as chatSms from '../chat-sms.js';
import { ctx, cutChatMessage } from '../st.js';

const MOUNT_SELECTORS = ['#extensions_settings2', '#extensions_settings'];

function findMount() {
    for (const sel of MOUNT_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) return el;
    }
    return null;
}

export function mount() {
    const host = findMount();
    if (!host) {
        console.warn('[SillyPhone] settings mount point not found');
        return;
    }
    if (host.querySelector('#sillyphone-settings')) return;

    const panel = document.createElement('div');
    panel.id = 'sillyphone-settings';
    panel.className = 'sp-settings';
    panel.innerHTML = template();
    host.appendChild(panel);

    wire(panel);
}

function template() {
    return `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>SillyPhone</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label">
                    <input type="checkbox" data-sp="enabled"> Enabled
                </label>
                <label class="checkbox_label" title="Delete the host chat row after extracting SMS — keeps the chat log clean of prose around markers.">
                    <input type="checkbox" data-sp="fastSms"> Fast-SMS mode (drop host prose, keep only bubbles)
                </label>
                <label class="checkbox_label">
                    <input type="checkbox" data-sp="showBadge"> Show floating badge
                </label>
                <label class="checkbox_label">
                    <input type="checkbox" data-sp="toastSound"> Toast sound
                </label>

                <hr/>
                <h4>Rolling memory (opt-in)</h4>
                <label class="checkbox_label">
                    <input type="checkbox" data-sp="rollingMemory.enabled"> Enabled
                </label>
                <label>Summarize every N messages:
                    <input type="number" min="2" max="100" data-sp="rollingMemory.every" style="width:80px">
                </label>
                <label>Keep recent N unhidden:
                    <input type="number" min="2" max="100" data-sp="rollingMemory.keepRecent" style="width:80px">
                </label>
                <label>Summarization prompt:
                    <textarea data-sp="rollingMemory.summarizationPrompt" rows="3" style="width:100%"></textarea>
                </label>
                <div class="sp-conflict-warn" style="display:none;color:#ffb020;font-size:12px"></div>

                <hr/>
                <h4>AI instructions</h4>
                <label>Flow A (main-chat SMS marker instructions):
                    <textarea data-sp="flowAInstructions" rows="6" style="width:100%"></textarea>
                </label>

                <hr/>
                <button data-sp-action="clearThread" class="menu_button">Clear phone thread (current chat)</button>
                <button data-sp-action="clearAll" class="menu_button">Clear all phone data (current chat)</button>
            </div>
        </div>
    `;
}

function wire(panel) {
    const all = settings.getAll();
    for (const el of panel.querySelectorAll('[data-sp]')) {
        const path = el.dataset.sp.split('.');
        const val = path.reduce((o, k) => (o == null ? undefined : o[k]), all);
        if (el.type === 'checkbox') el.checked = !!val;
        else el.value = val ?? '';
    }

    panel.addEventListener('change', (e) => {
        const el = e.target;
        if (!el.dataset || !el.dataset.sp) return;
        const path = el.dataset.sp.split('.');
        let val;
        if (el.type === 'checkbox') val = el.checked;
        else if (el.type === 'number') val = Number(el.value);
        else val = el.value;
        if (path.length === 1) settings.set(path[0], val);
        else settings.setNested(path[0], path[1], val);
        badge.refresh();
        context.updateAll();
    });

    panel.querySelector('[data-sp-action="clearThread"]').addEventListener('click', async () => {
        if (!confirm('Clear phone thread for this chat?')) return;
        const bursts = chatSms.listBursts(ctx().chat);
        for (let i = bursts.length - 1; i >= 0; i--) {
            // eslint-disable-next-line no-await-in-loop
            await cutChatMessage(bursts[i].chatIdx);
        }
        storage.clearUnread();
        badge.refresh();
        modal.refresh();
    });

    panel.querySelector('[data-sp-action="clearAll"]').addEventListener('click', async () => {
        if (!confirm('Clear ALL phone data (thread + summary) for this chat?')) return;
        const bursts = chatSms.listBursts(ctx().chat);
        for (let i = bursts.length - 1; i >= 0; i--) {
            // eslint-disable-next-line no-await-in-loop
            await cutChatMessage(bursts[i].chatIdx);
        }
        storage.clearUnread();
        storage.resetSummary();
        badge.refresh();
        modal.refresh();
        context.updateAll();
    });

    maybeShowConflict(panel);
}

function maybeShowConflict(panel) {
    const warn = panel.querySelector('.sp-conflict-warn');
    try {
        const stSummarize = globalThis?.extension_settings?.memory;
        if (stSummarize && stSummarize.source && stSummarize.source !== 'none') {
            warn.style.display = 'block';
            warn.textContent = "SillyTavern's Summarize extension appears active. Running both may double-summarize. Pick one.";
        }
    } catch { /* ignore */ }
}
