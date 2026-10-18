import { describe, expect, it } from 'vitest';
import { createSSEParser } from '../src/sse';
import type { SSEMessage } from '../src/sse';

function collect(): { msgs: SSEMessage[]; push: (chunk: string) => void } {
  const msgs: SSEMessage[] = [];
  const parser = createSSEParser((m) => msgs.push(m));
  return { msgs, push: parser.push };
}

describe('SSE parser', () => {
  it('parses a simple data message', () => {
    const { msgs, push } = collect();
    push('data: hello\n\n');
    expect(msgs).toEqual([{ event: 'message', data: 'hello' }]);
  });

  it('handles chunks split mid-line', () => {
    const { msgs, push } = collect();
    push('data: hel');
    expect(msgs).toEqual([]);
    push('lo wor');
    push('ld\n\n');
    expect(msgs).toEqual([{ event: 'message', data: 'hello world' }]);
  });

  it('handles CRLF line endings', () => {
    const { msgs, push } = collect();
    push('event: agent\r\ndata: {"a":1}\r\n\r\n');
    expect(msgs).toEqual([{ event: 'agent', data: '{"a":1}' }]);
  });

  it('joins multi-line data with a newline', () => {
    const { msgs, push } = collect();
    push('data: line one\ndata: line two\ndata:\n\n');
    expect(msgs).toEqual([{ event: 'message', data: 'line one\nline two\n' }]);
  });

  it('captures id: and event: fields', () => {
    const { msgs, push } = collect();
    push('id: 42495\nevent: feed\ndata: {"rev":42495}\n\n');
    expect(msgs).toEqual([{ event: 'feed', data: '{"rev":42495}', id: '42495' }]);
  });

  it('ignores comment lines', () => {
    const { msgs, push } = collect();
    push(': this is a comment\n\n');
    expect(msgs).toEqual([]);
    push(': keepalive\ndata: real\n\n');
    expect(msgs).toEqual([{ event: 'message', data: 'real' }]);
  });

  it('treats a field without a colon as having an empty value', () => {
    const { msgs, push } = collect();
    push('data\n\n');
    expect(msgs).toEqual([{ event: 'message', data: '' }]);
  });

  it('dispatches multiple messages from one chunk', () => {
    const { msgs, push } = collect();
    push('data: one\n\ndata: two\n\n');
    expect(msgs.map((m) => m.data)).toEqual(['one', 'two']);
  });

  it('handles a chunk boundary between CR and LF', () => {
    const { msgs, push } = collect();
    push('data: hi\r');
    push('\n\n');
    expect(msgs).toEqual([{ event: 'message', data: 'hi' }]);
  });
});
