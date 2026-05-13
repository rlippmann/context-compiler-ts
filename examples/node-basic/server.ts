import http from 'node:http';
import { createEngine, getPolicyItems, getPremiseValue, type EngineState } from '@rlippmann/context-compiler';
import { parse_preprocessor_output, preprocess_heuristic } from '../../src/experimental/preprocessor/index.js';

type ChatBody = {
  sessionId: string;
  input: string;
  history?: Array<{ role: string; content: unknown }>;
};

type ChatResponse =
  | { kind: 'clarify'; prompt_to_user: string | null }
  | { kind: 'continue'; output: string };

const checkpointBySession = new Map<string, string>(); // sessionId -> engine.exportCheckpointJson()

function loadCheckpoint(sessionId: string): string | null {
  return checkpointBySession.get(sessionId) ?? null;
}

function saveCheckpoint(sessionId: string, json: string): void {
  checkpointBySession.set(sessionId, json);
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

function normalizeInputWithPreprocessor(input: string): string {
  const heuristic = preprocess_heuristic(input);
  if (heuristic.classification === 'directive' && heuristic.output !== null) {
    const parsed = parse_preprocessor_output(heuristic.output, { source_input: input });
    if (parsed !== null) {
      return parsed;
    }
  }
  return input;
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
    const saved = loadCheckpoint(sessionId);

    if (saved) {
      engine.importCheckpointJson(saved);
    } else if (history?.length) {
      const replayMessages = history.filter(
        (m): m is { role: 'user'; content: string } => m.role === 'user' && typeof m.content === 'string'
      );
      const replay = engine.apply_transcript(replayMessages);
      if (replay.kind === 'confirm') {
        saveCheckpoint(sessionId, engine.exportCheckpointJson());
        const payload: ChatResponse = { kind: 'clarify', prompt_to_user: replay.prompt_to_user };
        sendJson(res, 200, payload);
        return;
      }
      saveCheckpoint(sessionId, engine.exportCheckpointJson());
    }

    const preprocessedInput = normalizeInputWithPreprocessor(input);
    const decision = engine.step(preprocessedInput);
    if (decision.kind === 'clarify') {
      saveCheckpoint(sessionId, engine.exportCheckpointJson());
      const payload: ChatResponse = { kind: 'clarify', prompt_to_user: decision.prompt_to_user };
      sendJson(res, 200, payload);
      return;
    }

    saveCheckpoint(sessionId, engine.exportCheckpointJson());

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
