import http from 'node:http';
import { createEngine, getPolicyItems, getPremiseValue, type EngineState } from '@rlippmann/context-compiler';

type ChatBody = {
  sessionId: string;
  input: string;
  history?: Array<{ role: string; content: unknown }>;
};

type ChatResponse =
  | { kind: 'clarify'; prompt_to_user: string | null }
  | { kind: 'continue'; output: string };

const stateBySession = new Map<string, string>(); // sessionId -> engine.exportJson()

function loadState(sessionId: string): string | null {
  return stateBySession.get(sessionId) ?? null;
}

function saveState(sessionId: string, json: string): void {
  stateBySession.set(sessionId, json);
}

function stateToSystemPrompt(state: EngineState): string {
  const useItems = new Set(getPolicyItems(state, 'use'));
  const policies = getPolicyItems(state)
    .map((item: string) => `- ${useItems.has(item) ? 'USE' : 'PROHIBIT'}: ${item}`)
    .join('\n');

  return [
    'You are an assistant operating under compiled context.',
    '',
    'PREMISE:',
    getPremiseValue(state) ?? '(none)',
    '',
    'POLICIES:',
    policies || '(none)',
    '',
    'Follow these constraints strictly.'
  ].join('\n');
}

function minimalRecentContext(history: ChatBody['history']) {
  if (!history?.length) return [];
  return history
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
    )
    .slice(-2)
    .map((m) => ({ role: m.role, content: m.content }));
}

async function parseJson(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/chat') {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }

  try {
    const { sessionId, input, history }: ChatBody = await parseJson(req);
    if (!sessionId || !input) {
      sendJson(res, 400, { error: 'sessionId and input are required' });
      return;
    }

    const engine = createEngine();
    const saved = loadState(sessionId);

    if (saved) {
      engine.importJson(saved);
    } else if (history?.length) {
      for (const m of history) {
        if (m.role !== 'user' || typeof m.content !== 'string') continue;
        const d = engine.step(m.content);
        if (d.kind === 'clarify') {
          saveState(sessionId, engine.exportJson());
          const payload: ChatResponse = { kind: 'clarify', prompt_to_user: d.prompt_to_user };
          sendJson(res, 200, payload);
          return;
        }
      }
      saveState(sessionId, engine.exportJson());
    }

    const decision = engine.step(input);
    if (decision.kind === 'clarify') {
      saveState(sessionId, engine.exportJson());
      const payload: ChatResponse = { kind: 'clarify', prompt_to_user: decision.prompt_to_user };
      sendJson(res, 200, payload);
      return;
    }

    saveState(sessionId, engine.exportJson());

    const usedReplay = !saved && !!history?.length;
    const messages = [
      { role: 'system', content: stateToSystemPrompt(engine.state) },
      ...(usedReplay ? [] : minimalRecentContext(history)),
      { role: 'user', content: input }
    ];

    const llmRes = await fetch(`${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages,
        temperature: 0.2
      })
    });

    if (!llmRes.ok) {
      sendJson(res, 502, { error: 'llm_failed', details: await llmRes.text() });
      return;
    }

    const data = await llmRes.json();
    const output = data?.choices?.[0]?.message?.content ?? '';
    const payload: ChatResponse = { kind: 'continue', output };
    sendJson(res, 200, payload);
  } catch (err) {
    sendJson(res, 500, { error: 'internal_error', details: String(err) });
  }
});

server.listen(8080, () => {
  console.log('Node example listening on http://localhost:8080');
});
