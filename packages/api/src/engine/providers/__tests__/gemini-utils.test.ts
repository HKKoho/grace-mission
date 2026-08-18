import { describe, it, expect } from 'vitest';

import {
  parseGeminiResponse,
  sanitizeJsonSchemaForGemini,
  toGeminiRequest,
  toGeminiTools,
} from '../gemini-utils.js';
import type { ChatMessage } from '@clawix/shared';

describe('sanitizeJsonSchemaForGemini', () => {
  it('keeps allowed top-level keywords', () => {
    const input = {
      type: 'object',
      properties: { name: { type: 'string', description: 'name' } },
      required: ['name'],
    };
    expect(sanitizeJsonSchemaForGemini(input)).toEqual(input);
  });

  it('drops additionalProperties', () => {
    const result = sanitizeJsonSchemaForGemini({
      type: 'object',
      properties: { x: { type: 'string' } },
      additionalProperties: false,
    });
    expect(result).toEqual({
      type: 'object',
      properties: { x: { type: 'string' } },
    });
  });

  it('drops $schema, $id, $ref, definitions, default, examples, const', () => {
    const result = sanitizeJsonSchemaForGemini({
      type: 'string',
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'foo',
      $ref: '#/$defs/Bar',
      definitions: { Bar: { type: 'string' } },
      default: 'hello',
      examples: ['a', 'b'],
      const: 'fixed',
    });
    expect(result).toEqual({ type: 'string' });
  });

  it('drops format unless it is enum or date-time', () => {
    expect(sanitizeJsonSchemaForGemini({ type: 'string', format: 'email' })).toEqual({
      type: 'string',
    });
    expect(sanitizeJsonSchemaForGemini({ type: 'string', format: 'date-time' })).toEqual({
      type: 'string',
      format: 'date-time',
    });
    expect(sanitizeJsonSchemaForGemini({ type: 'string', format: 'enum' })).toEqual({
      type: 'string',
      format: 'enum',
    });
  });

  it('keeps enum, items, nullable, anyOf, min/maxItems, min/maxProperties', () => {
    const input = {
      type: 'array',
      items: { type: 'string', enum: ['a', 'b'] },
      minItems: 1,
      maxItems: 5,
      nullable: true,
      anyOf: [{ type: 'string' }, { type: 'number' }],
      minProperties: 1,
      maxProperties: 3,
    };
    expect(sanitizeJsonSchemaForGemini(input)).toEqual(input);
  });

  it('recurses into properties', () => {
    const result = sanitizeJsonSchemaForGemini({
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          additionalProperties: true,
          properties: { x: { type: 'string', default: 'foo' } },
        },
      },
    });
    expect(result).toEqual({
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: { x: { type: 'string' } },
        },
      },
    });
  });

  it('recurses into items', () => {
    const result = sanitizeJsonSchemaForGemini({
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: {} },
    });
    expect(result).toEqual({
      type: 'array',
      items: { type: 'object', properties: {} },
    });
  });

  it('recurses into anyOf', () => {
    const result = sanitizeJsonSchemaForGemini({
      anyOf: [
        { type: 'string', default: 'x' },
        { type: 'object', additionalProperties: false },
      ],
    });
    expect(result).toEqual({
      anyOf: [{ type: 'string' }, { type: 'object' }],
    });
  });

  it('keeps minimum, maximum, minLength, maxLength', () => {
    const input = {
      type: 'object',
      properties: {
        n: { type: 'integer', minimum: 1, maximum: 10 },
        s: { type: 'string', minLength: 3, maxLength: 20 },
      },
      required: ['n'],
    };
    expect(sanitizeJsonSchemaForGemini(input)).toEqual(input);
  });

  it('passes integer type through unchanged', () => {
    const input = { type: 'integer', minimum: 0, maximum: 600 };
    expect(sanitizeJsonSchemaForGemini(input)).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = { type: 'object', additionalProperties: false };
    const snapshot = JSON.parse(JSON.stringify(input));
    sanitizeJsonSchemaForGemini(input);
    expect(input).toEqual(snapshot);
  });
});

describe('toGeminiTools', () => {
  it('wraps tool definitions in functionDeclarations envelope', () => {
    const tools = [
      {
        name: 'search',
        description: 'Search the web',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ];

    expect(toGeminiTools(tools)).toEqual([
      {
        functionDeclarations: [
          {
            name: 'search',
            description: 'Search the web',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        ],
      },
    ]);
  });

  it('runs each tool schema through the sanitizer', () => {
    const tools = [
      {
        name: 'noop',
        description: 'no-op',
        inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      },
    ];

    const result = toGeminiTools(tools);
    const declared = (result[0] as { functionDeclarations: { parameters: unknown }[] })
      .functionDeclarations[0]!;
    expect(declared.parameters).toEqual({ type: 'object', properties: {} });
  });

  it('handles multiple tools in a single envelope', () => {
    const tools = [
      { name: 'a', description: 'A', inputSchema: { type: 'object' } },
      { name: 'b', description: 'B', inputSchema: { type: 'object' } },
    ];
    const result = toGeminiTools(tools);
    const declarations = (result[0] as { functionDeclarations: unknown[] }).functionDeclarations;
    expect(declarations).toHaveLength(2);
  });
});

describe('toGeminiRequest', () => {
  it('extracts a single system message into systemInstruction', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ];
    const result = toGeminiRequest(messages);
    expect(result.systemInstruction).toBe('You are helpful.');
    expect(result.contents).toEqual([{ role: 'user', parts: [{ text: 'Hi' }] }]);
  });

  it('joins multiple system messages with double newlines', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'Be terse.' },
      { role: 'system', content: 'Be polite.' },
      { role: 'user', content: 'Hi' },
    ];
    expect(toGeminiRequest(messages).systemInstruction).toBe('Be terse.\n\nBe polite.');
  });

  it('omits systemInstruction when no system message is present', () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'Hi' }];
    expect(toGeminiRequest(messages).systemInstruction).toBeUndefined();
  });

  it('maps assistant role to model role', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ];
    expect(toGeminiRequest(messages).contents).toEqual([
      { role: 'user', parts: [{ text: 'Hi' }] },
      { role: 'model', parts: [{ text: 'Hello!' }] },
    ]);
  });

  it('converts assistant tool calls to functionCall parts', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Search for cats' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'gemini-call-0-abc123', name: 'search', arguments: { q: 'cats' } }],
      },
    ];
    const result = toGeminiRequest(messages);
    expect(result.contents).toEqual([
      { role: 'user', parts: [{ text: 'Search for cats' }] },
      {
        role: 'model',
        parts: [{ functionCall: { name: 'search', args: { q: 'cats' } } }],
      },
    ]);
  });

  it('includes leading text part when assistant has both content and tool calls', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Search for cats' },
      {
        role: 'assistant',
        content: 'Let me search.',
        toolCalls: [{ id: 'c0', name: 'search', arguments: { q: 'cats' } }],
      },
    ];
    const result = toGeminiRequest(messages);
    expect(result.contents[1]).toEqual({
      role: 'model',
      parts: [
        { text: 'Let me search.' },
        { functionCall: { name: 'search', args: { q: 'cats' } } },
      ],
    });
  });

  it('echoes back thought signature from providerExtra', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Search' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'c0',
            name: 'search',
            arguments: { q: 'x' },
            providerExtra: { google: { thoughtSignature: 'sig-abc-123' } },
          },
        ],
      },
    ];
    const result = toGeminiRequest(messages);
    expect(result.contents[1]).toEqual({
      role: 'model',
      parts: [
        {
          functionCall: {
            name: 'search',
            args: { q: 'x' },
            thoughtSignature: 'sig-abc-123',
          },
        },
      ],
    });
  });

  it('does not include thoughtSignature when providerExtra is absent', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'x' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c0', name: 'noop', arguments: {} }],
      },
    ];
    const part = (toGeminiRequest(messages).contents[1] as { parts: { functionCall: object }[] })
      .parts[0]!.functionCall as Record<string, unknown>;
    expect(part).not.toHaveProperty('thoughtSignature');
  });

  it('converts tool result message to functionResponse part', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Search' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-1', name: 'search', arguments: { q: 'x' } }],
      },
      { role: 'tool', toolCallId: 'call-1', content: '{"results":["a","b"]}' },
    ];
    const result = toGeminiRequest(messages);
    expect(result.contents[2]).toEqual({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: 'search',
            response: { result: '{"results":["a","b"]}' },
          },
        },
      ],
    });
  });

  it('looks up function name from prior assistant tool call by toolCallId', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-A', name: 'fnA', arguments: {} },
          { id: 'call-B', name: 'fnB', arguments: {} },
        ],
      },
      { role: 'tool', toolCallId: 'call-B', content: 'B-result' },
    ];
    const result = toGeminiRequest(messages);
    expect(
      (result.contents[1] as { parts: { functionResponse: { name: string } }[] }).parts[0]!
        .functionResponse.name,
    ).toBe('fnB');
  });

  it('falls back to empty name when toolCallId is unknown', () => {
    const messages: ChatMessage[] = [{ role: 'tool', toolCallId: 'unknown', content: 'orphan' }];
    const result = toGeminiRequest(messages);
    expect(
      (result.contents[0] as { parts: { functionResponse: { name: string } }[] }).parts[0]!
        .functionResponse.name,
    ).toBe('');
  });
});

describe('parseGeminiResponse', () => {
  it('extracts text content from non-thought parts', () => {
    const resp = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello' }, { text: ' there' }],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    };
    const result = parseGeminiResponse(resp);
    expect(result.content).toBe('Hello there');
    expect(result.finishReason).toBe('stop');
  });

  it('excludes parts with thought: true from content', () => {
    const resp = {
      candidates: [
        {
          content: {
            parts: [{ text: 'reasoning...', thought: true }, { text: 'Final answer.' }],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    };
    expect(parseGeminiResponse(resp).content).toBe('Final answer.');
  });

  it('returns null content when no text parts are present', () => {
    const resp = {
      candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    };
    expect(parseGeminiResponse(resp).content).toBeNull();
  });

  it('extracts usage from usageMetadata', () => {
    const resp = {
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 42, candidatesTokenCount: 17 },
    };
    expect(parseGeminiResponse(resp).usage).toEqual({
      inputTokens: 42,
      outputTokens: 17,
      totalTokens: 59,
    });
  });

  it('maps STOP to stop, MAX_TOKENS to max_tokens, others to error', () => {
    const make = (reason: string) => ({
      candidates: [{ content: { parts: [{ text: '' }] }, finishReason: reason }],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    });
    expect(parseGeminiResponse(make('STOP')).finishReason).toBe('stop');
    expect(parseGeminiResponse(make('MAX_TOKENS')).finishReason).toBe('max_tokens');
    expect(parseGeminiResponse(make('SAFETY')).finishReason).toBe('error');
    expect(parseGeminiResponse(make('RECITATION')).finishReason).toBe('error');
    expect(parseGeminiResponse(make('PROHIBITED_CONTENT')).finishReason).toBe('error');
    expect(parseGeminiResponse(make('OTHER')).finishReason).toBe('error');
  });

  it('handles missing usageMetadata gracefully', () => {
    const resp = {
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }],
    };
    expect(parseGeminiResponse(resp).usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });

  it('extracts tool calls from functionCall parts', () => {
    const resp = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: { name: 'search', args: { q: 'cats' } },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
    };
    const result = parseGeminiResponse(resp);
    expect(result.toolCalls).toHaveLength(1);
    const tc = result.toolCalls[0]!;
    expect(tc.name).toBe('search');
    expect(tc.arguments).toEqual({ q: 'cats' });
    expect(tc.id).toMatch(/^gemini-call-0-/);
    expect(result.finishReason).toBe('tool_use');
  });

  it('mints unique tool-call ids within a single response', () => {
    const resp = {
      candidates: [
        {
          content: {
            parts: [
              { functionCall: { name: 'a', args: {} } },
              { functionCall: { name: 'b', args: {} } },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    };
    const result = parseGeminiResponse(resp);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]!.id).not.toEqual(result.toolCalls[1]!.id);
    expect(result.toolCalls[0]!.id).toMatch(/^gemini-call-0-/);
    expect(result.toolCalls[1]!.id).toMatch(/^gemini-call-1-/);
  });

  it('captures thoughtSignature into providerExtra', () => {
    const resp = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: 'search',
                  args: {},
                  thoughtSignature: 'sig-zzz',
                },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    };
    const tc = parseGeminiResponse(resp).toolCalls[0]!;
    expect(tc.providerExtra).toEqual({ google: { thoughtSignature: 'sig-zzz' } });
  });

  it('omits providerExtra when no thoughtSignature is present', () => {
    const resp = {
      candidates: [
        {
          content: { parts: [{ functionCall: { name: 'noop', args: {} } }] },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    };
    const tc = parseGeminiResponse(resp).toolCalls[0]!;
    expect(tc.providerExtra).toBeUndefined();
  });

  it('handles a mix of text and functionCall parts', () => {
    const resp = {
      candidates: [
        {
          content: {
            parts: [
              { text: 'Let me check.' },
              { functionCall: { name: 'search', args: { q: 'x' } } },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    };
    const result = parseGeminiResponse(resp);
    expect(result.content).toBe('Let me check.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.finishReason).toBe('tool_use');
  });
});

describe('thought-signature roundtrip', () => {
  it('parsing a response and feeding it back preserves the signature', () => {
    const resp = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: 'search',
                  args: { q: 'cats' },
                  thoughtSignature: 'sig-roundtrip',
                },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    };
    const parsed = parseGeminiResponse(resp);

    const messages: ChatMessage[] = [
      { role: 'user', content: 'Search' },
      { role: 'assistant', content: '', toolCalls: parsed.toolCalls },
    ];
    const next = toGeminiRequest(messages);
    const part = (next.contents[1] as { parts: { functionCall: { thoughtSignature?: string } }[] })
      .parts[0]!.functionCall;
    expect(part.thoughtSignature).toBe('sig-roundtrip');
  });
});
