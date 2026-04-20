// Toggle item mounted into SillyTavern's wand/extensions menu (#extensionsMenu).
// Clicking flips the `showSmsRows` setting, re-applies the body class that
// reveals hidden [SMS] rows, and updates its own icon to reflect state.
import * as settings from '../settings.js';
import { applySmsRowVisibility } from './settings-panel.js';

const ITEM_ID = 'sillyphone-show-sms-rows';

function findHost() {
    return document.getElementById('extensionsMenu');
}

function render(item) {
    const on = !!settings.get('showSmsRows');
    item.classList.toggle('sp-menu-active', on);
    const icon = item.querySelector('.sp-menu-icon');
    if (icon) {
        icon.classList.toggle('fa-eye', on);
        icon.classList.toggle('fa-eye-slash', !on);
    }
}

export function mount() {
    const host = findHost();
    if (!host) {
        console.warn('[SillyPhone] #extensionsMenu not found — SMS row toggle unavailable');
        return;
    }
    if (host.querySelector(`#${ITEM_ID}`)) return;

    const item = document.createElement('div');
    item.id = ITEM_ID;
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.setAttribute('tabindex', '0');
    item.title = 'Reveal hidden [SMS] rows in the main chat log for manual editing.';
    item.innerHTML = `
        <div class="sp-menu-icon fa-solid fa-eye-slash extensionsMenuExtensionButton"></div>
        <span>Show [SMS] rows</span>
    `;

    item.addEventListener('click', () => {
        const next = !settings.get('showSmsRows');
        settings.set('showSmsRows', next);
        applySmsRowVisibility();
        render(item);
    });

    host.appendChild(item);
    render(item);
}
