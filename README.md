# SillyPhone

Two-way SMS extension for SillyTavern. Characters can drop hidden SMS markers in their main-chat responses; users can open a full-screen phone modal to text the character independently of main chat.

## Install

```bash
cd /path/to/SillyTavern/public/scripts/extensions/third-party/
git clone <this-repo> SillyPhone
```

Reload SillyTavern and enable SillyPhone in the Extensions panel.

## How characters send SMS

Inside any main-chat response, the character appends a hidden marker:

```
<!--Phone:{"msgs":["hey","you up?"]}-->
```

The marker is invisible in main chat and the texts appear on the user's phone as SMS. The extension's default Flow A instructions are always injected into the character's context, so no manual persona edits are required (though you can tune the wording in Settings).

## How users send SMS

Click the floating phone badge (bottom-right). Type a message and hit send. A dedicated background generation runs just for the phone reply — cheaper and faster than firing a full main-chat turn — and the character texts back with burst bubbles + typing indicator.

## Memory model

- **Phone ↔ main RP:** The full SMS thread is always injected into main-chat context, so the character remembers what was texted.
- **Main RP → phone:** Phone-gen uses a recent-10 main-chat window + (optionally) an auto-summary of older messages, so the phone character remembers scene context even in long chats.

## Rolling memory (optional)

Enable in Settings → SillyPhone to auto-summarize older main-chat messages and `/hide` them from the prompt. The summary is shared with the phone-gen pipeline, so there's no duplicate summarization cost. Opt-in only — SillyTavern's own Summarize extension may conflict; pick one.

## Settings

Open Extensions drawer → **SillyPhone** panel:

- Enabled / Show badge / Toast sound
- Rolling memory toggle + thresholds + custom summarization prompt
- Editable Flow A instructions and Flow B prompt template
- Clear thread / Clear all phone data for current chat

## Files

```
SillyPhone/
├── manifest.json
├── index.js                # entry + event wiring
├── style.css
├── README.md
├── MANUAL-TESTS.md         # manual test checklist
├── src/
│   ├── marker.js           # parse/strip <!--Phone:{...}-->
│   ├── storage.js          # chat_metadata CRUD
│   ├── prompt-builder.js   # pure prompt builders
│   ├── context.js          # setExtensionPrompt management
│   ├── settings.js         # extension_settings storage
│   ├── memory.js           # summary cache + rolling memory
│   ├── phone-gen.js        # Flow B /genraw call
│   └── ui/
│       ├── badge.js
│       ├── toast.js
│       ├── bubbles.js
│       ├── playback.js
│       ├── modal.js
│       └── settings-panel.js
└── tests/
    ├── marker.test.js          # node --test
    └── prompt-builder.test.js  # node --test
```

## Running unit tests

```bash
cd SillyPhone
node --test tests/*.test.js
```

Only pure-logic modules have unit tests (marker parser, prompt builders). UI and SillyTavern integration are verified manually — see `MANUAL-TESTS.md`.

## Design spec

Living in the companion docs repo at `docs/superpowers/specs/2026-04-18-sillyphone-design.md` with the full architecture, AI contract, and rationale.
