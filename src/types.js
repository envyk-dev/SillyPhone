// Shared JSDoc typedefs. No runtime exports — import via:
//   /** @typedef {import('./types.js').Burst} Burst */
// Editors with TypeScript-server (VS Code built-in) surface these inline;
// Node ignores the annotations at runtime.

/**
 * Attachment payload carried by an SMS burst. `kind` drives icon + label;
 * `description` is visible to the LLM (prompt context) but not to the user;
 * `image` is a relative URL path (e.g. "user/images/Alice/sp_k2m8x.jpg")
 * to an uploaded file when the user picked one, null otherwise. Only image-
 * kind attachments ever carry a real path — video is description-only.
 * @typedef {{ kind: 'image' | 'video', description: string, image: string | null }} Attachment
 */

/**
 * Normalized burst as exposed by chat-sms.listBursts(). The in-chat tag
 * (chat[idx].extra.sillyphone) is structurally similar but omits chatIdx.
 * @typedef {Object} Burst
 * @property {number} chatIdx       Index into ctx().chat where this burst lives.
 * @property {'user' | 'char'} from Sender identity.
 * @property {string[]} msgs        Individual bubbles in speaking order.
 * @property {number} ts            Epoch ms when the burst was committed.
 * @property {Attachment} [attachment]
 */

/**
 * Per-bubble timing metadata parsed from the marker's object-form bubbles.
 * @typedef {Object} BubbleTiming
 * @property {number} [delay]         ms pause before typing starts.
 * @property {number} [typeDuration]  ms the typing indicator shows.
 */

/**
 * Output of marker.parse().
 * @typedef {Object} MarkerParseResult
 * @property {string[]} msgs
 * @property {Attachment} [attachment]
 * @property {BubbleTiming[]} [timing]
 */

/**
 * Minimal chat-message shape used internally. The live ST object carries
 * additional fields (swipes, mes_id, etc.) that SillyPhone does not inspect.
 * @typedef {Object} ChatMessage
 * @property {string} name
 * @property {boolean} is_user
 * @property {boolean} [is_system]
 * @property {number} [send_date]
 * @property {string} [mes]
 * @property {{ sillyphone?: { from: 'user'|'char', msgs: string[], ts: number, attachment?: Attachment } } & Record<string, any>} [extra]
 * @property {number} [swipe_id]
 */

/**
 * Rolling-memory sub-config persisted inside SillyPhoneSettings.
 * @typedef {Object} RollingMemorySettings
 * @property {boolean} enabled
 * @property {number} every
 * @property {number} keepRecent
 * @property {string} summarizationPrompt
 */

/**
 * Full settings blob stored at ctx().extensionSettings.sillyphone.
 * @typedef {Object} SillyPhoneSettings
 * @property {number} version
 * @property {boolean} enabled
 * @property {boolean} smsOnly
 * @property {boolean} showBadge
 * @property {boolean} showSmsRows
 * @property {boolean} toastSound
 * @property {boolean} forcefulChatInject
 * @property {RollingMemorySettings} rollingMemory
 * @property {string} flowAInstructions
 */

export {};
