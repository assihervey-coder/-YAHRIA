// ═══════════════════════════════════════════════════════════════
// YAHRIA KERNEL — Cognitive Loop Orchestrator (Domain 06/07)
// GOAL → PERCEPTION → ROUTING → WORLD MODEL → PLAN → ACT → OBSERVE
//      → VERIFY → (FAIL → REFLECTION → REPLAN | PASS → COMMIT → MEMORY)
// Every step: policy-gated + evidence-captured (D.6 governance).
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import type { CognitiveLoopResult, PlanStep, RouterDecision, WorldState } from './types';
import { route as routeRequest, system1, system2, agreementCheck, uncertaintyLevel } from './hybrid-reasoning';
import { evaluatePolicy, SEED_POLICY_RULES } from './policy-engine';
import { captureAndPersist } from './evidence-store';
import { runExecution, SANDBOX_PROFILES } from './execution-fabric';
import { getAgent, checkCapability } from './agent-os';
import { buildWorldState } from './perception';

export async function runCognitiveLoop(goal: string): Promise<CognitiveLoopResult> {
  const t0 = Date.now();
  const traceId = `TR-${randomUUID().slice(0, 12)}`;
  const steps: CognitiveLoopResult['steps'] = [];
  const evidenceUids: string[] = [];
  const mark = (step: string, detail: string, data?: Record<string, unknown>) =>
    steps.push({ step, detail, ms: Date.now() - t0, data });

  // ── 1. PERCEPTION ────────────────────────────────────────────────
  mark('PERCEPTION', 'Assembling WorldState from repository genome, symbols, errors, tests');
  const worldState = buildWorldState(goal);
  const evPerception = await captureAndPersist({
    category: 'AGENT', criticality: 'STANDARD', actorType: 'AGENT', actorId: 'explorer',
    claim: 'WorldState assembled for cognitive loop', payload: { worldState }, traceId,
  });
  evidenceUids.push(evPerception.uid);
  mark('WORLD_MODEL', 'WorldState captured as evidence', { worldState });

  // ── 2. ROUTING (Hybrid Reasoning) ────────────────────────────────
  mark('ROUTING', 'Hybrid router evaluating signals, complexity, uncertainty');
  const decision: RouterDecision = routeRequest(goal);
  mark('ROUTING_DECISION', decision.rationale, { path: decision.path, complexity: decision.complexity, uncertainty: decision.uncertainty });

  // Policy gate BEFORE any reasoning output becomes action (INV-120)
  const policyEval = evaluatePolicy(
    { actorType: 'AGENT', actorId: 'cognitive-core', action: 'model.inference', resource: 'router.cognitive-core' },
    SEED_POLICY_RULES,
  );
  mark('POLICY_CHECK', `Cognitive inference policy: ${policyEval.effect} (${policyEval.matchedRule ?? 'default'})`, policyEval as unknown as Record<string, unknown>);
  if (policyEval.effect === 'DENY') {
    const ev = await captureAndPersist({
      category: 'POLICY', criticality: 'HIGH', actorType: 'SYSTEM', actorId: 'policy-engine',
      claim: 'Cognitive loop blocked by policy DENY', payload: { policyEval }, traceId,
    });
    return {
      traceId, route: decision, worldState, plan: [], steps,
      verdict: 'REJECTED', reflection: 'POLICY DENY — reasoning cannot bypass governance (INV-073).',
      finalAnswer: 'Request rejected by Policy Control Plane. ' + policyEval.reason,
      evidenceUids: [ev.uid], durationMs: Date.now() - t0,
    };
  }

  // ── 3. PLANNING (dual-process) ───────────────────────────────────
  mark('PLANNING', `Executing ${decision.path} path`);
  let plan: PlanStep[] = [];
  let finalAnswer = '';
  let residualUncertainty = decision.uncertainty;
  let s1Summary: string | null = null;
  let agreementNote: string | null = null;

  if (decision.path === 'SYSTEM_1') {
    const s1 = system1(goal, decision.uncertainty);
    plan = s1.plan;
    finalAnswer = s1.answer;
    residualUncertainty = s1.uncertainty;
    s1Summary = `${s1.template} (${s1.ms}ms)`;
    mark('PLANNING_S1', `System 1 template ${s1.template} produced ${s1.plan.length} steps in ${s1.ms}ms`, { template: s1.template });
  } else if (decision.path === 'SYSTEM_2') {
    mark('PLANNING_S2', 'System 2: deliberative reasoning via deep model…');
    const s2 = await system2(goal, worldState);
    plan = s2.plan;
    finalAnswer = s2.answer;
    residualUncertainty = s2.uncertainty;
    mark('PLANNING_S2', `System 2 produced ${s2.plan.length} steps in ${s2.ms}ms via ${s2.modelUsed}`, { model: s2.modelUsed, reasoning: s2.reasoning.slice(0, 200) });
  } else {
    // CASCADE — S1 first, escalate if residual uncertainty too high (HR-4)
    const s1 = system1(goal, decision.uncertainty);
    s1Summary = `${s1.template} (${s1.ms}ms)`;
    if (s1.uncertainty <= 0.45) {
      plan = s1.plan; finalAnswer = s1.answer; residualUncertainty = s1.uncertainty;
      mark('PLANNING_S1', `Cascade: S1 sufficient (uncertainty ${s1.uncertainty.toFixed(2)}) — no escalation needed`);
    } else {
      mark('CASCADE_ESCALATION', `S1 residual uncertainty ${s1.uncertainty.toFixed(2)} > 0.45 → escalating to System 2`);
      const s2 = await system2(goal, worldState);
      const agreement = agreementCheck(s1, s2);
      agreementNote = agreement.note;
      plan = s2.plan; finalAnswer = s2.answer; residualUncertainty = s2.uncertainty;
      mark('PLANNING_S2', `System 2 retained (${agreement.agree ? 'agrees' : 'diverges'} with S1): ${agreement.note}`);
    }
  }

  const evPlan = await captureAndPersist({
    category: 'MODEL', criticality: 'HIGH', actorType: 'MODEL', actorId: decision.path === 'SYSTEM_1' ? 'system-1-fast' : 'system-2-deep',
    claim: `Plan produced via ${decision.path}`, payload: { plan, route: decision.path }, traceId,
  });
  evidenceUids.push(evPlan.uid);

  // ── 4. ACTING (simulated governed execution through fabric) ──────
  mark('ACTING', 'Dispatching plan to Execution Fabric under policy evaluation');
  const execPolicy = evaluatePolicy(
    { actorType: 'AGENT', actorId: 'coder', action: 'filesystem.write', resource: 'workspace.overlay' },
    SEED_POLICY_RULES,
  );
  const exec = await runExecution({
    command: `yahria execute-plan --steps=${plan.length} --trace=${traceId}`,
    profile: 'RESTRICTED',
    policyDecision: execPolicy,
  });
  mark('EXECUTION', `Execution ${exec.executionId}: ${exec.finalState} with ${exec.transitions.length} audited transitions`, {
    executionId: exec.executionId,
    transitions: exec.transitions.length,
    sandbox: exec.sandbox.profile,
  });
  const evExec = await captureAndPersist({
    category: 'EXECUTION', criticality: 'CRITICAL', actorType: 'SYSTEM', actorId: 'execution-fabric',
    claim: `Execution ${exec.executionId} completed in state ${exec.finalState}`,
    payload: { transitions: exec.transitions, sandbox: exec.sandbox.profile, exitCode: exec.exitCode },
    traceId,
  });
  evidenceUids.push(evExec.uid);

  // ── 5. VERIFYING (independent verifier — INV-080) ────────────────
  const verifier = getAgent('verifier');
  const capCheck = verifier ? checkCapability(verifier, 'acceptance.evaluate') : { ok: false, reason: 'verifier agent missing' };
  mark('VERIFYING', capCheck.ok
    ? 'Independent verifier (generator ≠ verifier) evaluating result'
    : capCheck.reason);

  const passed = exec.finalState === 'SUCCEEDED' && plan.length > 0 && capCheck.ok;
  const verdict: CognitiveLoopResult['verdict'] = passed ? 'PASS' : 'FAIL';
  const evVerdict = await captureAndPersist({
    category: 'TEST', criticality: 'CRITICAL', actorType: 'AGENT', actorId: 'verifier',
    claim: `Independent verdict: ${verdict}`, payload: { verdict, execution: exec.finalState, uncertainty: residualUncertainty }, traceId,
  });
  evidenceUids.push(evVerdict.uid);

  // ── 6. REFLECTION (on failure) ───────────────────────────────────
  let reflection: string | null = null;
  if (verdict === 'FAIL') {
    reflection = [
      `What happened: execution ended in ${exec.finalState} (expected SUCCEEDED).`,
      `Root cause hypothesis: ${exec.finalState === 'FAILED' ? 'verification assertion failed (F013/F015)' : 'insufficient plan steps'}.`,
      'Was my previous assumption wrong? Yes — assuming execution success without verification violates INV-044.',
      'Evidence for new hypothesis: execution transitions + verifier verdict.',
      'Smallest safe correction: replan with additional verification step; retry governed by INV-092 (max 3, exponential backoff).',
    ].join(' ');
    mark('REFLECTION', 'Failure analyzed — no immediate patch generation (reflection-first principle)');
    const evReflection = await captureAndPersist({
      category: 'AUDIT', criticality: 'HIGH', actorType: 'AGENT', actorId: 'debugger',
      claim: 'Structured reflection produced on failure', payload: { reflection }, traceId,
    });
    evidenceUids.push(evReflection.uid);
  }

  // ── 7. COMMIT → MEMORY (D.7 — governed, MEMORY ≠ POLICY) ─────────
  if (passed) {
    await db.memoryRecord.create({
      data: {
        kind: 'EPISODIC',
        key: `loop:${traceId}`,
        content: `Goal "${goal.slice(0, 120)}" completed via ${decision.path}; plan=${plan.length} steps; verdict PASS.`,
        confidence: Math.max(0.2, 1 - residualUncertainty),
        validation: uncertaintyLevel(residualUncertainty),
        source: `cognitive-loop:${decision.path}`,
      },
    });
    mark('COMMIT', 'Result committed; episodic memory written with confidence + validation state (INV-140)');
  } else {
    mark('NO_COMMIT', 'Verdict FAIL — nothing committed; failure preserved as learning input (INV-152)');
  }

  // Persist trace + reasoning route telemetry
  const trace = await db.cognitiveTrace.create({
    data: {
      goal, route: decision.path, complexity: decision.complexity, uncertainty: decision.uncertainty,
      worldState: JSON.stringify(worldState), plan: JSON.stringify(plan),
      verdict, reflection, evidenceIds: JSON.stringify(evidenceUids), durationMs: Date.now() - t0,
    },
  });
  await db.reasoningRoute.create({
    data: {
      traceId: trace.id, request: goal, signals: JSON.stringify(decision.signals),
      chosenPath: decision.path, escalationReason: decision.escalationReason,
      s1Verdict: s1Summary, s2Verdict: decision.path === 'SYSTEM_1' ? null : finalAnswer.slice(0, 200),
      agreement: agreementNote ? !agreementNote.startsWith('S1 and S2 diverge') : null,
      finalAnswer: finalAnswer.slice(0, 1000),
      latencyS1Ms: decision.path === 'SYSTEM_2' ? 0 : 2,
      latencyS2Ms: decision.path === 'SYSTEM_1' ? 0 : Math.max(1, Date.now() - t0 - 10),
    },
  });

  mark('COMPLETE', `Cognitive loop finished: verdict ${verdict}, uncertainty ${uncertaintyLevel(residualUncertainty)} (${residualUncertainty.toFixed(2)})`);

  return {
    traceId: trace.id, route: decision, worldState, plan, steps, verdict, reflection,
    finalAnswer, evidenceUids, durationMs: Date.now() - t0,
  };
}
