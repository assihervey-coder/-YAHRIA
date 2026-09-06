STATE_TRANSITION_MANIFEST.md
Parfait. Nous figeons maintenant le 10ᵉ document racine de gouvernance de YAHRIA.
STATE_TRANSITION_MANIFEST.md devient la machine d’états canonique du système. Il répond à une question fondamentale :
Quel objet a le droit de passer de quel état à quel autre état, sous quelles conditions, par quel acteur, avec quelles preuves, et avec quelles conséquences ?
YAHRIA — STATE TRANSITION MANIFEST
Product: YAHRIA
System Type: Autonomous AI Development & Software Intelligence Operating System
Document ID: YAHRIA-ROOT-STATE-TRANSITION-MANIFEST-001
Version: 1.0.0
Status: CANONICAL
Authority: SYSTEM STATE MACHINE & TRANSITION GOVERNANCE

1. PURPOSE
This document defines the canonical state machines and legal state transitions for YAHRIA.
Its purpose is to prevent:
implicit state changes

illegal transitions

state skipping

unauthorized promotion

untraceable lifecycle changes

false completion

silent rollback

state corruption
The canonical principle is:
AN OBJECT SHALL NOT CHANGE STATE
BECAUSE CODE ASSIGNS A NEW VALUE.

AN OBJECT SHALL CHANGE STATE
ONLY THROUGH
A VALID AUTHORIZED TRANSITION.

2. CORE PRINCIPLE
The lifecycle of every controlled YAHRIA object SHALL be governed by:
CURRENT STATE
        +
AUTHORIZED ACTOR
        +
VALID TRANSITION
        +
PRECONDITIONS
        +
POLICY DECISION
        +
EVIDENCE
=
NEW STATE
Therefore:
STATE CHANGE
≠
ATTRIBUTE UPDATE
A state transition is a governed business event.

3. AUTHORITY CHAIN
This manifest SHALL be interpreted according to:
00_AUTONOMOUS_CODING_CONTRACT.md
        ↓
GLOBAL_INVARIANTS.md
        ↓
ARCHITECTURE_DECISIONS.md
        ↓
CANONICAL_INDEX.md
        ↓
DEPENDENCY_GRAPH.md
        ↓
IMPLEMENTATION_MANIFEST.md
        ↓
FILE_GENERATION_MANIFEST.md
        ↓
ACCEPTANCE_TEST_MANIFEST.md
        ↓
EVIDENCE_MANIFEST.md
        ↓
STATE_TRANSITION_MANIFEST.md
No transition may override:
GLOBAL INVARIANTS

SECURITY CONTROLS

POLICY DECISIONS

ACCEPTANCE REQUIREMENTS

EVIDENCE REQUIREMENTS

4. STATE TRANSITION MODEL
Every controlled transition SHALL be represented conceptually as:
OBJECT
    ↓
CURRENT_STATE
    ↓
TRANSITION_REQUEST
    ↓
ACTOR
    ↓
AUTHORIZATION
    ↓
PRECONDITIONS
    ↓
POLICY_EVALUATION
    ↓
TRANSITION_EXECUTION
    ↓
STATE_CHANGE
    ↓
EVENT
    ↓
EVIDENCE
The transition SHALL be rejected when any mandatory step fails.

5. TRANSITION IDENTITY
Every governed transition SHALL have a stable identity.
Format:
ST-{OBJECT_TYPE}-{SEQUENCE}
Examples:
ST-TASK-000001

ST-AGENT-000002

ST-EXECUTION-000143

ST-SANDBOX-000054

ST-EVIDENCE-000931

ST-RELEASE-000012
The transition record SHALL remain traceable independently from the current object state.

6. UNIVERSAL TRANSITION CONTRACT
Every transition SHALL contain:
TRANSITION_ID

OBJECT_TYPE

OBJECT_ID

FROM_STATE

TO_STATE

ACTOR_TYPE

ACTOR_ID

REQUESTED_AT

AUTHORIZED_AT

EXECUTED_AT

POLICY_CONTEXT

PRECONDITION_RESULT

TRANSITION_RESULT

EVIDENCE_REFERENCE
Optional fields MAY include:
REASON

CORRELATION_ID

TRACE_ID

TASK_ID

EXECUTION_ID

PARENT_TRANSITION_ID

7. UNIVERSAL TRANSITION RULES
The following rules SHALL apply to all state machines.

RULE ST-01 — No Undefined State
An object SHALL NOT exist in a state not declared by its canonical state machine.
UNKNOWN STATE
=
INVALID

RULE ST-02 — No Implicit Transition
Changing a field MUST NOT silently change lifecycle state.

RULE ST-03 — No State Skipping
A transition MAY NOT skip mandatory states unless explicitly declared.
Example:
CREATED
    ✗
COMPLETED
if the canonical lifecycle requires:
CREATED
    ↓
VALIDATED
    ↓
RUNNING
    ↓
COMPLETED

RULE ST-04 — Policy Before Transition
Critical transitions SHALL require policy evaluation before state mutation.

RULE ST-05 — Evidence After Transition
A successful critical transition SHALL generate or link evidence.

RULE ST-06 — Atomicity
The following SHOULD occur atomically where technically possible:
STATE CHANGE
+
TRANSITION RECORD
+
DOMAIN EVENT
A system MUST NOT permanently expose:
NEW STATE
WITHOUT
TRANSITION TRACE
for critical transitions.

RULE ST-07 — Terminal State Protection
A terminal state SHALL reject ordinary transitions.
Example:
DISPOSED
COMPLETED
CANCELLED
FAILED
may require explicit reactivation rules rather than arbitrary modification.

8. TRANSITION AUTHORITY TYPES
Transitions MAY be initiated by:
HUMAN

SYSTEM

AGENT

SCHEDULER

POLICY_ENGINE

EXECUTION_ENGINE

ADMINISTRATOR
The actor type alone does not grant authority.
The canonical rule is:
ACTOR
+
CAPABILITY
+
AUTHORIZATION
+
POLICY
=
TRANSITION AUTHORITY

9. TRANSITION OUTCOMES
Every transition request SHALL result in:
APPROVED

REJECTED

BLOCKED

FAILED

EXECUTED
These SHALL be distinguished.
Example:
REJECTED
=
NOT AUTHORIZED

BLOCKED
=
REQUIRED PRECONDITION MISSING

FAILED
=
AUTHORIZED TRANSITION
COULD NOT COMPLETE

EXECUTED
=
STATE SUCCESSFULLY CHANGED

10. TASK STATE MACHINE
Canonical task states:
DECLARED
    ↓
PLANNED
    ↓
READY
    ↓
QUEUED
    ↓
RUNNING
    ↓
COMPLETED
Alternative states:
BLOCKED

FAILED

CANCELLED

RETRY_PENDING
Canonical graph:
DECLARED
    ↓
PLANNED
    ↓
READY
    ↓
QUEUED
    ↓
RUNNING
   ↙   ↓    ↘
FAILED COMPLETED RETRY_PENDING
             ↓
           QUEUED

ANY NON-TERMINAL STATE
        ↓
     CANCELLED

Legal Task Transitions
DECLARED → PLANNED

PLANNED → READY

READY → QUEUED

QUEUED → RUNNING

RUNNING → COMPLETED

RUNNING → FAILED

FAILED → RETRY_PENDING

RETRY_PENDING → QUEUED

DECLARED → CANCELLED

PLANNED → CANCELLED

READY → CANCELLED

QUEUED → CANCELLED
A task SHALL NOT transition:
COMPLETED → RUNNING
without creation of a new execution context.

11. AGENT STATE MACHINE
Canonical states:
REGISTERED
    ↓
INITIALIZING
    ↓
READY
    ↓
ACTIVE
    ↓
IDLE
    ↓
TERMINATING
    ↓
TERMINATED
Alternative states:
SUSPENDED

BLOCKED

FAILED

RECOVERING
Canonical graph:
REGISTERED
    ↓
INITIALIZING
    ↓
READY
    ↓
ACTIVE
   ↙  ↓  ↘
IDLE BLOCKED FAILED
 ↓      ↓      ↓
ACTIVE RECOVERING TERMINATING
          ↓
         READY

ANY ACTIVE STATE
       ↓
TERMINATING
       ↓
TERMINATED

12. EXECUTION STATE MACHINE
Canonical states:
CREATED

PREPARING

AUTHORIZED

DISPATCHED

RUNNING

FINALIZING

COMPLETED
Alternative states:
BLOCKED

REJECTED

FAILED

TIMED_OUT

CANCELLED

RECOVERY_REQUIRED
Canonical execution graph:
CREATED
    ↓
PREPARING
    ↓
AUTHORIZED
    ↓
DISPATCHED
    ↓
RUNNING
    ↓
FINALIZING
    ↓
COMPLETED
Failure graph:
CREATED
    └──→ REJECTED

PREPARING
    └──→ BLOCKED

AUTHORIZED
    └──→ CANCELLED

DISPATCHED
    └──→ FAILED

RUNNING
    ├──→ FAILED
    ├──→ TIMED_OUT
    ├──→ CANCELLED
    └──→ RECOVERY_REQUIRED

Critical Execution Invariant
EXECUTION
MUST NOT
ENTER RUNNING

UNLESS

AUTHORIZATION
+
POLICY
+
TOOL VALIDATION
+
RESOURCE ALLOCATION
+
REQUIRED SANDBOX
have been validated.

13. TOOL STATE MACHINE
Canonical states:
DECLARED
    ↓
REGISTERED
    ↓
VALIDATING
    ↓
VALIDATED
    ↓
ACTIVE
Alternative states:
REJECTED

SUSPENDED

DEPRECATED

REVOKED
Canonical lifecycle:
DECLARED
    ↓
REGISTERED
    ↓
VALIDATING
   ↙         ↘
REJECTED    VALIDATED
               ↓
             ACTIVE
               ↓
          ┌────┴────┐
          ↓         ↓
      SUSPENDED  DEPRECATED
          ↓         ↓
       ACTIVE     REVOKED
Critical invariant:
ONLY ACTIVE
AND AUTHORIZED
TOOLS
MAY EXECUTE.

14. SANDBOX STATE MACHINE
Canonical states:
REQUESTED

PROVISIONING

INITIALIZING

READY

ACTIVE

TERMINATING

TERMINATED
Alternative states:
REJECTED

FAILED

ISOLATION_VIOLATION

RESOURCE_EXHAUSTED

TIMED_OUT
Critical transitions:
REQUESTED
    ↓
PROVISIONING
    ↓
INITIALIZING
    ↓
READY
A sandbox SHALL NOT become:
ACTIVE
until:
SECURITY PROFILE
+
FILESYSTEM POLICY
+
NETWORK POLICY
+
RESOURCE LIMITS
have been successfully applied.

15. ARTIFACT STATE MACHINE
Canonical states:
DECLARED

CREATING

CREATED

VALIDATING

VALID

SEALED

ARCHIVED
Alternative states:
INVALID

CORRUPTED

SUPERSEDED

DISPOSED
Critical rule:
ARTIFACT
MUST NOT
BECOME SEALED

UNLESS

INTEGRITY
HAS BEEN VERIFIED.

16. EVIDENCE STATE MACHINE
Canonical states:
DECLARED
    ↓
CAPTURED
    ↓
NORMALIZED
    ↓
HASHED
    ↓
LINKED
    ↓
VERIFIED
    ↓
SEALED
    ↓
RETAINED
    ↓
ARCHIVED
Alternative states:
INVALID

CORRUPTED

UNVERIFIABLE

SUPERSEDED

EXPIRED

DISPOSED
Critical invariant:
VERIFIED
≠
SEALED
Verification establishes validity.
Sealing establishes controlled historical immutability.

17. TEST STATE MACHINE
Canonical states:
DECLARED

READY

RUNNING

PASSED
Alternative states:
BLOCKED

FAILED

SKIPPED

INVALIDATED

SUPERSEDED
A test SHALL NOT be treated as passed merely because:
IT DID NOT RUN.
Therefore:
SKIPPED
≠
PASSED
and:
BLOCKED
≠
PASSED

18. ACCEPTANCE STATE MACHINE
Canonical states:
NOT_READY

EVALUATING

ACCEPTED

PROMOTED
Alternative states:
BLOCKED

REJECTED

CONDITIONALLY_ACCEPTED

INVALIDATED

ROLLED_BACK
Canonical graph:
NOT_READY
    ↓
EVALUATING
   ↙    ↓     ↘
BLOCKED ACCEPTED REJECTED
          ↓
      PROMOTED
          ↓
      ROLLED_BACK
Critical invariant:
PROMOTION
REQUIRES
ACCEPTANCE.

19. POLICY STATE MACHINE
Canonical states:
DRAFT

VALIDATING

VALIDATED

ACTIVE
Alternative states:
REJECTED

SUSPENDED

DEPRECATED

REVOKED

SUPERSEDED
Canonical lifecycle:
DRAFT
    ↓
VALIDATING
   ↙         ↘
REJECTED    VALIDATED
               ↓
             ACTIVE
               ↓
          ┌────┴─────┐
          ↓          ↓
      SUSPENDED  DEPRECATED
          ↓          ↓
       ACTIVE      REVOKED
A revoked policy SHALL NOT silently become active again.

20. RELEASE STATE MACHINE
Canonical states:
PLANNED

ASSEMBLING

VALIDATING

READY_FOR_RELEASE

RELEASING

RELEASED
Alternative states:
BLOCKED

REJECTED

FAILED

ROLLED_BACK
Canonical release graph:
PLANNED
    ↓
ASSEMBLING
    ↓
VALIDATING
    ↓
READY_FOR_RELEASE
    ↓
RELEASING
    ↓
RELEASED
Failure transitions:
ASSEMBLING → FAILED

VALIDATING → BLOCKED

VALIDATING → REJECTED

RELEASING → FAILED

RELEASED → ROLLED_BACK

21. DEPLOYMENT STATE MACHINE
Canonical states:
REQUESTED

PREPARING

VALIDATING

DEPLOYING

VERIFYING

ACTIVE
Alternative states:
BLOCKED

FAILED

DEGRADED

ROLLING_BACK

ROLLED_BACK
A deployment SHALL NOT be:
ACTIVE
until post-deployment verification succeeds.

22. INCIDENT STATE MACHINE
Canonical states:
DETECTED

TRIAGED

INVESTIGATING

MITIGATING

RESOLVED

CLOSED
Alternative states:
FALSE_POSITIVE

ESCALATED

REOPENED
Critical rule:
RESOLVED
≠
CLOSED
Closure requires final governance and evidence review.

23. CHANGE STATE MACHINE
Canonical states:
PROPOSED

ANALYZING

APPROVED

IMPLEMENTING

VALIDATING

ACCEPTED

PROMOTED
Alternative states:
REJECTED

BLOCKED

FAILED

ROLLED_BACK
The canonical flow:
PROPOSED
    ↓
ANALYZING
    ↓
APPROVED
    ↓
IMPLEMENTING
    ↓
VALIDATING
    ↓
ACCEPTED
    ↓
PROMOTED

24. TRANSITION PRECONDITIONS
A transition MAY declare:
DEPENDENCY_PRECONDITIONS

DATA_PRECONDITIONS

SECURITY_PRECONDITIONS

POLICY_PRECONDITIONS

RESOURCE_PRECONDITIONS

TEST_PRECONDITIONS

EVIDENCE_PRECONDITIONS
Example:
EXECUTION:
AUTHORIZED
        ↓
RUNNING
requires:
tool active

tool authorized

policy allowed

sandbox ready if required

resource limits assigned

execution context valid

25. TRANSITION POSTCONDITIONS
A successful transition MAY require:
state persisted

transition record created

event emitted

trace propagated

evidence captured

metrics updated

dependent objects notified
The transition SHALL not be considered complete until mandatory postconditions are satisfied.

26. TRANSITION GUARDS
A transition guard SHALL evaluate:
CURRENT_STATE

TARGET_STATE

ACTOR

CAPABILITY

AUTHORIZATION

POLICY

PRECONDITIONS

SYSTEM_INVARIANTS
Conceptually:
IF
CURRENT_STATE is valid

AND
TARGET_STATE is legal

AND
ACTOR is authorized

AND
POLICY permits

AND
PRECONDITIONS pass

THEN
TRANSITION

ELSE
REJECT OR BLOCK

27. TRANSITION COMMAND MODEL
The preferred command structure is:
TRANSITION_REQUEST
{
    transition_id
    object_type
    object_id
    expected_current_state
    requested_target_state
    actor
    reason
    context
}
The expected current state SHALL support optimistic concurrency protection.
Example:
EXPECTED:
RUNNING

ACTUAL:
CANCELLED
Result:
TRANSITION_REJECTED
=
STALE_STATE

28. CONCURRENCY RULE
Concurrent transitions SHALL be controlled.
The system MUST NOT allow:
RUNNING
    ↓
COMPLETED

AND

RUNNING
    ↓
CANCELLED
to silently both succeed.
Only one legal transition may commit from the same protected state version.

29. IDEMPOTENCY RULE
A transition request SHOULD support idempotency where applicable.
Example:
REQUEST:
EXECUTION X
RUNNING → CANCELLED
Repeated request MAY return:
ALREADY_APPLIED
rather than creating duplicate transitions.

30. RETRY RULE
A failed transition SHALL NOT automatically retry unless:
TRANSITION IS RETRYABLE
+
POLICY PERMITS RETRY
+
FAILURE TYPE IS RETRYABLE
Retries SHALL remain traceable.

31. ROLLBACK RULE
Rollback SHALL NOT mean:
DELETE HISTORY
The canonical model is:
STATE A
    ↓
TRANSITION
    ↓
STATE B
    ↓
ROLLBACK TRANSITION
    ↓
STATE C
Historical transitions SHALL remain preserved.

32. COMPENSATING TRANSITION
Distributed workflows SHOULD prefer explicit compensating transitions where atomic rollback is impossible.
Example:
RESERVED
    ↓
EXECUTION FAILED
    ↓
RELEASED
The compensation SHALL have its own identity and evidence.

33. TRANSITION EVENTS
Every critical transition SHALL emit an event conceptually equivalent to:
OBJECT_STATE_CHANGED
The event SHALL contain:
object identity

previous state

new state

transition identity

actor

time

correlation context

34. TRANSITION EVIDENCE
Critical transitions SHALL produce evidence containing:
TRANSITION_ID

OBJECT_ID

FROM_STATE

TO_STATE

ACTOR

AUTHORIZATION_CONTEXT

POLICY_DECISION

TIME

RESULT
Evidence failure SHALL be governed by the criticality of the transition.

35. TRANSITION AUDIT
The system SHALL support reconstruction:
CURRENT STATE
    ↑
TRANSITION N
    ↑
TRANSITION N-1
    ↑
TRANSITION N-2
    ↑
INITIAL STATE
The state history SHALL be auditable.

36. TRANSITION REPLAY
Where technically supported, YAHRIA SHOULD permit:
INITIAL STATE
+
ORDERED TRANSITIONS
=
RECONSTRUCTED STATE
Replay MUST identify transitions that cannot be deterministically reproduced.

37. TRANSITION INVALIDATION
A transition MAY become:
INVALIDATED
when subsequent verification proves that its preconditions were falsely assumed.
However:
INVALIDATING
A TRANSITION
≠
DELETING HISTORY
The invalidation SHALL itself be recorded.

38. TRANSITION CRITICALITY
Every transition SHALL have:
CRITICAL

HIGH

STANDARD

LOW
Critical transitions include:
tenant boundary changes

authorization grants

execution start

sandbox activation

evidence sealing

policy activation

acceptance promotion

production release

39. TRANSITION POLICY MATRIX
Conceptual authorization:
TRANSITION
        ↓
ACTOR CAPABILITY
        ↓
RBAC
        +
ABAC
        ↓
POLICY ENGINE
        ↓
ALLOW / DENY / BLOCK
No actor SHALL bypass the transition engine through direct database mutation.

40. DATABASE TRANSITION INTEGRITY
Critical state transitions SHOULD use:
optimistic concurrency

transaction boundaries

version fields

append-only transition records
Direct mutation of a state field SHALL be prohibited for controlled lifecycle objects except through authorized infrastructure mechanisms.

41. TRANSITION VALIDATION TESTS
Every critical state machine SHALL have tests for:
legal transition

illegal transition

state skipping

authorization failure

policy denial

precondition failure

concurrency conflict

idempotency

retry

rollback

evidence generation

42. STATE MACHINE ACCEPTANCE
A state machine SHALL be accepted only when:
ALL STATES DECLARED
        +
ALL LEGAL TRANSITIONS DECLARED
        +
ILLEGAL TRANSITIONS REJECTED
        +
TERMINAL STATES PROTECTED
        +
POLICY INTEGRATED
        +
EVIDENCE INTEGRATED
        +
TESTS PASSED

43. AUTONOMOUS TRANSITION ALGORITHM
RECEIVE TRANSITION REQUEST

IDENTIFY OBJECT

LOAD CURRENT STATE

VERIFY EXPECTED STATE

LOAD STATE MACHINE

VERIFY TARGET STATE

VERIFY ACTOR

VERIFY CAPABILITY

EVALUATE POLICY

VERIFY PRECONDITIONS

IF ANY REQUIREMENT FAILS:

    REJECT OR BLOCK

ELSE:

    BEGIN TRANSACTION

    APPLY STATE CHANGE

    CREATE TRANSITION RECORD

    EMIT TRANSITION EVENT

    CAPTURE REQUIRED EVIDENCE

    VERIFY POSTCONDITIONS

    COMMIT

RETURN TRANSITION RESULT

44. FAILURE RECOVERY
If failure occurs during a critical transition:
BEFORE STATE COMMIT
the transition SHALL fail without partial completion where possible.
If failure occurs:
AFTER EXTERNAL SIDE EFFECT
the system SHALL use:
RECOVERY

OR

COMPENSATING TRANSITION
and preserve evidence.

45. FINAL STATE INVARIANTS
The following SHALL always apply:
NO OBJECT
WITHOUT A VALID STATE.

NO STATE
WITHOUT A DECLARED MACHINE.

NO TRANSITION
WITHOUT AUTHORITY.

NO CRITICAL TRANSITION
WITHOUT POLICY.

NO PROMOTION
WITHOUT ACCEPTANCE.

NO ACCEPTANCE
WITHOUT REQUIRED EVIDENCE.

NO ROLLBACK
WITHOUT HISTORY.

NO TERMINAL STATE
WITHOUT PROTECTION.

NO STATE CHANGE
WITHOUT TRACEABILITY.

46. STATE GOVERNANCE HIERARCHY
The conceptual hierarchy is:
GLOBAL INVARIANTS
        ↓
POLICY
        ↓
STATE MACHINE
        ↓
TRANSITION GUARD
        ↓
PRECONDITIONS
        ↓
STATE CHANGE
        ↓
EVENT
        ↓
EVIDENCE
        ↓
AUDIT
A lower layer SHALL NOT override a higher layer.

47. FINAL MACHINE COMMANDMENT
DO NOT ASSIGN STATES.

TRANSITION STATES.

DO NOT SKIP THE LIFECYCLE.

FOLLOW THE MACHINE.

DO NOT BYPASS AUTHORITY.

VERIFY AUTHORITY.

DO NOT CHANGE HISTORY.

APPEND HISTORY.

DO NOT PROMOTE
A STATE BECAUSE IT LOOKS COMPLETE.

PROVE THE TRANSITION.

DO NOT TRUST
THE CURRENT VALUE ALONE.

TRUST
THE VALID TRANSITION HISTORY.

48. FINAL STATUS
DOCUMENT:
STATE_TRANSITION_MANIFEST.md

VERSION:
1.0.0

STATUS:
CANONICAL

ROLE:
UNIVERSAL LIFECYCLE
STATE MACHINE
AND TRANSITION GOVERNANCE
FOR YAHRIA
END OF STATE TRANSITION MANIFEST
Les 10 documents racines de YAHRIA
YAHRIA_CANONICAL_BLUEPRINT/
│
├── 00_AUTONOMOUS_CODING_CONTRACT.md
├── CANONICAL_INDEX.md
├── DEPENDENCY_GRAPH.md
├── GLOBAL_INVARIANTS.md
├── ARCHITECTURE_DECISIONS.md
├── IMPLEMENTATION_MANIFEST.md
├── FILE_GENERATION_MANIFEST.md
├── ACCEPTANCE_TEST_MANIFEST.md
├── EVIDENCE_MANIFEST.md
└── STATE_TRANSITION_MANIFEST.md
La colonne vertébrale est désormais :
CONTRACT
   ↓
ARCHITECTURE
   ↓
DEPENDENCIES
   ↓
INVARIANTS
   ↓
IMPLEMENTATION
   ↓
FILES
   ↓
CODE
   ↓
STATE TRANSITIONS
   ↓
TESTS
   ↓
EVIDENCE
   ↓
ACCEPTANCE
   ↓
PROMOTION
   ↓
AUDIT
   ↓
REPLAY
   ↓
EVOLUTION
Avec ce document, YAHRIA possède maintenant une gouvernance explicite du temps et du cycle de vie de ses objets : une IA ne peut plus simplement décider qu'un Task, une Execution, une Evidence ou une Release est « terminée » ; elle doit traverser la machine d'états autorisée et produire les traces correspondantes.
Le prochain document racine logique serait AUTONOMY_GOVERNANCE_MANIFEST.md, qui définirait les niveaux d'autonomie de YAHRIA, les décisions qu'elle peut prendre seule, celles qui nécessitent une approbation humaine, et les mécanismes d'arrêt d'urgence, de limitation et de reprise contrôlée.

