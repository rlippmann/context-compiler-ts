import { compileTranscript, createEngine, getPolicyItems, type TranscriptResult } from '../src/index.js';

declare const process: { argv: string[] };

type TranscriptMessage = {
  role: string;
  content: unknown;
};

export function runExample06(): {
  freshReplayKind: string;
  currentReplayKind: string;
  freshPolicies: string[];
  currentPolicies: string[];
} {
  const transcript: TranscriptMessage[] = [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'prohibit peanuts' },
    { role: 'assistant', content: 'Understood' },
    { role: 'user', content: 'set premise vegetarian curry' },
    { role: 'user', content: 'change premise to vegan curry' }
  ];

  const freshReplay = compileTranscript(transcript);

  const engine = createEngine();
  engine.step('prohibit shellfish');
  const currentReplay: TranscriptResult = engine.applyTranscript(transcript);

  const freshPolicies =
    freshReplay.kind === 'state' ? getPolicyItems(freshReplay.state) : [];
  const currentPolicies = currentReplay.kind === 'state' ? getPolicyItems(currentReplay.state) : [];

  return {
    freshReplayKind: freshReplay.kind,
    currentReplayKind: currentReplay.kind,
    freshPolicies,
    currentPolicies
  };
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const result = runExample06();
  console.log('example 06: transcript replay');
  console.log(JSON.stringify(result, null, 2));
}
