// Pure functions that build prompts for Flow B, summarization, and SMS log injection.

export const DEFAULT_FLOW_A_INSTRUCTIONS = `You may optionally send the user a text message by appending a single hidden marker to the end of your response:
<!--Phone:{"msgs":["text1","text2"]}-->
The marker is invisible in chat and appears on the user's phone as SMS.
Use it sparingly — for later-beats, asides, urgent pings, or flirty check-ins. Don't force it.
If the user has texted you (see "Phone conversation log" in context), you may reply via the marker, ignore it in-character, or address it through normal dialogue.`;

export const DEFAULT_FLOW_B_TEMPLATE = `You are {{char}} replying to a text message from {{user}}.
Write as a casual SMS — short, possibly multiple messages, matching {{char}}'s voice.
Output ONLY valid JSON: {"msgs":["text1","text2"]}
No markers, no prose, no code fences. 1-3 messages typical.
Current scene context is provided above; react naturally.`;

export const DEFAULT_SUMMARIZATION_PROMPT = `Summarize the following roleplay in 3-5 sentences. Focus on facts, decisions, emotional state, and ongoing threads.`;

function fmtTime(ts) {
    try {
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    } catch {
        return '??:??';
    }
}

export function formatSmsLog(thread) {
    if (!thread || thread.length === 0) return '';
    const lines = ['Phone conversation log:'];
    for (const entry of thread) {
        const who = entry.from === 'user' ? 'User' : 'Char';
        for (const m of entry.msgs) {
            lines.push(`[${fmtTime(entry.ts)}] ${who}: ${m}`);
        }
    }
    return lines.join('\n');
}

export function buildPhonePrompt({ charName, charCard, summary, recentMainMsgs, smsThread, userMsg, template }) {
    const tpl = (template || DEFAULT_FLOW_B_TEMPLATE)
        .replaceAll('{{char}}', charName || 'the character')
        .replaceAll('{{user}}', 'the user');

    const parts = [];
    parts.push(`# Character`);
    parts.push(charCard || '(no character card)');

    if (summary) {
        parts.push(`\n# Scene summary (earlier RP)`);
        parts.push(summary);
    }

    if (recentMainMsgs && recentMainMsgs.length) {
        parts.push(`\n# Recent RP (verbatim)`);
        parts.push(recentMainMsgs.join('\n'));
    }

    if (smsThread && smsThread.length) {
        parts.push(`\n# ${formatSmsLog(smsThread)}`);
    }

    parts.push(`\n# New text from user`);
    parts.push(userMsg || '');

    parts.push(`\n# Task`);
    parts.push(tpl);

    return parts.join('\n');
}

export function buildSummarizationPrompt(messages, customPrompt) {
    const instruction = customPrompt || DEFAULT_SUMMARIZATION_PROMPT;
    const body = messages.map((m, i) => `[${i}] ${m.name}: ${m.mes}`).join('\n');
    return `${instruction}\n\n---\n${body}\n---\nSummary:`;
}
