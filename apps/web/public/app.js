const webmcp = Boolean(navigator.modelContext);
if (webmcp) {
  const unavailable = async () => ({
    ok: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Architecture scaffold only.', retryable: false },
  });
  navigator.modelContext.registerTool({
    name: 'get_room_state',
    description: 'Read committed synthetic room state. No side effects.',
    inputSchema: {
      type: 'object',
      properties: { session_id: { type: 'string' } },
      required: ['session_id'],
      additionalProperties: false,
    },
    execute: unavailable,
  });
}
