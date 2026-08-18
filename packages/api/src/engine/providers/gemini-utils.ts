/**
 * Pure converters for the Gemini provider — message conversion, tool schema
 * sanitization, and response parsing. Lives separately from the provider
 * class so it can be unit-tested without SDK mocks.
 */

import {
  createLLMResponse,
  type ChatMessage,
  type LLMResponse,
  type ToolCallRequest,
  type ToolDefinition,
} from '@clawix/shared';

const ALLOWED_FORMATS = new Set(['enum', 'date-time']);

const ALLOWED_KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'items',
  'enum',
  'description',
  'nullable',
  'minItems',
  'maxItems',
  'minProperties',
  'maxProperties',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'anyOf',
]);

/**
 * Recursively strip JSON Schema keywords that Gemini's validator rejects.
 *
 * Keep: type, properties, required, items, enum, description, nullable,
 *       minItems/maxItems, minProperties/maxProperties, minimum/maximum,
 *       minLength/maxLength, anyOf, format (when in ALLOWED_FORMATS).
 * Drop: additionalProperties, patternProperties, $schema, $id, $ref,
 *       definitions, default, examples, const, format (other values).
 *
 * Returns a new object — never mutates the input.
 */
export function sanitizeJsonSchemaForGemini(
  schema: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'format' && typeof value === 'string' && ALLOWED_FORMATS.has(value)) {
      result['format'] = value;
      continue;
    }

    if (!ALLOWED_KEYWORDS.has(key)) {
      continue;
    }

    if (key === 'properties' && value !== null && typeof value === 'object') {
      const sanitizedProps: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(value as Record<string, unknown>)) {
        if (propSchema !== null && typeof propSchema === 'object') {
          sanitizedProps[propName] = sanitizeJsonSchemaForGemini(
            propSchema as Record<string, unknown>,
          );
        } else {
          sanitizedProps[propName] = propSchema;
        }
      }
      result['properties'] = sanitizedProps;
      continue;
    }

    if (key === 'items' && value !== null && typeof value === 'object') {
      result['items'] = sanitizeJsonSchemaForGemini(value as Record<string, unknown>);
      continue;
    }

    if (key === 'anyOf' && Array.isArray(value)) {
      result['anyOf'] = value.map((sub) =>
        sub !== null && typeof sub === 'object'
          ? sanitizeJsonSchemaForGemini(sub as Record<string, unknown>)
          : sub,
      );
      continue;
    }

    result[key] = value;
  }

  return result;
}

/**
 * Convert Clawix `ToolDefinition[]` to Gemini's tool envelope.
 *
 * Wraps function declarations in `[{ functionDeclarations: [...] }]` and
 * runs each input schema through the sanitizer.
 */
export function toGeminiTools(tools: readonly ToolDefinition[]): unknown[] {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: sanitizeJsonSchemaForGemini(t.inputSchema),
      })),
    },
  ];
}

/** Result of converting a ChatMessage[] for Gemini's generateContent call. */
export interface GeminiRequest {
  readonly systemInstruction?: string;
  readonly contents: readonly unknown[];
}

/**
 * Convert Clawix `ChatMessage[]` to Gemini's request shape.
 *
 * - `role: 'system'` → joined and returned as `systemInstruction`
 * - `role: 'user'` → `{ role: 'user', parts: [{ text }] }`
 * - `role: 'assistant'` (text only) → `{ role: 'model', parts: [{ text }] }`
 * - `role: 'assistant'` with `toolCalls` → `{ role: 'model', parts: [...functionCalls] }`
 *   (added in a later task)
 * - `role: 'tool'` → `{ role: 'user', parts: [{ functionResponse }] }`
 *   (added in a later task)
 */
export function toGeminiRequest(messages: readonly ChatMessage[]): GeminiRequest {
  const systemParts: string[] = [];
  const contents: unknown[] = [];
  const toolCallNames = new Map<string, string>();

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
      continue;
    }

    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
      continue;
    }

    if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const parts: unknown[] = [];
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          toolCallNames.set(tc.id, tc.name);
          const sig = (tc.providerExtra as { google?: { thoughtSignature?: string } } | undefined)
            ?.google?.thoughtSignature;
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.arguments,
              ...(sig ? { thoughtSignature: sig } : {}),
            },
          });
        }
        contents.push({ role: 'model', parts });
      } else {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
      continue;
    }

    if (msg.role === 'tool') {
      const name = toolCallNames.get(msg.toolCallId ?? '') ?? '';
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name,
              response: { result: msg.content },
            },
          },
        ],
      });
      continue;
    }
  }

  return {
    ...(systemParts.length > 0 ? { systemInstruction: systemParts.join('\n\n') } : {}),
    contents,
  };
}

interface GeminiPart {
  readonly text?: string;
  readonly thought?: boolean;
  readonly functionCall?: {
    readonly name: string;
    readonly args?: Record<string, unknown>;
    readonly thoughtSignature?: string;
  };
}

interface GeminiCandidate {
  readonly content?: { readonly parts?: readonly GeminiPart[] };
  readonly finishReason?: string;
}

interface GeminiResponseShape {
  readonly candidates?: readonly GeminiCandidate[];
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
  };
}

function mapGeminiFinishReason(
  reason: string | undefined,
  hasFunctionCall: boolean,
): 'stop' | 'tool_use' | 'max_tokens' | 'error' {
  if (hasFunctionCall) {
    return 'tool_use';
  }
  switch (reason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'max_tokens';
    default:
      return 'error';
  }
}

function shortRandomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function extractToolCall(part: GeminiPart, index: number): ToolCallRequest | null {
  if (!part.functionCall) {
    return null;
  }
  const sig = part.functionCall.thoughtSignature;
  return {
    id: `gemini-call-${index}-${shortRandomId()}`,
    name: part.functionCall.name,
    arguments: part.functionCall.args ?? {},
    ...(sig ? { providerExtra: { google: { thoughtSignature: sig } } } : {}),
  };
}

/**
 * Convert a Gemini SDK `GenerateContentResponse` to a normalized {@link LLMResponse}.
 *
 * - Concatenates text parts where `thought !== true` into `content` (null if empty)
 * - Tool calls extracted from `functionCall` parts, with per-call thought signatures captured
 * - Maps `finishReason`: STOP→stop, MAX_TOKENS→max_tokens, presence of any
 *   functionCall→tool_use, anything else→error
 * - Reads usage from `usageMetadata`; defaults to zero if missing
 * - `thinkingBlocks` is null (we are not surfacing Gemini reasoning text in this PR)
 */
export function parseGeminiResponse(resp: GeminiResponseShape): LLMResponse {
  const candidate = resp.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  const textParts = parts
    .filter(
      (p): p is GeminiPart & { text: string } => typeof p.text === 'string' && p.thought !== true,
    )
    .map((p) => p.text);
  const content = textParts.length > 0 ? textParts.join('') : null;

  const toolCalls: ToolCallRequest[] = [];
  parts.forEach((p, i) => {
    const tc = extractToolCall(p, i);
    if (tc !== null) {
      toolCalls.push(tc);
    }
  });

  const finishReason = mapGeminiFinishReason(candidate?.finishReason, toolCalls.length > 0);

  const inputTokens = resp.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = resp.usageMetadata?.candidatesTokenCount ?? 0;

  return createLLMResponse({
    content,
    toolCalls,
    finishReason,
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
  });
}
