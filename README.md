# SillyPhone

Two-way SMS extension for SillyTavern. Characters can drop hidden SMS markers in their main-chat responses; users can open a full-screen phone modal to text the character independently of main chat. Messages can be paced like real texting — delay before typing, variable typing durations per bubble — so the model can simulate a realistic cadence.

## Install

```bash
cd /path/to/SillyTavern/public/scripts/extensions/third-party/
git clone https://github.com/envyk-dev/SillyPhone.git SillyPhone
```

Reload SillyTavern and enable SillyPhone in the Extensions panel.

## How it works

SillyPhone stores SMS bursts as **real chat messages** in SillyTavern's chat log, tagged via `extra.sillyphone = { from, msgs, ts, attachment? }`. Each burst is a real chat entry hidden from the main chat view (via CSS) but visible to the LLM in prompt context and to the user inside the phone modal.

- **Timeline is accurate.** A text exchange between RP beats appears in chat between those beats, not as a flat block at the end of the prompt.
- **Single source of truth.** Deleting a text in the phone modal cuts the chat message — no separate state to re-inject or rebuild.
- **One generation pipeline.** Flow A (in-scene marker) and Flow B (user texts from the phone UI) both go through normal `/trigger` generation with an extension-prompt mode switch; there's no bespoke Flow B prompt.

## How characters send SMS (Flow A)

Inside any main-chat response, the character appends a hidden marker:

```
<!--Phone:{"msgs":["hey","you up?"]}-->
```

The extension parses the marker, strips it from the host message, and inserts a tagged `[SMS]` chat message right after it. The character sees prior SMS as `[SMS]`-prefixed chat messages in context; default Flow A instructions guide the model on when to use the marker.

## How users send SMS (Flow B)

Click the floating phone badge (bottom-right). Type a message and hit send. The extension pushes a tagged user SMS into the chat, flips on an SMS-mode extension prompt at depth 0, and runs `/trigger`. The character replies via the marker, which SillyPhone converts to the next `[SMS]` chat row.

## Realistic cadence (per-bubble timing)

The marker accepts per-bubble `delay` and `typeDuration` (both in ms) for natural pacing:

```
<!--Phone:{"msgs":[
  {"text":"hey","delay":0,"typeDuration":400},
  {"text":"u free later?","delay":600,"typeDuration":1100},
  {"text":"...","delay":2200,"typeDuration":800}
]}-->
```

- `delay` — pause BEFORE typing starts for this bubble. Bigger values read as thinking, hesitation, or being busy.
- `typeDuration` — how long the typing indicator shows before the bubble appears. Roughly tracks message length but can vary.
- Plain strings (`"hey"`) still work and render with sensible defaults. Mix both forms freely.
- Timing is **live-only** — it animates once when the message first arrives, then persists as plain text. Reopening the modal shows the full thread instantly.

## Attachments

The marker supports an optional `attachment` field:

```
<!--Phone:{"attachment":{"kind":"image","description":"a selfie at the lake"},"msgs":["look!"]}-->
```

- `kind` is `"image"` or `"video"`.
- `description` is visible to the LLM (included in prompt context) but **never** shown to the user. The user only sees `[📷 image attachment]` / `[🎥 video attachment]`.
- An attachment may be sent alone (no `msgs`) or with messages. When both, the attachment appears above the bubbles.
- Users can send attachments from the phone UI via the `+` button left of the input.

Image uploads are not implemented yet. The data model reserves `attachment.image` for a future patch that will let users attach real image files to a burst.

## Memory model

- **Phone ↔ main RP:** SMS is in the chat, so the character sees every prior SMS exchange in normal chat context — no separate injection needed.
- **Main RP → phone:** Same. The model's view of Flow B is exactly the chat context it already has, plus a one-shot SMS-mode prompt.

## Rolling memory (optional)

Enable in Settings → SillyPhone to auto-summarize older main-chat messages and `/hide` them from the prompt. Triggers on `MESSAGE_RECEIVED` / `MESSAGE_SENT` when chat length crosses the configured threshold. Opt-in only — SillyTavern's own Summarize extension may conflict; pick one.

## SMS-only mode (optional)

By default, anything the character writes around a `<!--Phone:...-->` marker (scene prose, narration, etc.) survives in the main chat alongside the extracted SMS row. Toggle **SMS-only mode** in Settings to drop that prose: after marker extraction, the host row is cut entirely, leaving just the SMS bubble in the chat log. Useful for pure-texting RP where the main chat is the phone conversation and there's no scene to preserve. Empty host rows (e.g. when the model emits only a marker) are always cut, regardless of this setting.

## Settings

Open Extensions drawer → **SillyPhone** panel:

- Enabled / SMS-only mode / Show badge / Toast sound
- Rolling memory toggle + thresholds + custom summarization prompt
- Editable Flow A instructions
- Clear phone thread / Clear all phone data for current chat

Delete individual SMS bubbles or attachments from inside the phone modal via the menu (⋮) → **Delete messages**.

## Files

```
SillyPhone/
├── manifest.json
├── index.js                # entry + event wiring
├── style.css
├── README.md
├── LICENSE
├── src/
│   ├── marker.js           # parse/strip <!--Phone:{...}--> + timing + attachment
│   ├── chat-sms.js         # tagged-chat-message read/write/delete
│   ├── storage.js          # chat_metadata: unread + summary only
│   ├── prompt-builder.js   # Flow A instructions + summarization prompt
│   ├── context.js          # setExtensionPrompt: instructions, summary, SMS-mode
│   ├── settings.js         # extension_settings storage + migrations
│   ├── memory.js           # summary cache + rolling memory
│   ├── st.js               # SillyTavern API adapter
│   └── ui/
│       ├── badge.js
│       ├── toast.js
│       ├── bubbles.js
│       ├── playback.js     # sequential bubble reveal with typing indicator
│       ├── modal.js
│       └── settings-panel.js
└── tests/
    ├── marker.test.js          # node --test
    ├── chat-sms.test.js        # node --test
    └── prompt-builder.test.js  # node --test
```

## Running unit tests

```bash
cd SillyPhone
node --test tests/*.test.js
```

Only pure-logic modules have unit tests (marker parser, burst builder, prompt defaults). UI and SillyTavern integration are verified manually in-app.

## License

MIT. See [LICENSE](LICENSE).
