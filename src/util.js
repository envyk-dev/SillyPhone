// Shared utilities used across modules. Keep dependency-free.

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}
