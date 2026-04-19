# SillyPhone Manual Test Checklist

Walk through this after installing into SillyTavern and before any release. Expected behavior in parens.

## Flow A — AI-initiated SMS

- [ ] `/sendas name={{char}} test<!--Phone:{"msgs":["a"]}-->` → (bubble in modal, badge++, toast)
- [ ] Multiple markers in one message → (concat into one burst)
- [ ] Malformed marker `<!--Phone:{"msgs":[broken}-->` → (silent ignore, console.warn, no crash)
- [ ] Swipe AI msg with marker → (no duplicate burst on phone)
- [ ] Regenerate AI msg with marker → (no duplicate burst)
- [ ] Marker mid-message → (still parsed, main chat text unaffected)

## Flow B — User-initiated SMS

- [ ] Open phone, send "hey" → (typing indicator, char bubbles play with delays)
- [ ] AI returns `{"msgs":["a"]}` → (parsed, one bubble)
- [ ] AI returns `{"msgs":["a","b","c"]}` → (3 bubbles w/ typing between)
- [ ] AI returns ```` ```json {"msgs":["a"]} ``` ```` → (fence stripped, parsed)
- [ ] AI returns plain prose → (retry once, then "…")
- [ ] Send while previous Flow B pending → (send button disabled, queued behavior)
- [ ] `/genraw` hang (disconnect network) → ("(message not delivered)" bubble)

## Chat switching / persistence

- [ ] Switch chat mid-modal → (modal closes, new chat's thread loads on reopen)
- [ ] Switch back → (original thread restored)
- [ ] Send SMS, reload browser → (thread persists via chat_metadata)

## Rolling memory (opt-in)

- [ ] Enable in settings (Every: 5, Keep: 5). Send 10+ main msgs → (summary generated, older msgs `/hide`'d)
- [ ] Summary visible in devtools: `chat_metadata.sillyphone.main_summary`
- [ ] Next main turn → (character response reflects summary context)
- [ ] Conflict warning shows if SillyTavern Summarize extension is active
- [ ] Disable rolling memory → (no new summaries generated; hidden msgs stay hidden)

## UI / mobile

- [ ] Viewport 375×667 → (modal fills screen)
- [ ] iOS/Android keyboard doesn't overlap bubbles
- [ ] `prefers-reduced-motion` → (no typing animation, bubbles instant)
- [ ] Esc key → (closes modal)
- [ ] Enter in input → (sends); Shift+Enter → (newline)
- [ ] Badge hidden when `showBadge = off`

## Settings

- [ ] Toggle Enabled off → (Flow A stops firing; badge can still be shown via toggle)
- [ ] Edit Flow A instructions → (next AI gen's context reflects change — verify in devtools)
- [ ] Edit Flow B template → (next phone gen uses new template — verify character card substitutions)
- [ ] Clear phone thread → (modal empties, badge → 0)
- [ ] Clear all phone data → (thread + summary both cleared)

## Failure modes

- [ ] Summary `/genraw` fails → (phone gen proceeds without summary, warning logged)
- [ ] `/hide` fails → (summary still stored, no crash)
- [ ] User manually `/unhide`'s summarized msgs → (not broken; mild context duplication acceptable)
- [ ] User deletes main chat msgs → (next rolling trigger detects shrinkage, recovers)
- [ ] Fresh character with no persona → (works; responses may be weak — expected)
- [ ] AI emits multiple markers in one response → (concat into one burst)

## Regression

- [ ] Disable SillyPhone entirely → (badge hidden, no event listeners fire, no prompt injections)
- [ ] Re-enable → (all UI + injections come back without reload)
