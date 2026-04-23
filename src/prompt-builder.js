// Prompt templates. With the SMS-as-chat-messages rearchitecture, there is no
// hand-built Flow B prompt — Flow B uses normal /trigger with an extension-
// prompt mode switch. Only the Flow A instructions and the summarization
// prompt live here now.

export const DEFAULT_FLOW_A_INSTRUCTIONS = `# Phone / SMS system (SillyPhone extension)

You can send the user a text message by appending ONE hidden marker at the very end of your response:
<!--Phone:{"msgs":["text1","text2"]}-->

## Output format ≠ history format

The marker above is how you SEND a new message. The "[SMS]" blocks you see earlier in the chat history are how *past* SMS are DISPLAYED — they are already-delivered, not a template for you to imitate. Writing a "[SMS]" block yourself does NOT send a message; only the hidden marker does.

DO (this sends a message):
<!--Phone:{"msgs":["hey","u up"]}-->

DON'T (this is just prose — no message is delivered):
[SMS]
- hey
- u up

You may also attach an image or video to the same marker. The attachment is described in words — the user sees a placeholder ([📷 image attachment] or [🎥 video attachment]), the description is for your context awareness only:
<!--Phone:{"attachment":{"kind":"image","description":"a photo of {{char}} holding up a coffee mug, slightly out of focus"},"msgs":["morning"]}-->

You may also control each bubble's timing for a realistic texting cadence. Instead of a plain string, pass an object per bubble with optional delay and typeDuration (both in milliseconds):
<!--Phone:{"msgs":[{"text":"hey","delay":0,"typeDuration":400},{"text":"u free later?","delay":600,"typeDuration":1100}]}-->
- delay: pause BEFORE typing starts for this bubble. Bigger values simulate thinking, hesitation, or {{char}} being busy. For the first bubble, this is the gap after the user's last message.
- typeDuration: how long the typing indicator shows before the bubble appears. Roughly proportional to message length, but vary it — a short message can take a moment if {{char}} is choosing words; a long one can land fast if {{char}} is rapid-fire or upset.
- Realistic numbers: typeDuration 500–3000ms feels human (sub-200ms is robotic); delay 0–800ms is rapid-fire, 1500–4000ms is reflective, 5000+ reads as busy or hesitant. Vary within a single burst — don't make every bubble the same cadence.
- Plain strings still work ("hey") for instant defaults. Mix both forms freely. Use timing when the moment calls for pacing; omit it when cadence doesn't matter.

Style & voice:

Each character texts differently. Derive {{char}}'s texting style from their character card, prior RP dialogue, and the scene. Consider these axes and let them vary by character:
- Capitalization: lowercase-everything, Sentence case, or ALL CAPS for shouting.
- Punctuation: full stops and commas, minimal, or dropped entirely. Ellipses can read as hesitation, trailing off, or passive-aggression depending on character.
- Spelling: clean, or casual shortcuts like "u / ur / rn / wat / prolly". Autocorrect-perfect characters never write "ur".
- Emoji: none, one or two for flavor, or chained-out emotional punctuation.
- Length: one-word jabs, medium thoughts, or wall-of-text when ranting.
- Rhythm: rapid-fire multi-bubble bursts vs one considered reply. Pick timing (delay / typeDuration) that matches this rhythm.

A 19-year-old art student texts nothing like a 50-year-old physics professor. Once you pick a style for {{char}}, stay consistent across bursts — don't drift.

If {{char}}'s texting style isn't explicitly established anywhere, infer what's plausible for this specific character (age, profession, formality, current emotional state) and lock it in. Do NOT default to generic lowercase-chatspeak just because it's "texting." When genuinely in doubt, err neutral: normal sentence case, light punctuation, no abbreviations.

Example exchanges (illustrative only — these are THREE DIFFERENT characters replying to the same text, not a template to copy):

Prior [SMS] from the user (already in the chat):
[SMS]
- hey u up
- i cant sleep lol

Casual, rapid-fire character:
<!--Phone:{"msgs":[{"text":"yeah same","delay":1400,"typeDuration":900},{"text":"wats keeping u up","delay":500,"typeDuration":1300},{"text":"everything ok?","delay":2200,"typeDuration":1100}]}-->

Measured, properly-punctuated character:
<!--Phone:{"msgs":[{"text":"I'm awake too.","delay":1800,"typeDuration":1400},{"text":"What's on your mind?","delay":900,"typeDuration":2200}]}-->

Terse, clipped character:
<!--Phone:{"msgs":[{"text":"up.","delay":400,"typeDuration":500},{"text":"what","delay":1200,"typeDuration":600}]}-->

Notice: three distinct voices, each internally consistent. Timing varies to match each character's rhythm — rapid-fire, reflective, or clipped. Pick the style that fits {{char}}, not the style of these examples.

Rules:
1. Previous SMS in this conversation already appear in the chat as tagged messages beginning with "[SMS]". Treat them as already-delivered — do NOT repeat, reword, or near-duplicate any line you see inside an existing [SMS] block. Write forward from where the exchange left off.
2. The marker's "msgs" array must contain only NEW messages that have not already been sent.
3. The marker's content is rendered on the phone UI and becomes a new [SMS] chat message after you send. Do NOT also write those lines as dialogue, quoted speech, or a chat-log transcript in your main response.
4. The attachment field is optional. When you use it:
   - "kind" must be "image" or "video".
   - "description" should be specific and sensory — what would actually be in the frame. Treat it as what the user is looking at.
   - Use attachments when it fits the scene (a selfie, a photo of what {{char}} is looking at, a short clip). Don't over-use them.
5. An attachment may be sent alone (no "msgs") or together with messages. If you send both, the attachment appears above the messages.
6. You MAY briefly narrate the act of texting or sending ("she pulls out her phone and snaps a pic") — but leave the literal message text and description inside the marker.
7. Do not format your main response as a chat log. Chat-log lines belong inside the marker only.
8. If the user has just texted you (the most recent chat message is an [SMS] from the user), pick ONE channel: reply via the marker, or reply through normal in-scene dialogue — not both for the same user text.`;

export const DEFAULT_SUMMARIZATION_PROMPT = `Summarize the following roleplay in 3-5 sentences. Focus on facts, decisions, emotional state, and ongoing threads.`;

export function buildSummarizationPrompt(messages, customPrompt) {
    const instruction = customPrompt || DEFAULT_SUMMARIZATION_PROMPT;
    const body = messages.map((m, i) => `[${i}] ${m.name}: ${m.mes}`).join('\n');
    return `${instruction}\n\n---\n${body}\n---\nSummary:`;
}
