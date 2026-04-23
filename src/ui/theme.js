// Global accent-theme registry + applier. Each theme is a narrow gradient
// palette (3 stops, similar saturation/lightness, ~30° hue sweep). The active
// theme's stops flow through `--sp-grad-a/b/c` and drive every accent surface
// in style.css — gradients directly, solid accents as `var()`, rgba tints via
// `color-mix(in oklab, var(--sp-grad-b) N%, transparent)`.
//
// Applied at the document root (<html>) so the badge, modal, and settings
// panel — all mounted as siblings of <body> — inherit the same cascade.

export const THEMES = [
    { key: 'violet',  label: 'Violet' },
    { key: 'rose',    label: 'Rose' },
    { key: 'ember',   label: 'Ember' },
    { key: 'emerald', label: 'Emerald' },
    { key: 'azure',   label: 'Azure' },
];

export const DEFAULT_THEME = 'violet';

const VALID_KEYS = new Set(THEMES.map(t => t.key));

export function isValid(name) {
    return typeof name === 'string' && VALID_KEYS.has(name);
}

// Set <html data-sp-theme="..."> so the CSS-variable cascade reaches every
// owned surface. Invalid / missing values fall back to the default theme
// rather than leaving an empty attribute that would orphan the accent vars.
export function apply(name) {
    const theme = isValid(name) ? name : DEFAULT_THEME;
    const root = document.documentElement;
    if (root) root.setAttribute('data-sp-theme', theme);
}
