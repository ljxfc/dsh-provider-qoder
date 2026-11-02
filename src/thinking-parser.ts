/**
 * Fallback reasoning extraction: when the Qoder gateway folds thinking into
 * the visible text channel as marker tags (`<thinking>` / `</thinking>`, and
 * the unprefixed `" thinking"` / `" response"` pair, …), this module splits each
 * content chunk into reasoning and visible-text pieces. The native
 * `delta.reasoning_content` channel is preferred; this only runs when that
 * channel is absent.
 *
 * The split is **stateful** on purpose. A streamed answer arrives in arbitrary
 * slices, so an opening tag can be split across two chunks (`<think` + `ing>`)
 * and a closing tag can land in a later chunk than its opening one. A stateless
 * per-chunk split would then either leak the raw tag into the answer or lose
 * track of whether the text is thinking or visible, so the state lives here
 * across the whole stream and a trailing partial tag is held back until the
 * next chunk can finish it.
 *
 * @module dsh-llm-qoder/thinking-parser
 */

const THINKING_TAG_VARIANTS: Array<{ open: string; close: string }> = [
  { open: '<thinking>', close: '</thinking>' },
  { open: ' thinking', close: ' response' },
  { open: '<reasoning>', close: '</reasoning>' },
  { open: '<thought>', close: '</thought>' },
]

/** One split piece of a content chunk. */
export interface ThinkingPiece {
  kind: 'reasoning' | 'text'
  text: string
}

/**
 * Incremental reasoning-tag splitter. One instance follows one stream: feed it
 * every content delta in arrival order and it keeps the open/close state and
 * any half-received tag between calls.
 */
export interface ThinkingSplitter {
  /**
   * Consume one content delta.
   * @param chunk - the next streamed delta.
   * @returns the text/reasoning pieces that are now unambiguous, in order.
   */
  push(chunk: string): ThinkingPiece[]
  /**
   * Emit whatever the stream left unfinished (a held partial tag, or the tail
   * of an unterminated block) as a piece of the current mode.
   * @returns the trailing pieces, in order.
   */
  flush(): ThinkingPiece[]
}

/** The tags that open a reasoning block. */
const OPEN_TAGS = THINKING_TAG_VARIANTS.map(variant => variant.open)
/** The tags that close a reasoning block. */
const CLOSE_TAGS = THINKING_TAG_VARIANTS.map(variant => variant.close)
/** Longest tag length, so the tail check never has to slice more than that. */
const MAX_TAG_LENGTH = Math.max(...OPEN_TAGS.map(tag => tag.length), ...CLOSE_TAGS.map(tag => tag.length))

/** The tags that would open or close the current mode. */
function tagsFor(kind: ThinkingPiece['kind']): readonly string[] {
  return kind === 'text' ? OPEN_TAGS : CLOSE_TAGS
}

/** Whether `rest` (the unconsumed tail) could still grow into a tag of this mode. */
function isPartialTag(rest: string, kind: ThinkingPiece['kind']): boolean {
  return tagsFor(kind).some(tag => tag.length > rest.length && tag.startsWith(rest))
}

/**
 * Create a splitter that carries its reasoning-tag state across chunks.
 * @returns a fresh stateful splitter.
 */
export function createThinkingSplitter(): ThinkingSplitter {
  let kind: ThinkingPiece['kind'] = 'text'
  let held = ''

  const piecesOf = (text: string): ThinkingPiece[] => (text.length === 0 ? [] : [{ kind, text }])

  const push = (chunk: string): ThinkingPiece[] => {
    const input = held + chunk
    held = ''
    const pieces: ThinkingPiece[] = []
    let buffer = ''
    let cursor = 0
    const flush = (): void => {
      pieces.push(...piecesOf(buffer))
      buffer = ''
    }

    while (cursor < input.length) {
      const matched = tagsFor(kind).find(tag => input.startsWith(tag, cursor))
      if (matched !== undefined) {
        flush()
        kind = kind === 'text' ? 'reasoning' : 'text'
        cursor += matched.length
        continue
      }
      // A trailing fragment that may still become a tag is held back whole: the
      // next chunk decides whether it was a tag or ordinary text. Only a tail
      // shorter than the longest tag can be one, so the slice stays tiny.
      if (input.length - cursor < MAX_TAG_LENGTH) {
        const rest = input.slice(cursor)
        if (isPartialTag(rest, kind)) {
          held = rest
          break
        }
      }
      buffer += input.charAt(cursor)
      cursor += 1
    }
    flush()
    return pieces
  }

  return {
    push,
    flush: () => {
      const pieces = piecesOf(held)
      held = ''
      return pieces
    },
  }
}
