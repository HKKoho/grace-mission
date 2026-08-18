import { describe, expect, it, vi } from 'vitest';
import { TaskRunMessageStore } from '../../message-store/task-run-message-store.js';

describe('TaskRunMessageStore', () => {
  it('loadMessages maps repository rows to ChatMessage shape', async () => {
    const repo = {
      appendMany: vi.fn(),
      findByTaskRunId: vi.fn().mockResolvedValue([
        { id: 'a', role: 'user', content: 'q', toolCallId: null, toolCalls: null, ordering: 0 },
        {
          id: 'b',
          role: 'assistant',
          content: 'a',
          toolCallId: null,
          toolCalls: [{ id: 't1', name: 'search', args: {} }],
          ordering: 1,
        },
      ]),
    };
    const store = new TaskRunMessageStore(repo as never, 'tr-1');
    const msgs = await store.loadMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ role: 'user', content: 'q' });
    expect(msgs[1]).toEqual({
      role: 'assistant',
      content: 'a',
      toolCalls: [{ id: 't1', name: 'search', args: {} }],
    });
  });

  it('saveMessages forwards to repo.appendMany with taskRunId', async () => {
    const repo = { appendMany: vi.fn().mockResolvedValue(['m-1']), findByTaskRunId: vi.fn() };
    const store = new TaskRunMessageStore(repo as never, 'tr-1');
    const ids = await store.saveMessages([
      { role: 'user', content: 'hi' },
      { role: 'tool', content: 'ok', toolCallId: 'tc-1' },
    ]);
    expect(repo.appendMany).toHaveBeenCalledWith('tr-1', [
      { role: 'user', content: 'hi' },
      { role: 'tool', content: 'ok', toolCallId: 'tc-1' },
    ]);
    expect(ids).toEqual(['m-1']);
  });

  it('preserves providerExtra on tool calls when saving', async () => {
    const repo = { appendMany: vi.fn().mockResolvedValue(['m-1']), findByTaskRunId: vi.fn() };
    const store = new TaskRunMessageStore(repo as never, 'tr-1');
    const toolCalls = [
      {
        id: 'c1',
        name: 'search',
        arguments: { q: 'x' },
        providerExtra: { google: { thoughtSignature: 'sig-abc-123' } },
      },
    ];
    await store.saveMessages([{ role: 'assistant', content: '', toolCalls: toolCalls as never }]);
    const passedMessages = (repo.appendMany.mock.calls[0] as [string, unknown[]])[1];
    expect(
      (passedMessages[0] as { toolCalls: typeof toolCalls }).toolCalls[0]?.providerExtra,
    ).toEqual({
      google: { thoughtSignature: 'sig-abc-123' },
    });
  });

  it('preserves providerExtra on tool calls when loading', async () => {
    const toolCalls = [
      {
        id: 'c1',
        name: 'search',
        arguments: { q: 'x' },
        providerExtra: { google: { thoughtSignature: 'sig-abc-123' } },
      },
    ];
    const repo = {
      appendMany: vi.fn(),
      findByTaskRunId: vi
        .fn()
        .mockResolvedValue([
          { id: 'a', role: 'assistant', content: '', toolCallId: null, toolCalls, ordering: 0 },
        ]),
    };
    const store = new TaskRunMessageStore(repo as never, 'tr-1');
    const msgs = await store.loadMessages();
    expect(msgs[0]?.toolCalls?.[0]).toMatchObject({
      id: 'c1',
      name: 'search',
      providerExtra: { google: { thoughtSignature: 'sig-abc-123' } },
    });
  });
});
