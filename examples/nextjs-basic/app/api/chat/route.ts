import { createEngine, getPolicyItems, getPremiseValue, type EngineState } from '@rlippmann/context-compiler';
import { loadSessionState, saveSessionState } from '../../../lib/context-sessions';

type ChatBody = {
  sessionId: string;
  input: string;
  history?: Array<{ role: string; content: unknown }>;
};

type ChatResponse =
  | { kind: 'clarify'; prompt_to_user: string | null }
  | { kind: 'continue'; output: string };

function stateToSystemPrompt(state: EngineState): string {
  const useItems = new Set(getPolicyItems(state, 'use'));
  const policies = getPolicyItems(state)
    .map((item) => `- ${useItems.has(item) ? 'USE' : 'PROHIBIT'}: ${item}`)
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
  if (!history?.length) {
    return [];
  }

  return history
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
    )
    .slice(-2)
    .map((m) => ({ role: m.role, content: m.content }));
}

export async function POST(req: Request): Promise<Response> {
  const { sessionId, input, history }: ChatBody = await req.json();

  if (!sessionId || !input) {
    return Response.json({ error: 'sessionId and input are required' }, { status: 400 });
  }

  const engine = createEngine();
  const saved = loadSessionState(sessionId);

  if (saved) {
    engine.importJson(saved);
  } else if (history?.length) {
    for (const m of history) {
      if (m.role !== 'user' || typeof m.content !== 'string') {
        continue;
      }

      const d = engine.step(m.content);
      if (d.kind === 'clarify') {
        saveSessionState(sessionId, engine.exportJson());
        const payload: ChatResponse = {
          kind: 'clarify',
          prompt_to_user: d.prompt_to_user
        };
        return Response.json(payload);
      }
    }

    saveSessionState(sessionId, engine.exportJson());
  }

  const decision = engine.step(input);

  if (decision.kind === 'clarify') {
    saveSessionState(sessionId, engine.exportJson());
    const payload: ChatResponse = {
      kind: 'clarify',
      prompt_to_user: decision.prompt_to_user
    };
    return Response.json(payload);
  }

  saveSessionState(sessionId, engine.exportJson());

  const usedReplay = !saved && !!history?.length;
  const messages = [
    { role: 'system', content: stateToSystemPrompt(engine.state) },
    ...(usedReplay ? [] : minimalRecentContext(history)),
    { role: 'user', content: input }
  ];

  const llmRes = await fetch(`${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages,
      temperature: 0.2
    })
  });

  if (!llmRes.ok) {
    const text = await llmRes.text();
    return Response.json({ error: 'llm_failed', details: text }, { status: 502 });
  }

  const data = await llmRes.json();
  const output = data?.choices?.[0]?.message?.content ?? '';

  const payload: ChatResponse = {
    kind: 'continue',
    output
  };
  return Response.json(payload);
}
