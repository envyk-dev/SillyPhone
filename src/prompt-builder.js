// Prompt templates. With the SMS-as-chat-messages rearchitecture, there is no
// hand-built Flow B prompt — Flow B uses normal /trigger with an extension-
// prompt mode switch. Only the Flow A instructions and the summarization
// prompt live here now.

export const DEFAULT_FLOW_A_INSTRUCTIONS = `# Phone / SMS system (SillyPhone extension)

You can send the user a text message by appending ONE hidden marker at the very end of your response:
<!--Phone:{"msgs":["text1","text2"]}-->

You may also attach an image or video to the same marker. The attachment is described in words — the user sees a placeholder ([📷 image attachment] or [🎥 video attachment]), the description is for your context awareness only:
<!--Phone:{"attachment":{"kind":"image","description":"a photo of {{char}} holding up a coffee mug, slightly out of focus"},"msgs":["morning"]}-->

You may also control each bubble's timing for a realistic texting cadence. Instead of a plain string, pass an object per bubble with optional delay and typeDuration (both in milliseconds):
<!--Phone:{"msgs":[{"text":"hey","delay":0,"typeDuration":400},{"text":"u free later?","delay":600,"typeDuration":1100}]}-->
- delay: pause BEFORE typing starts for this bubble. Bigger values simulate thinking, hesitation, or {{char}} being busy. For the first bubble, this is the gap after the user's last message.
- typeDuration: how long the typing indicator shows before the bubble appears. Roughly proportional to message length, but vary it — a short message can take a moment if {{char}} is choosing words; a long one can land fast if {{char}} is rapid-fire or upset.
- Realistic numbers: typeDuration 500–3000ms feels human (sub-200ms is robotic); delay 0–800ms is rapid-fire, 1500–4000ms is reflective, 5000+ reads as busy or hesitant. Vary within a single burst — don't make every bubble the same cadence.
- Plain strings still work ("hey") for instant defaults. Mix both forms freely. Use timing when the moment calls for pacing; omit it when cadence doesn't matter.

Example exchange (illustrative only — the names are placeholders, not real characters):

Prior [SMS] from the user (already in the chat):
[SMS]
- hey u up
- i cant sleep lol

A natural reply would look like:
<!--Phone:{"msgs":[{"text":"yeah same","delay":1400,"typeDuration":900},{"text":"wats keeping u up","delay":500,"typeDuration":1300},{"text":"everything ok?","delay":2200,"typeDuration":1100}]}-->

Notice: the first bubble has a short lead-in (picking up the phone), the second fires quickly after (rapid-fire follow-up), the third has a longer pause before typing (a moment of concern before asking). Messages are short, lowercase, a little sloppy — like real texting. The typing durations roughly track message length but aren't mechanical.

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
