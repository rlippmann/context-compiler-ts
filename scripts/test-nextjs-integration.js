#!/usr/bin/env node
// Replays demo scenarios against the Next.js API
// Validates clarify/continue behavior and state persistence

/**
 * Black-box behavior tests for the Next.js integration endpoint.
 *
 * Target:
 *   POST http://localhost:3000/api/chat
 *
 * Usage:
 *   node scripts/test-nextjs-integration.js
 *   API_URL=http://localhost:3000/api/chat node scripts/test-nextjs-integration.js
 *   STRICT_CONTENT=1 node scripts/test-nextjs-integration.js
 *
 * Notes:
 * - By default, this validates deterministic compiler behavior via `kind` and
 *   clarify prompt fragments.
 * - Continue-output semantic checks are optional and controlled by STRICT_CONTENT=1
 *   because real model outputs can vary.
 */

const API_URL = process.env.API_URL || 'http://localhost:3000/api/chat';
const STRICT_CONTENT = process.env.STRICT_CONTENT === '1';

function logStep(label, payload, response) {
  console.log(`\n[${label}] request:`);
  console.log(JSON.stringify(payload, null, 2));
  console.log(`[${label}] response:`);
  console.log(JSON.stringify(response, null, 2));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertKind(response, expectedKind, scenarioName, stepName) {
  assert(
    response && response.kind === expectedKind,
    `${scenarioName} / ${stepName}: expected kind="${expectedKind}", got ${JSON.stringify(response)}`
  );
}

function assertConstraintHint(output, pattern, scenarioName, hint) {
  assert(typeof output === 'string' && output.length > 0, `${scenarioName}: expected non-empty output`);
  assert(
    pattern.test(output),
    `${scenarioName}: output does not appear to reflect constraint (${hint}). Output: ${JSON.stringify(output)}`
  );
}

function assertClarifyNoOutput(response, scenarioName, stepName) {
  assert(
    !Object.prototype.hasOwnProperty.call(response, 'output'),
    `${scenarioName} / ${stepName}: expected no output field on clarify (indirect no-model-call check)`
  );
}

function assertPromptIncludes(response, fragment, scenarioName, stepName) {
  assert(
    typeof response.prompt_to_user === 'string' && response.prompt_to_user.includes(fragment),
    `${scenarioName} / ${stepName}: expected prompt to include ${JSON.stringify(fragment)}, got ${JSON.stringify(response)}`
  );
}

async function postChat(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  let json;
  try {
    json = await res.json();
  } catch (err) {
    const text = await res.text();
    throw new Error(`Non-JSON response (${res.status}): ${text}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function runScenario(scenario, sessionId, steps) {
  console.log(`\n=== ${scenario} ===`);
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const label = `s${sessionId}-step${i + 1}`;
    const payload = {
      sessionId,
      input: step.input,
      ...(step.history ? { history: step.history } : {}),
    };
    const response = await postChat(payload);
    logStep(label, payload, response);

    assertKind(response, step.expectKind, scenario, `step${i + 1}`);
    if (step.expectKind === 'clarify') {
      assertClarifyNoOutput(response, scenario, `step${i + 1}`);
    }
    if (step.promptIncludes) {
      assertPromptIncludes(response, step.promptIncludes, scenario, `step${i + 1}`);
    }
    if (step.expectOutputNonEmpty) {
      assert(
        typeof response.output === 'string' && response.output.trim().length > 0,
        `${scenario} / step${i + 1}: expected non-empty output`
      );
    }
    if (step.outputPattern) {
      assertConstraintHint(response.output, step.outputPattern, scenario, step.outputPatternHint || 'expected content');
    }
  }
}

async function runAllScenarios() {
  await runScenario('1) Passthrough continue', '01-passthrough', [
    {
      input: 'hello there',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
  ]);

  await runScenario('2) Contradiction clarify', '02-contradiction', [
    {
      input: 'prohibit peanuts',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
    {
      input: 'use peanuts',
      expectKind: 'clarify',
      promptIncludes: 'already prohibited',
    },
  ]);

  await runScenario('3) Premise lifecycle', '03-premise-lifecycle', [
    {
      input: 'set premise vegetarian',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
    {
      input: 'set premise formal tone',
      expectKind: 'clarify',
      promptIncludes: 'Premise already exists',
    },
    {
      input: 'change premise to vegan',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
    {
      input: 'clear premise',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
    {
      input: 'change premise to pescatarian',
      expectKind: 'clarify',
      promptIncludes: 'No premise exists yet',
    },
  ]);

  await runScenario('4) Near-miss clarify prompts', '04-near-miss', [
    {
      input: 'set premise to concise replies',
      expectKind: 'clarify',
      promptIncludes: "Did you mean 'set premise concise replies'?",
    },
    {
      input: 'change premise concise replies',
      expectKind: 'clarify',
      promptIncludes: "Did you mean 'change premise to concise replies'?",
    },
  ]);

  await runScenario('5) Policy lifecycle and conflicts', '05-policy-lifecycle', [
    {
      input: 'use docker',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
    {
      input: 'prohibit docker',
      expectKind: 'clarify',
      promptIncludes: 'already in use',
    },
    {
      input: 'remove policy docker',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
    {
      input: 'prohibit docker',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
    {
      input: 'use docker',
      expectKind: 'clarify',
      promptIncludes: 'already prohibited',
    },
    {
      input: 'reset policies',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
  ]);

  await runScenario('6) Pending confirmation gating (unmatched + yes)', '06-pending-yes', [
    {
      input: 'use podman instead of docker',
      expectKind: 'clarify',
      promptIncludes: 'No exact policy found for "docker".',
    },
    {
      input: 'maybe',
      expectKind: 'clarify',
      promptIncludes: 'No exact policy found for "docker".',
    },
    {
      input: 'yes',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
  ]);

  await runScenario('7) Pending confirmation gating (unmatched + no)', '07-pending-no', [
    {
      input: 'use podman instead of docker',
      expectKind: 'clarify',
      promptIncludes: 'No exact policy found for "docker".',
    },
    {
      input: 'no',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
    },
  ]);

  await runScenario('8) Replay path', '08-replay', [
    {
      history: [{ role: 'user', content: 'prohibit peanuts' }],
      input: 'use peanuts',
      expectKind: 'clarify',
      promptIncludes: 'already prohibited',
    },
  ]);

  await runScenario('9) State persistence', '09-persistence', [
    {
      input: 'set premise vegan',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
      ...(STRICT_CONTENT
        ? {
            outputPattern: /\b(vegan|plant[- ]based|dairy[- ]free|egg[- ]free)\b/i,
            outputPatternHint: 'vegan',
          }
        : {}),
    },
    {
      input: 'give me a recipe idea',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
      ...(STRICT_CONTENT
        ? {
            outputPattern: /\b(vegan|plant[- ]based|dairy[- ]free|egg[- ]free)\b/i,
            outputPatternHint: 'vegan',
          }
        : {}),
    },
  ]);

  await runScenario('10) Premise + continue', '10-premise-continue', [
    {
      input: 'set premise vegetarian',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
      ...(STRICT_CONTENT
        ? {
            outputPattern: /\b(vegetarian|veggie|meatless|plant[- ]based)\b/i,
            outputPatternHint: 'vegetarian',
          }
        : {}),
    },
    {
      input: 'suggest a dinner',
      expectKind: 'continue',
      expectOutputNonEmpty: true,
      ...(STRICT_CONTENT
        ? {
            outputPattern: /\b(vegetarian|veggie|meatless|plant[- ]based)\b/i,
            outputPatternHint: 'vegetarian',
          }
        : {}),
    },
  ]);
}

async function main() {
  console.log(`Testing Next.js API at: ${API_URL}`);
  console.log(`STRICT_CONTENT=${STRICT_CONTENT ? '1' : '0'}`);

  await runAllScenarios();

  console.log('\nAll scenarios passed.');
}

main().catch((err) => {
  console.error('\nTest run failed.');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
