// Settings panel mounted into SillyTavern's Extensions drawer.
//
// The outer ST drawer shell (.inline-drawer + .inline-drawer-toggle) stays
// untouched so native collapse/expand keeps working. Everything inside is
// our polished .sp-panel — titled sections, switch rows, the theme grid,
// and input fields — wired through a single delegated event path.
//
// Every write path ends with the side-effect triple:
//   badge.refresh() + context.updateAll() + applySmsRowVisibility()
// so the panel stays behaviorally identical to the in-modal sheet.
import * as settings from '../settings.js';
import * as badge from './badge.js';
import * as modal from './modal.js';
import * as context from '../context.js';
import * as commands from '../commands.js';
import * as theme from './theme.js';
import * as extensionsMenu from './extensions-menu.js';
import { escapeHtml } from '../util.js';

const MOUNT_SELECTORS = ['#extensions_settings2', '#extensions_settings'];

// Reflect the showSmsRows setting onto <body>. The CSS rule that hides
// .mes.sp-chat-sms is scoped to body:not(.sp-show-sms-rows), so adding the
// class reveals the hidden SMS rows for manual editing.
export function applySmsRowVisibility() {
    document.body.classList.toggle('sp-show-sms-rows', !!settings.get('showSmsRows'));
}

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

// Re-read settings and repaint the panel's switches, inputs, and theme
// selection. Called by other surfaces (in-modal sheet, wand-menu) after
// they write a shared setting so the panel doesn't go stale. No-op if the
// panel isn't mounted.
export function refresh() {
    const panel = document.getElementById('sillyphone-settings');
    if (!panel) return;
    paintToggles(panel);
    paintInputs(panel);
    paintThemeSelection(panel);
}

// Toggles that render as a switch row under Display / Chat behavior /
// Rolling memory / AI instructions. Flat shape with a `path` per entry
// so the same loop handles top-level and nested keys.
const TOGGLES_DISPLAY = [
    { path: 'enabled',      label: 'Enabled',               sub: 'Master switch for the extension' },
    { path: 'showBadge',    label: 'Show floating badge',   sub: 'Phone button in the corner when the modal is closed' },
    { path: 'toastSound',   label: 'Toast sound',           sub: 'Chime when a new SMS arrives' },
    { path: 'showSmsRows',  label: 'Show [SMS] rows in main chat', sub: 'Reveal the hidden SMS chat rows for manual editing' },
];
const TOGGLES_BEHAVIOR = [
    { path: 'smsOnly', label: 'SMS-only mode', sub: 'Drop host prose around markers; chat becomes pure texting' },
];
const TOGGLES_AI = [
    { path: 'forcefulChatInject', label: 'Forceful chat inject', sub: 'Send marker instructions as user at depth 0 — strongest signal; may be echoed back by the model' },
];

function template() {
    return `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>SillyPhone</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="sp-panel">
                    <div class="sp-panel-content">

                        <div class="sp-section-title">Theme</div>
                        <div class="sp-theme-grid" role="radiogroup" aria-label="Theme">
                            ${theme.THEMES.map(themeCell).join('')}
                        </div>

                        <div class="sp-divider"></div>

                        <div class="sp-section-title">Display</div>
                        ${TOGGLES_DISPLAY.map(toggleRow).join('')}

                        <div class="sp-divider"></div>

                        <div class="sp-section-title">Chat behavior</div>
                        ${TOGGLES_BEHAVIOR.map(toggleRow).join('')}

                        <div class="sp-divider"></div>

                        <div class="sp-section-title">
                            Rolling memory <span class="sp-section-title-sub">— opt-in</span>
                        </div>
                        ${toggleRow({ path: 'rollingMemory.enabled', label: 'Enabled', sub: 'Auto-summarize older main-chat messages and hide them from the prompt' })}
                        ${numberRow({ path: 'rollingMemory.every', label: 'Summarize every', sub: 'Trigger once chat grows past this many messages', min: 2, max: 100 })}
                        ${numberRow({ path: 'rollingMemory.keepRecent', label: 'Keep recent', sub: 'Number of recent messages left unhidden', min: 2, max: 100 })}
                        <div class="sp-field">
                            <div class="sp-field-label">Summarization prompt</div>
                            <div class="sp-field-sub">Instructions sent to the model when generating a rolling summary.</div>
                            <textarea data-sp="rollingMemory.summarizationPrompt" rows="3"></textarea>
                        </div>
                        <div class="sp-warn" hidden>
                            <div class="sp-warn-icon">⚠</div>
                            <div class="sp-warn-body"></div>
                        </div>

                        <div class="sp-divider"></div>

                        <div class="sp-section-title">AI instructions</div>
                        ${TOGGLES_AI.map(toggleRow).join('')}
                        <div class="sp-field">
                            <div class="sp-field-label">Flow A — main-chat SMS marker instructions</div>
                            <div class="sp-field-sub">Guidance the model sees for when and how to emit <span class="sp-kbd">&lt;!--Phone:{...}--&gt;</span> markers in its replies.</div>
                            <textarea data-sp="flowAInstructions" rows="6"></textarea>
                        </div>

                        <div class="sp-divider"></div>

                        <div class="sp-section-title">Maintenance</div>
                        <div class="sp-actions">
                            <button class="sp-btn" data-sp-action="clearThread" type="button">
                                <span class="sp-btn-icon">✕</span>
                                <span>Clear phone thread (current chat)</span>
                            </button>
                            <button class="sp-btn sp-btn-destructive" data-sp-action="clearAll" type="button">
                                <span class="sp-btn-icon">🗑</span>
                                <span>Clear all phone data (current chat)</span>
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    `;
}

function themeCell({ key, label }) {
    return `
        <button class="sp-theme-cell" data-sp-theme-cell="${escapeHtml(key)}" type="button" role="radio" aria-checked="false">
            <span class="sp-theme-sw" style="background: linear-gradient(135deg, var(--sp-grad-a-${key}), var(--sp-grad-b-${key}) 60%, var(--sp-grad-c-${key}))"></span>
            <span class="sp-theme-name">${escapeHtml(label)}</span>
        </button>
    `;
}

function toggleRow({ path, label, sub }) {
    return `
        <button class="sp-row" data-sp-toggle="${escapeHtml(path)}" type="button" role="switch" aria-checked="false">
            <span class="sp-row-label">
                <span class="sp-row-main">${escapeHtml(label)}</span>
                <span class="sp-row-sub">${escapeHtml(sub)}</span>
            </span>
            <span class="sp-switch"></span>
        </button>
    `;
}

function numberRow({ path, label, sub, min, max }) {
    return `
        <div class="sp-row sp-row-number">
            <div class="sp-row-label">
                <div class="sp-row-main">${escapeHtml(label)}</div>
                <div class="sp-row-sub">${escapeHtml(sub)}</div>
            </div>
            <input type="number" data-sp="${escapeHtml(path)}" min="${min}" max="${max}">
        </div>
    `;
}

function readPath(s, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), s);
}

function writePath(path, value) {
    const parts = path.split('.');
    if (parts.length === 1) settings.set(parts[0], value);
    else settings.setNested(parts[0], parts[1], value);
}

function applySideEffects() {
    badge.refresh();
    context.updateAll();
    applySmsRowVisibility();
    extensionsMenu.refresh();
}

function wire(panel) {
    // Inline <style> to back the theme-cell swatch gradients. The grid uses
    // one CSS rule per theme (rather than inline style="" that duplicates
    // the stops in markup) so the hex values live in exactly one place.
    injectSwatchStyles(panel);

    paintToggles(panel);
    paintInputs(panel);
    paintThemeSelection(panel);
    maybeShowConflict(panel);

    // Toggle rows (any switch-style row).
    panel.querySelectorAll('[data-sp-toggle]').forEach(row => {
        row.addEventListener('click', () => {
            const path = row.dataset.spToggle;
            const all = settings.getAll();
            const next = !readPath(all, path);
            writePath(path, next);
            row.querySelector('.sp-switch').classList.toggle('on', next);
            row.setAttribute('aria-checked', String(next));
            applySideEffects();
        });
    });

    // Number inputs + textareas. Fire on `change` (blur) — matches the old
    // behavior and avoids hammering settings on every keystroke.
    panel.addEventListener('change', (e) => {
        const el = e.target;
        if (!el.dataset || !el.dataset.sp) return;
        const path = el.dataset.sp;
        let val;
        if (el.type === 'number') val = Number(el.value);
        else val = el.value;
        writePath(path, val);
        applySideEffects();
    });

    // Theme cells.
    panel.querySelectorAll('[data-sp-theme-cell]').forEach(cell => {
        cell.addEventListener('click', () => {
            const key = cell.dataset.spThemeCell;
            settings.set('theme', key);
            theme.apply(key);
            paintThemeSelection(panel);
        });
    });

    panel.querySelector('[data-sp-action="clearThread"]').addEventListener('click', async () => {
        if (!confirm('Clear phone thread for this chat?')) return;
        await commands.clearThread();
        modal.refresh();
    });

    panel.querySelector('[data-sp-action="clearAll"]').addEventListener('click', async () => {
        if (!confirm('Clear ALL phone data (thread + summary) for this chat?')) return;
        await commands.clearThread({ alsoSummary: true });
        modal.refresh();
    });
}

function injectSwatchStyles(panel) {
    if (panel.querySelector('style[data-sp-swatches]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-sp-swatches', '');
    // Per-theme gradient stops so the swatches show each palette even while
    // the document cascade is sitting on a different theme. Keys mirror
    // THEMES in theme.js; if a new theme is added there, add its stops here.
    style.textContent = `
        .sp-settings {
            --sp-grad-a-violet:#6366f1; --sp-grad-b-violet:#8b5cf6; --sp-grad-c-violet:#ad72f4;
            --sp-grad-a-rose:#f43f5e;   --sp-grad-b-rose:#ec4899;   --sp-grad-c-rose:#f472b6;
            --sp-grad-a-ember:#f97316;  --sp-grad-b-ember:#fb923c;  --sp-grad-c-ember:#fbbf24;
            --sp-grad-a-emerald:#0a996c;--sp-grad-b-emerald:#19b594;--sp-grad-c-emerald:#21b491;
            --sp-grad-a-azure:#0ea5e9;  --sp-grad-b-azure:#3b82f6;  --sp-grad-c-azure:#6366f1;
        }
    `;
    panel.prepend(style);
}

function paintToggles(panel) {
    const all = settings.getAll();
    panel.querySelectorAll('[data-sp-toggle]').forEach(row => {
        const path = row.dataset.spToggle;
        const on = !!readPath(all, path);
        row.querySelector('.sp-switch').classList.toggle('on', on);
        row.setAttribute('aria-checked', String(on));
    });
}

function paintInputs(panel) {
    const all = settings.getAll();
    panel.querySelectorAll('[data-sp]').forEach(el => {
        const val = readPath(all, el.dataset.sp);
        if (el.tagName === 'TEXTAREA') el.value = val ?? '';
        else if (el.type === 'number') el.value = val ?? '';
        else el.value = val ?? '';
    });
}

function paintThemeSelection(panel) {
    const current = settings.get('theme') || theme.DEFAULT_THEME;
    panel.querySelectorAll('[data-sp-theme-cell]').forEach(cell => {
        const on = cell.dataset.spThemeCell === current;
        cell.classList.toggle('selected', on);
        cell.setAttribute('aria-checked', String(on));
    });
}

function maybeShowConflict(panel) {
    const warn = panel.querySelector('.sp-warn');
    const body = panel.querySelector('.sp-warn-body');
    try {
        const stSummarize = globalThis?.extension_settings?.memory;
        if (stSummarize && stSummarize.source && stSummarize.source !== 'none') {
            body.textContent = "SillyTavern's Summarize extension appears active. Running both may double-summarize — pick one.";
            warn.hidden = false;
        }
    } catch { /* ignore */ }
}
