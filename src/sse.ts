// Incremental Server-Sent Events parser (fetch + ReadableStream based; the
// Authorization header means EventSource cannot be used).
// Handles chunks split mid-line, CRLF, multi-line data, comments, and the
// id: / event: fields.

export interface SSEMessage {
  event: string;
  data: string;
  id?: string;
}

export type SSEParser = {
  /** Feed a decoded text chunk (may split lines anywhere). */
  push(chunk: string): void;
  /** Flush nothing extra; stream end just drops any incomplete line. */
};

export function createSSEParser(onMessage: (msg: SSEMessage) => void): SSEParser {
  let buffer = '';
  let dataLines: string[] = [];
  let eventName = '';
  let lastId: string | undefined;

  function dispatch(): void {
    if (dataLines.length === 0) {
      // Comment-only or field-less block: ignored, but id still counts per spec
      // only when data is present; keep it simple and reset.
      eventName = '';
      return;
    }
    const msg: SSEMessage = { event: eventName || 'message', data: dataLines.join('\n') };
    if (lastId !== undefined) msg.id = lastId;
    dataLines = [];
    eventName = '';
    onMessage(msg);
  }

  function processLine(raw: string): void {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) return; // comment
    const colon = line.indexOf(':');
    let field: string;
    let value: string;
    if (colon === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }
    switch (field) {
      case 'data':
        dataLines.push(value);
        break;
      case 'event':
        eventName = value;
        break;
      case 'id':
        if (!value.includes('\0')) lastId = value;
        break;
      default:
        break; // retry: and unknown fields are ignored
    }
  }

  return {
    push(chunk: string): void {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        processLine(line);
      }
    },
  };
}
