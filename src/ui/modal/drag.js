// Desktop-only drag: the phone is a floating device, not a fullscreen modal.
// Drag is disarmed on (max-width: 600px) so mobile keeps fullscreen behavior.
// Position persists in localStorage — per-machine UI preference, independent
// of chat/character, so it stays put across chat switches.

const STORE_KEY = 'sillyphone.modalPos';
const DESKTOP_Q = '(min-width: 601px)';

let wired = false;
let modalEl = null;

function isDesktop() {
    return window.matchMedia(DESKTOP_Q).matches;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function readSaved() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (typeof p?.left !== 'number' || typeof p?.top !== 'number') return null;
        return p;
    } catch { return null; }
}

function saveCurrent() {
    if (!modalEl) return;
    const r = modalEl.getBoundingClientRect();
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ left: r.left, top: r.top }));
    } catch { /* quota or disabled — ignore */ }
}

// Apply saved (or default) position. Defaults align with CSS but we set
// inline styles so later drag math is symmetric (read rect → clamp → write).
// Clamp against current viewport so a resize-then-reopen doesn't leave the
// phone stranded off-screen.
export function restore(el) {
    modalEl = el;
    if (!isDesktop()) return;
    const saved = readSaved();
    const r = el.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - Math.max(200, r.width));
    const maxTop = Math.max(0, window.innerHeight - 100);
    const left = saved ? clamp(saved.left, 0, maxLeft) : Math.max(0, window.innerWidth - r.width - 24);
    const top = saved ? clamp(saved.top, 0, maxTop) : 60;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
}

// Re-clamp inline position if the viewport shrank while the phone was open.
// Without this, dragging the phone to the right on a 1600px viewport and
// then shrinking the window leaves `left: 900px` inline and the phone walks
// entirely off-screen. No-op on mobile — the !important CSS takes over.
function clampToViewport() {
    if (!modalEl || modalEl.style.display === 'none') return;
    if (!isDesktop()) return;
    const r = modalEl.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - r.width);
    const maxTop = Math.max(0, window.innerHeight - r.height);
    const curLeft = parseFloat(modalEl.style.left);
    const curTop = parseFloat(modalEl.style.top);
    const left = Number.isFinite(curLeft) ? curLeft : r.left;
    const top = Number.isFinite(curTop) ? curTop : r.top;
    modalEl.style.left = `${clamp(left, 0, maxLeft)}px`;
    modalEl.style.top = `${clamp(top, 0, maxTop)}px`;
    modalEl.style.right = 'auto';
    modalEl.style.bottom = 'auto';
}

// Wire drag on the header handle. Starts a drag only on true blank-area
// mousedowns — any descendant button (back, menu, trash, or future icons)
// keeps its own click semantics. Guard mirrors ST-Copilot's approach.
export function init({ modalEl: m, handleEl }) {
    if (wired) return;
    wired = true;
    modalEl = m;

    let active = false;
    let ox = 0, oy = 0, sl = 0, st = 0;

    handleEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (!isDesktop()) return;
        if (e.target.closest('button')) return;
        active = true;
        const r = modalEl.getBoundingClientRect();
        ox = e.clientX; oy = e.clientY;
        sl = r.left; st = r.top;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
    });

    function onMove(e) {
        if (!active) return;
        const r = modalEl.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - r.width);
        const maxTop = Math.max(0, window.innerHeight - r.height);
        modalEl.style.left = `${clamp(sl + (e.clientX - ox), 0, maxLeft)}px`;
        modalEl.style.top = `${clamp(st + (e.clientY - oy), 0, maxTop)}px`;
        modalEl.style.right = 'auto';
        modalEl.style.bottom = 'auto';
    }

    function onUp() {
        if (!active) return;
        active = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveCurrent();
    }

    // Debounce-light: just let the browser coalesce resize events — clamp
    // is cheap (one rect read + a few style writes) and re-clamping every
    // frame during a drag-resize looks better than snapping at the end.
    window.addEventListener('resize', clampToViewport);
}
