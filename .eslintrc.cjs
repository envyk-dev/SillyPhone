// Standalone ESLint config for SillyPhone. When developing inside a
// SillyTavern checkout, ST's root .eslintrc.cjs already covers these files
// via its public/**/*.js override. This config exists so the standalone
// repo (cloned outside ST) can still be linted via `npm run lint`. Style
// rules mirror ST's so the source stays consistent across both contexts.
module.exports = {
    root: true,
    extends: ['eslint:recommended'],
    env: {
        es2022: true,
        browser: true,
        jquery: true,
        node: true,
    },
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    globals: {
        SillyTavern: 'readonly',
        toastr: 'readonly',
    },
    ignorePatterns: ['node_modules/**', '.git/**'],
    rules: {
        'no-unused-vars': ['error', { args: 'none' }],
        'no-constant-condition': ['error', { checkLoops: false }],
        'no-cond-assign': 'error',
        'no-unneeded-ternary': 'error',
        'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
        'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
        'no-await-in-loop': 'warn',
        'quotes': ['error', 'single', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'indent': ['error', 4, { SwitchCase: 1, FunctionDeclaration: { parameters: 'first' } }],
        'comma-dangle': ['error', 'always-multiline'],
        'eol-last': ['error', 'always'],
        'no-trailing-spaces': 'error',
        'object-curly-spacing': ['error', 'always'],
        'space-infix-ops': 'error',
        'brace-style': ['error', '1tbs', { allowSingleLine: true }],
        'array-bracket-spacing': ['error', 'never'],
        'computed-property-spacing': ['error', 'never'],
        'block-spacing': ['error', 'always'],
        'keyword-spacing': ['error', { before: true, after: true }],
        'space-before-blocks': ['error', 'always'],
        'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
        'space-in-parens': ['error', 'never'],
        'comma-spacing': ['error', { before: false, after: true }],
        'key-spacing': ['error', { beforeColon: false, afterColon: true }],
        'func-call-spacing': ['error', 'never'],
        'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1, maxBOF: 0 }],
        'padded-blocks': ['error', 'never'],
        'no-whitespace-before-property': 'error',
        'space-unary-ops': ['error', { words: true, nonwords: false }],
        'arrow-spacing': ['error', { before: true, after: true }],
        'template-curly-spacing': ['error', 'never'],
        'rest-spread-spacing': ['error', 'never'],
        'switch-colon-spacing': ['error', { after: true, before: false }],
        'dot-notation': ['error', { allowPattern: '[A-Z]\\w*$' }],
    },
    overrides: [
        {
            files: ['tests/**/*.js'],
            env: {
                node: true,
            },
        },
    ],
};
