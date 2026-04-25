// Extension prompts owned by SillyPhone:
// - instructions (Flow A rules)
// - summary (rolling memory)
// - sms-mode (one-shot "reply via marker only" for Flow B)
// - marker-examples (recent char bursts re-emitted as markers, depth 0,
//   counters in-context [SMS]-format priming that drives format drift)
import { setExtensionPrompt, ctx, EXTENSION_PROMPT, EXTENSION_PROMPT_ROLE } from './st.js';
import * as storage from './storage.js';
import * as settings from './settings.js';

const KEY_INSTRUCTIONS = 'sillyphone_instructions';
const KEY_SUMMARY = 'sillyphone_summary';
const KEY_SMS_MODE = 'sillyphone_sms_mode';
const KEY_MARKER_EXAMPLES = 'sillyphone_marker_examples';

const MARKER_EXAMPLES_LOOKBACK = 2;

const SMS_MODE_TEXT = `The most recent user message is an [SMS] text from the user to {{char}}. Your ENTIRE response must be a single <!--Phone:{...}--> marker. Nothing before it. Nothing after it.

Format:
<!--Phone:{"msgs":["reply1","reply2"]}-->

Guidelines:
- 1-3 short messages in {{char}}'s texting voice. Derive the style from {{char}}'s character card and prior dialogue — capitalization, punctuation, spelling, emoji use, and burst rhythm vary by character. A 19-year-old art student texts nothing like a 50-year-old professor. Stay consistent with how {{char}} has texted earlier in this chat.
- If {{char}}'s texting style isn't explicitly established, infer what's plausible for this character (age, profession, formality, current emotional state) and lock it in — don't default to generic lowercase-chatspeak. When genuinely in doubt, err neutral: sentence case, light punctuation, no abbreviations.
- Never repeat a line already present in an [SMS] chat message above.
- Do NOT describe {{char}}'s actions, expressions, feelings, or surroundings in this turn. Do NOT write "*she smiles*", "She pauses and types:", or anything that isn't literally the text of the reply. This turn is a text message — save narration for normal RP turns.

Optional attachment (may replace or combine with msgs):
<!--Phone:{"attachment":{"kind":"image","description":"specific sensory description"},"msgs":["optional caption"]}-->
- kind: "image" or "video".
- description: specific, what's actually in the frame. The user sees only a generic placeholder; the description gives YOU context awareness.

Optional per-bubble timing (for a realistic texting cadence):
<!--Phone:{"msgs":[{"text":"yeah","delay":800,"typeDuration":500},{"text":"omw rn give me like 10","delay":1400,"typeDuration":1800}]}-->
- delay (ms): pause BEFORE typing starts for this bubble. Use bigger values to simulate thinking, hesitation, or {{char}} being busy/distracted. First bubble's delay is the gap after the user's last message.
- typeDuration (ms): how long the typing indicator shows before the bubble appears. Roughly proportional to message length, but vary it — a short message can take a moment if {{char}} is choosing their words, a long one can land fast if {{char}} is rapid-fire or upset.
- Realistic numbers: typeDuration 500–3000ms feels human (sub-200ms is robotic); delay 0–800ms is rapid-fire, 1500–4000ms is reflective, 5000+ reads as busy or hesitant. Vary within a single burst — don't make every bubble the same cadence.
- Plain strings still work ("yeah") for instant defaults. Mix both forms freely. Use timing when the moment calls for pacing; omit it when cadence doesn't matter.

GOOD examples:
<!--Phone:{"msgs":["yeah omw","give me 10"]}-->
<!--Phone:{"msgs":[{"text":"hey","delay":0,"typeDuration":400},{"text":"u free later?","delay":600,"typeDuration":1100}]}-->
<!--Phone:{"msgs":[{"text":"...","delay":2200,"typeDuration":800},{"text":"i dont know what to say","delay":1800,"typeDuration":2400}]}-->
<!--Phone:{"attachment":{"kind":"image","description":"a messy desk with a laptop open to a Figma file and a half-drunk coffee"},"msgs":["look at this mess lol"]}-->

BAD (never do these):
She picks up her phone and smiles. <!--Phone:{"msgs":["haha"]}-->      ← prose before the marker
<!--Phone:{"msgs":["haha"]}--> *types back quickly*                    ← anything after the marker
She types: > hey > u there?                                           ← writing messages as prose instead of in the marker`;

export function updateInstructionsPrompt() {
    const enabled = settings.get('enabled');
    const text = enabled ? (settings.get('flowAInstructions') || '') : '';
    const forceful = !!settings.get('forcefulChatInject');
    const depth = forceful ? 0 : 1;
    const role = forceful ? EXTENSION_PROMPT_ROLE.USER : EXTENSION_PROMPT_ROLE.SYSTEM;
    setExtensionPrompt(KEY_INSTRUCTIONS, text, EXTENSION_PROMPT.IN_CHAT, depth, role);
}

export function updateSummaryPrompt() {
    const rolling = settings.get('rollingMemory');
    const summary = storage.getSummary();
    const text = (rolling?.enabled && summary?.text)
        ? `Main chat summary (older messages):\n${summary.text}`
        : '';
    setExtensionPrompt(KEY_SUMMARY, text, EXTENSION_PROMPT.IN_CHAT, 4, EXTENSION_PROMPT_ROLE.SYSTEM);
}

export function setSmsMode(on) {
    const forceful = !!settings.get('forcefulChatInject');
    const role = forceful ? EXTENSION_PROMPT_ROLE.USER : EXTENSION_PROMPT_ROLE.SYSTEM;
    setExtensionPrompt(
        KEY_SMS_MODE,
        on ? SMS_MODE_TEXT : '',
        EXTENSION_PROMPT.IN_CHAT,
        0,
        role,
    );
}

// Re-emit the most recent char-side bursts as <!--Phone:{...}--> markers at
// depth 0. The chat history shows every prior burst as `[SMS]\n- ...` (the
// display form) and never as a marker — markers were stripped from host rows
// before storage. With many [SMS] examples and zero marker examples in the
// model's context, format drift toward bare [SMS] output is almost
// inevitable in long chats. This injection counters that by putting fresh
// marker examples right before generation.
export function updateMarkerExamplesPrompt() {
    if (!settings.get('enabled') || !settings.get('markerExamples')) {
        setExtensionPrompt(KEY_MARKER_EXAMPLES, '', EXTENSION_PROMPT.IN_CHAT, 0, EXTENSION_PROMPT_ROLE.SYSTEM);
        return;
    }
    let chat;
    try { chat = ctx().chat; }
    catch { chat = null; }
    if (!Array.isArray(chat)) {
        setExtensionPrompt(KEY_MARKER_EXAMPLES, '', EXTENSION_PROMPT.IN_CHAT, 0, EXTENSION_PROMPT_ROLE.SYSTEM);
        return;
    }
    const recent = [];
    for (let i = chat.length - 1; i >= 0 && recent.length < MARKER_EXAMPLES_LOOKBACK; i--) {
        const tag = chat[i]?.extra?.sillyphone;
        if (tag?.from === 'char' && Array.isArray(tag.msgs)) recent.unshift(tag);
    }
    if (recent.length === 0) {
        setExtensionPrompt(KEY_MARKER_EXAMPLES, '', EXTENSION_PROMPT.IN_CHAT, 0, EXTENSION_PROMPT_ROLE.SYSTEM);
        return;
    }
    const markers = recent.map(tag => {
        const obj = { msgs: tag.msgs };
        if (tag.attachment) {
            obj.attachment = { kind: tag.attachment.kind, description: tag.attachment.description };
        }
        return `<!--Phone:${JSON.stringify(obj)}-->`;
    }).join('\n');
    const text = `Format reminder: your recent SMS sends used these markers (the [SMS] blocks in chat history are how the same content displays — already-delivered, not a template). When you next send SMS, use the marker form, NOT a bare [SMS] block:\n${markers}`;
    setExtensionPrompt(KEY_MARKER_EXAMPLES, text, EXTENSION_PROMPT.IN_CHAT, 0, EXTENSION_PROMPT_ROLE.SYSTEM);
}

export function updateAll() {
    updateInstructionsPrompt();
    updateSummaryPrompt();
    updateMarkerExamplesPrompt();
    setSmsMode(false);
}
