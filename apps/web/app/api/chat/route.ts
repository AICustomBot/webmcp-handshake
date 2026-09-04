import { NextResponse } from 'next/server';
import { CONTRACT_VERSION } from '@handshake/contracts';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

/**
 * Next.js App Router route for Handshake AI Copilot.
 * Supports streaming responses for Vercel AI SDK (useChat / DefaultChatTransport)
 * and JSON responses for direct API clients and integration tests.
 */
export async function POST(req: Request) {
  try {
    const rawBody = (await req.json()) as unknown;
    const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as {
      messages?: Array<{
        role: string;
        content?: string;
        parts?: Array<{ type: string; text?: string }>;
      }>;
    };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

    let userQuery = '';
    if (lastUserMessage) {
      if (typeof lastUserMessage.content === 'string') {
        userQuery = lastUserMessage.content.toLowerCase();
      } else if (Array.isArray(lastUserMessage.parts)) {
        userQuery = lastUserMessage.parts
          .filter((p) => p.type === 'text' && typeof p.text === 'string')
          .map((p) => p.text)
          .join(' ')
          .toLowerCase();
      }
    }

    let responseText = '';
    let toolCall: { name: string; args: Record<string, any> } | null = null;

    if (
      userQuery.includes('nkba') ||
      userQuery.includes('clearance') ||
      userQuery.includes('rule')
    ) {
      responseText =
        'I am analyzing your layout against National Kitchen & Bath Association (NKBA) guidelines. Let me inspect the work triangle legs, approach clearances, and service proximity.';
      toolCall = { name: 'evaluate_design', args: {} };
    } else if (userQuery.includes('dishwasher') || userQuery.includes('dw')) {
      responseText =
        'I propose placing a built-in 24" quiet dishwasher directly adjacent to the kitchen sink for optimal plumbing efficiency and loading clearance.';
      toolCall = {
        name: 'propose_changes',
        args: {
          operations: [
            {
              type: 'place',
              productId: 'quiet-dishwasher',
              x: 72,
              y: 0,
              rotation: 0,
            },
          ],
          rationale: 'Placed 24" dishwasher directly beside sink along North wall plumbing run.',
        },
      };
    } else if (userQuery.includes('island')) {
      responseText =
        'I propose adding a central kitchen preparation island with clearance corridors of at least 42" on all sides.';
      toolCall = {
        name: 'propose_changes',
        args: {
          operations: [
            {
              type: 'place',
              productId: 'prep-island',
              x: 60,
              y: 60,
              rotation: 0,
            },
          ],
          rationale: 'Added central preparation island respecting 42" minimum clearance corridors.',
        },
      };
    } else if (userQuery.includes('vanity')) {
      responseText =
        'I propose placing a 36" Harbor vanity along the wall with 30" approach clearance.';
      toolCall = {
        name: 'propose_changes',
        args: {
          operations: [
            {
              type: 'place',
              productId: 'harbor-vanity',
              x: 24,
              y: 24,
              rotation: 0,
            },
          ],
          rationale: 'Placed 36" Harbor vanity with standard 30" front clearance.',
        },
      };
    } else if (
      userQuery.includes('bom') ||
      userQuery.includes('bill') ||
      userQuery.includes('cost') ||
      userQuery.includes('budget')
    ) {
      responseText =
        'Here is the itemized Bill of Materials and remaining budget balance for your committed design.';
      toolCall = { name: 'get_bill_of_materials', args: {} };
    } else if (
      userQuery.includes('consultation') ||
      userQuery.includes('book') ||
      userQuery.includes('quote')
    ) {
      responseText =
        'I can request a showroom consultation for you. Note that under Handshake governance, protected actions require your explicit human confirmation.';
      toolCall = {
        name: 'request_protected_action',
        args: {
          action: 'book_consultation',
          payload: { date: '2026-09-15', preferredTime: 'morning' },
        },
      };
    } else if (userQuery.includes('receipt')) {
      responseText = 'Reading your exportable, tamper-evident cryptographic decision receipt.';
      toolCall = { name: 'get_receipt', args: {} };
    } else if (userQuery.includes('search') || userQuery.includes('catalog')) {
      responseText = 'Searching the synthetic fixture catalog for available products.';
      toolCall = { name: 'search_catalog', args: { query: 'vanity' } };
    } else {
      responseText =
        'Hello! I am your Handshake AI Copilot. I can inspect your room dimensions, evaluate NKBA clearance guidelines, propose parametric fixtures, or prepare your itemized Bill of Materials. How can I assist with your design?';
      toolCall = { name: 'get_room_state', args: {} };
    }

    const accept = req.headers.get('accept') || '';

    // If client requested JSON specifically, return standard JSON
    if (accept.includes('application/json') && !accept.includes('text/event-stream')) {
      return NextResponse.json({
        role: 'assistant',
        content: responseText,
        toolCall,
        contractVersion: CONTRACT_VERSION,
      });
    }

    // Otherwise stream as UI Message chunks for Vercel AI SDK useChat
    const textPartId = `part_${Date.now().toString(36)}_text`;
    const toolCallId = `call_${Date.now().toString(36)}`;

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: 'text-start',
          id: textPartId,
        });
        writer.write({
          type: 'text-delta',
          id: textPartId,
          delta: responseText,
        });
        writer.write({
          type: 'text-end',
          id: textPartId,
        });

        if (toolCall) {
          writer.write({
            type: 'tool-input-available',
            toolCallId,
            toolName: toolCall.name,
            input: toolCall.args,
          });
        }
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to process chat request' },
      { status: 400 },
    );
  }
}
