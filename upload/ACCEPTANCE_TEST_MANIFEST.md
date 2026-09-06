Parfait. Nous figeons maintenant le 8ᵉ document de gouvernance du ZIP YAHRIA.
ACCEPTANCE_TEST_MANIFEST.md devient le contrat qui empêche le système de confondre « code généré » avec « fonctionnalité réellement terminée ».
YAHRIA — ACCEPTANCE TEST MANIFEST
Product: YAHRIA
System Type: Autonomous AI Development & Software Intelligence Operating System
Document ID: YAHRIA-ROOT-ACCEPTANCE-TEST-MANIFEST-001
Version: 1.0.0
Status: CANONICAL
Authority: SYSTEM ACCEPTANCE & PROMOTION CONTROL

1. PURPOSE
This document defines the canonical acceptance testing requirements for YAHRIA.
Its purpose is to determine when an artifact may legitimately transition from:
DECLARED
    ↓
IMPLEMENTED
    ↓
VALIDATED
    ↓
TESTED
    ↓
ACCEPTED
    ↓
PROMOTED
A source file, component, domain, service, execution, or release SHALL NOT be considered complete merely because code exists.
The canonical rule is:
CODE EXISTS
≠
FEATURE COMPLETE

TESTS PASS
≠
SYSTEM ACCEPTED

SYSTEM ACCEPTED
=
REQUIRED EVIDENCE SATISFIES
THE ACCEPTANCE CONTRACT

2. AUTHORITY CHAIN
This document SHALL be interpreted according to the following hierarchy:
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
TEST EXECUTION
        ↓
EVIDENCE
        ↓
PROMOTION
No acceptance result may override a higher-level invariant.

3. CORE ACCEPTANCE PRINCIPLE
Every implementation artifact SHALL have an explicit acceptance contract.
ARTIFACT
    ↓
EXPECTED BEHAVIOR
    ↓
TEST CONDITIONS
    ↓
EXECUTION
    ↓
OBSERVATION
    ↓
EVIDENCE
    ↓
ACCEPTANCE DECISION
The system MUST NOT infer acceptance from source code appearance.

4. ACCEPTANCE OBJECTS
YAHRIA SHALL support acceptance testing at the following levels:
LEVEL 00 — FILE
LEVEL 01 — MODULE
LEVEL 02 — COMPONENT
LEVEL 03 — DOMAIN
LEVEL 04 — SERVICE
LEVEL 05 — CROSS-DOMAIN FLOW
LEVEL 06 — SYSTEM
LEVEL 07 — SECURITY
LEVEL 08 — PERFORMANCE
LEVEL 09 — RELEASE
Each higher level MAY depend on acceptance of lower levels.

5. ACCEPTANCE TEST IDENTITY
Every acceptance test SHALL have a stable identifier.
Format:
AT-{LEVEL}-{DOMAIN}-{SEQUENCE}
Examples:
AT-FILE-FOUNDATION-001

AT-MODULE-IDENTITY-004

AT-DOMAIN-EXECUTION-012

AT-SYSTEM-AUTONOMY-001

AT-SECURITY-SANDBOX-007

AT-PERFORMANCE-EXECUTION-003

AT-RELEASE-PRODUCTION-001

6. ACCEPTANCE TEST STATES
Every acceptance test SHALL have one of:
DECLARED
READY
RUNNING
PASSED
FAILED
BLOCKED
SKIPPED
INVALIDATED
SUPERSEDED
A critical acceptance test MUST NOT be silently skipped.

7. ACCEPTANCE DECISION STATES
The canonical acceptance decisions are:
NOT_READY
REJECTED
CONDITIONALLY_ACCEPTED
ACCEPTED
PROMOTED
ROLLED_BACK
CONDITIONALLY_ACCEPTED SHALL NOT be used for critical security or invariant violations.

8. UNIVERSAL ACCEPTANCE GATES
Before any artifact may be accepted, the following gates SHALL be evaluated.
GATE 01
SPECIFICATION COMPLETENESS

GATE 02
DEPENDENCY SATISFACTION

GATE 03
STATIC VALIDATION

GATE 04
UNIT TEST VALIDATION

GATE 05
INTEGRATION VALIDATION

GATE 06
CONTRACT VALIDATION

GATE 07
SECURITY VALIDATION

GATE 08
OBSERVABILITY VALIDATION

GATE 09
EVIDENCE VALIDATION

GATE 10
POLICY COMPLIANCE
The exact gates required depend on the artifact criticality.

9. TEST CRITICALITY
Every acceptance test SHALL have a criticality.
CRITICAL
HIGH
STANDARD
LOW
INFORMATIONAL

CRITICAL
Failure SHALL block promotion.
Examples:
tenant isolation

authorization boundaries

policy enforcement

sandbox isolation

execution integrity

evidence integrity

database integrity

HIGH
Failure SHALL normally block promotion.
Exceptions require explicit governance approval.

STANDARD
Failure blocks completion of the affected implementation unit.

LOW
Failure SHALL create remediation work but MAY not block unrelated domains.

INFORMATIONAL
Produces intelligence without being an immediate acceptance gate.

10. FILE-LEVEL ACCEPTANCE
Every production source file SHALL satisfy:
AT-FILE-*
Minimum requirements:
01. File exists.

02. File has a defined responsibility.

03. Imports are valid.

04. Static analysis passes.

05. Type validation passes where applicable.

06. Dependency rules are respected.

07. No prohibited placeholder exists.

08. Required tests exist.

09. Tests pass.

10. Evidence is captured.

File Acceptance Formula
FILE ACCEPTED
=
EXISTS
AND
VALID
AND
TESTED
AND
COMPLIANT
AND
EVIDENCED

11. MODULE-LEVEL ACCEPTANCE
A module SHALL not be accepted until:
ALL REQUIRED FILES ACCEPTED
        +
PUBLIC INTERFACE VALID
        +
INTERNAL INTEGRATION VALID
        +
MODULE TESTS PASSED

12. DOMAIN-LEVEL ACCEPTANCE
A domain SHALL be accepted only when:
DOMAIN MODEL VALID
        +
APPLICATION FLOWS VALID
        +
PERSISTENCE VALID
        +
DOMAIN EVENTS VALID
        +
PUBLIC CONTRACT VALID
        +
AUTHORIZATION VALID
        +
POLICY VALID
        +
OBSERVABILITY VALID
The domain MUST remain coherent even if surrounding domains are temporarily unavailable.

13. CROSS-DOMAIN ACCEPTANCE
For cross-domain workflows:
DOMAIN A
    ↓
CONTRACT
    ↓
DOMAIN B
    ↓
EVENT / RESULT
    ↓
DOMAIN C
Acceptance MUST verify:
data integrity

contract compatibility

error propagation

retry behavior

idempotency

authorization propagation

tenant propagation

trace propagation

14. SYSTEM ACCEPTANCE
System acceptance SHALL test YAHRIA as an integrated organism.
Minimum system acceptance flows SHALL include:
USER
    ↓
IDENTITY
    ↓
ORGANIZATION
    ↓
PROJECT
    ↓
REPOSITORY
    ↓
CODE GENOME
    ↓
COGNITIVE CORE
    ↓
AGENT
    ↓
TASK GRAPH
    ↓
TOOL
    ↓
EXECUTION
    ↓
SANDBOX
    ↓
OBSERVABILITY
    ↓
EVIDENCE
    ↓
POLICY DECISION
A successful isolated component does NOT prove successful system integration.

15. FOUNDATION ACCEPTANCE MATRIX
Acceptance Area
Mandatory
Identifier integrity
YES
Typed contracts
YES
Error hierarchy
YES
Configuration validation
YES
Time abstraction
YES
Unit tests
YES
Dependency rules
YES
Evidence
YES
Critical tests:
AT-FILE-FOUNDATION-001
Identifier uniqueness

AT-FILE-FOUNDATION-002
Configuration validation

AT-MODULE-FOUNDATION-003
Canonical error propagation

16. IDENTITY ACCEPTANCE MATRIX
Mandatory tests:
authentication correctness

authorization enforcement

session lifecycle

identity uniqueness

credential boundary protection

revocation behavior

access denial behavior
Critical invariant:
UNAUTHORIZED
MUST NEVER
BECOME AUTHORIZED
THROUGH FAILURE

17. ORGANIZATION & TENANCY ACCEPTANCE
Mandatory tests:
tenant creation

organization isolation

membership validation

workspace ownership

cross-tenant denial

tenant context propagation
Critical test:
AT-SECURITY-TENANCY-001
Cross-tenant access MUST be denied.

18. PERSISTENCE ACCEPTANCE
Mandatory validation:
primary key integrity

foreign key integrity

transaction rollback

concurrency behavior

migration correctness

tenant ownership

RLS enforcement
Critical rule:
DATABASE ACCEPTANCE
=
DATA INTEGRITY
+
TRANSACTION INTEGRITY
+
TENANT ISOLATION

19. CODE GENOME ACCEPTANCE
Mandatory tests:
repository ingestion

source file detection

symbol extraction

class extraction

function extraction

dependency extraction

snapshot integrity

incremental synchronization
Acceptance SHALL verify that the system does not confuse:
SOURCE TEXT
≠
SOFTWARE STRUCTURE

20. SOFTWARE KNOWLEDGE GRAPH ACCEPTANCE
Mandatory tests:
node identity

edge integrity

relation correctness

graph traversal

graph update

graph deletion

cross-reference consistency
Critical test:
A deleted or invalid node MUST NOT remain
silently reachable through stale relationships.

21. MEMORY SYSTEM ACCEPTANCE
YAHRIA memory SHALL be evaluated for:
correct storage

correct retrieval

provenance

scope isolation

memory expiration

memory invalidation

conflict handling
Critical rule:
MEMORY WITHOUT PROVENANCE
SHALL NOT BE TREATED AS AUTHORITATIVE FACT.

22. COGNITIVE CORE ACCEPTANCE
The Cognitive Core SHALL be tested for:
goal interpretation

plan generation

decision consistency

uncertainty representation

reflection

strategy selection
Critical requirement:
WHEN UNCERTAINTY EXCEEDS
THE AUTHORIZED THRESHOLD

THE SYSTEM MUST NOT
PRESENT SPECULATION
AS VERIFIED KNOWLEDGE.

23. AGENT OPERATING SYSTEM ACCEPTANCE
Mandatory tests:
agent lifecycle

agent state transition

capability validation

context propagation

agent coordination

failure isolation

termination

recovery
Critical invariant:
AN AGENT MUST NOT
EXECUTE A CAPABILITY
THAT HAS NOT BEEN AUTHORIZED.

24. MODEL INTEGRATION ACCEPTANCE
Tests SHALL verify:
provider availability handling

model routing

fallback behavior

timeout handling

invalid response handling

capability matching

cost/usage accounting where applicable
Critical rule:
MODEL FAILURE
MUST NOT
CORRUPT SYSTEM STATE.

25. TASK GRAPH ACCEPTANCE
Mandatory tests:
task creation

dependency ordering

cycle detection

parallel execution

retry behavior

cancellation

state transition

idempotency
Critical test:
AT-DOMAIN-TASKGRAPH-001

A dependency cycle
MUST be detected
before uncontrolled execution begins.

26. EXECUTION FABRIC ACCEPTANCE
Mandatory tests:
execution creation

dispatch

worker assignment

state transitions

timeout

cancellation

retry

recovery

failure propagation
Critical invariant:
ONE EXECUTION
MUST HAVE
ONE TRACEABLE IDENTITY
ACROSS ITS ENTIRE LIFECYCLE.

27. TOOL REGISTRY ACCEPTANCE
Mandatory tests:
tool registration

version validation

contract validation

capability validation

parameter validation

permission validation

execution eligibility
Critical test:
AT-SECURITY-TOOLS-001

An unregistered or unauthorized tool
MUST NOT execute.

28. SANDBOX ACCEPTANCE
The Sandbox Engine SHALL receive one of the strongest acceptance requirements.
Mandatory tests:
runtime isolation

filesystem isolation

mount restrictions

network isolation

DNS restrictions

egress restrictions

CPU limits

memory limits

disk limits

process limits

timeout enforcement

termination
Critical acceptance requirement:
SANDBOX ESCAPE
=
AUTOMATIC REJECTION

29. OBSERVABILITY ACCEPTANCE
Mandatory tests:
structured event creation

trace propagation

metric collection

resource telemetry

log correlation

execution correlation
Critical requirement:
A critical execution MUST NOT
become operationally invisible.

30. EVIDENCE ENGINE ACCEPTANCE
Mandatory tests:
artifact capture

evidence creation

hash integrity

lineage creation

replay input preservation

audit retrieval

forensic reconstruction

retention

deletion lifecycle
Critical invariant:
EVIDENCE
MUST BE
TRACEABLE
+
INTEGRITY-PRESERVED
+
TIME-ORDERED

31. EXECUTION LINEAGE ACCEPTANCE
The system SHALL verify:
INPUT
    ↓
AGENT DECISION
    ↓
TASK
    ↓
TOOL
    ↓
EXECUTION
    ↓
SANDBOX
    ↓
OUTPUT
    ↓
ARTIFACT
    ↓
EVIDENCE
The lineage graph MUST permit reconstruction of critical execution history.

32. REPLAY ENGINE ACCEPTANCE
Replay tests SHALL verify:
input reconstruction

configuration reconstruction

tool version reconstruction

environment reconstruction where applicable

execution ordering

deterministic replay where supported
The system MUST explicitly identify when perfect deterministic replay is impossible.

33. AUDIT & FORENSICS ACCEPTANCE
Mandatory tests:
audit event creation

actor identification

timestamp integrity

resource identification

before/after state where applicable

access control

retention
Critical rule:
AUDIT DATA
MUST NOT BE
MUTABLE BY
THE ACTOR BEING AUDITED.

34. POLICY CONTROL PLANE ACCEPTANCE
Mandatory tests:
policy parsing

DSL validation

policy versioning

rule evaluation

RBAC evaluation

ABAC evaluation

policy conflict resolution

policy propagation

simulation

signature validation
Critical invariant:
DEFAULT DENIAL
SHALL APPLY
WHEN AUTHORIZATION
CANNOT BE VERIFIED.

35. LEARNING ENGINE ACCEPTANCE
The Learning Engine SHALL verify:
experience capture

outcome evaluation

pattern extraction

recommendation provenance

invalid learning rejection

feedback handling
Learning SHALL NOT automatically become production behavior without governance.

36. EVOLUTION ENGINE ACCEPTANCE
Mandatory tests:
proposal creation

experiment isolation

evaluation

canary deployment

promotion

rollback
Critical rule:
SELF-EVOLUTION
MUST NOT
BYPASS
POLICY
SECURITY
OR
ACCEPTANCE CONTROLS.

37. API ACCEPTANCE
Every public API SHALL be tested for:
schema validation

authentication

authorization

input validation

error responses

idempotency where required

rate limiting where applicable

version compatibility

38. SECURITY ACCEPTANCE
Security acceptance SHALL include:
identity attacks

authorization bypass

tenant escape

sandbox escape

injection resistance

secret exposure

dependency vulnerability

privilege escalation

unsafe tool invocation
Critical security failures SHALL block release.

39. PERFORMANCE ACCEPTANCE
Performance acceptance SHALL measure:
latency

throughput

concurrency

queue pressure

database performance

memory consumption

CPU consumption

execution startup time
Every performance test SHALL have a defined environment and reproducible workload.

40. RESILIENCE ACCEPTANCE
YAHRIA SHALL be tested under failure.
Mandatory scenarios:
database unavailable

AI provider unavailable

worker failure

network interruption

sandbox crash

tool timeout

partial system restart

duplicate event

duplicate task

out-of-order event
The system SHALL prove controlled degradation where possible.

41. CHAOS ACCEPTANCE
For production maturity, controlled fault injection SHALL test:
worker termination

network partition

database delay

storage failure

resource exhaustion

invalid event injection
Chaos tests MUST NOT be treated as optional for critical production infrastructure.

42. ACCEPTANCE TEST STRUCTURE
The recommended physical test structure is:
tests/
├── acceptance/
│   ├── foundation/
│   ├── identity/
│   ├── organization/
│   ├── persistence/
│   ├── code_genome/
│   ├── knowledge_graph/
│   ├── memory/
│   ├── cognitive/
│   ├── agents/
│   ├── task_graph/
│   ├── execution/
│   ├── tools/
│   ├── sandbox/
│   ├── observability/
│   ├── evidence/
│   ├── policy/
│   ├── learning/
│   ├── evolution/
│   └── system/
│
├── security/
├── performance/
├── resilience/
├── chaos/
└── release/

43. ACCEPTANCE TEST METADATA
Every critical acceptance test SHOULD declare:
TEST ID

ARTIFACT ID

DOMAIN

CRITICALITY

PRECONDITIONS

INPUTS

EXPECTED RESULT

FORBIDDEN RESULT

INVARIANTS

POLICIES

EVIDENCE REQUIREMENTS

44. ACCEPTANCE EVIDENCE
A successful test SHALL produce evidence appropriate to its criticality.
Evidence MAY include:
test result

execution trace

structured logs

metrics

artifact hashes

screenshots where applicable

database state proof

policy decision

security report
Critical tests MUST be traceable.

45. TEST FAILURE CLASSIFICATION
Failures SHALL be classified as:
IMPLEMENTATION_FAILURE

CONTRACT_FAILURE

DEPENDENCY_FAILURE

ENVIRONMENT_FAILURE

POLICY_FAILURE

SECURITY_FAILURE

PERFORMANCE_FAILURE

TEST_FAILURE

UNKNOWN_FAILURE
Unknown failures SHALL NOT automatically become passes.

46. REMEDIATION LOOP
The canonical remediation process is:
TEST FAILED
    ↓
CAPTURE EVIDENCE
    ↓
CLASSIFY FAILURE
    ↓
LOCATE ROOT CAUSE
    ↓
CREATE REMEDIATION TASK
    ↓
IMPLEMENT FIX
    ↓
RUN REGRESSION TESTS
    ↓
RE-RUN ACCEPTANCE
The original failure evidence SHALL remain traceable.

47. REGRESSION POLICY
Any change to a critical artifact SHALL trigger:
DIRECT TESTS
        +
DEPENDENCY TESTS
        +
REVERSE DEPENDENCY TESTS
        +
RELEVANT SECURITY TESTS
        +
RELEVANT ACCEPTANCE TESTS
Regression scope SHALL be determined from the dependency graph.

48. PROMOTION RULE
An implementation unit may be promoted only when:
ALL REQUIRED TESTS
PASSED
        +
NO CRITICAL FAILURE
        +
NO UNRESOLVED HIGH FAILURE
        +
REQUIRED EVIDENCE EXISTS
        +
POLICY COMPLIANCE VERIFIED

49. DOMAIN PROMOTION
A domain becomes:
IMPLEMENTED
when source code exists.
A domain becomes:
VALIDATED
when technical validation succeeds.
A domain becomes:
TESTED
when required tests execute.
A domain becomes:
ACCEPTED
when acceptance criteria succeed.
A domain becomes:
PROMOTED
when governance authorizes its use in the next lifecycle stage.

50. RELEASE ACCEPTANCE
A production release SHALL require:
ALL REQUIRED DOMAINS ACCEPTED
        +
CRITICAL SECURITY TESTS PASSED
        +
MIGRATIONS VALIDATED
        +
SYSTEM FLOWS VALIDATED
        +
PERFORMANCE BASELINE SATISFIED
        +
RESILIENCE REQUIREMENTS SATISFIED
        +
OBSERVABILITY VERIFIED
        +
ROLLBACK PLAN VERIFIED

51. RELEASE REJECTION
A release SHALL automatically be rejected when:
CRITICAL INVARIANT VIOLATION

OR

CRITICAL SECURITY FAILURE

OR

TENANT ISOLATION FAILURE

OR

SANDBOX ESCAPE

OR

EVIDENCE INTEGRITY FAILURE

OR

UNCONTROLLED DATA CORRUPTION

OR

UNRESOLVED CRITICAL EXECUTION FAILURE

52. AUTONOMOUS ACCEPTANCE ALGORITHM
LOAD ACCEPTANCE TEST MANIFEST

SELECT ARTIFACT

LOAD REQUIRED ACCEPTANCE TESTS

FOR EACH TEST:

    VERIFY PRECONDITIONS

    IF PRECONDITIONS FAIL:

        MARK BLOCKED

    ELSE:

        EXECUTE TEST

        CAPTURE RESULT

        CAPTURE EVIDENCE

        EVALUATE RESULT

        IF PASS:

            MARK PASSED

        ELSE:

            CLASSIFY FAILURE

            MARK FAILED

EVALUATE REQUIRED GATES

IF ALL REQUIRED GATES PASS:

    ACCEPT ARTIFACT

ELSE:

    REJECT OR BLOCK ARTIFACT

53. AUTONOMOUS REMEDIATION POLICY
YAHRIA MAY automatically attempt remediation only when:
the failure scope is known

the required modification is authorized

policy permits modification

no critical invariant is bypassed

the repair is testable

the repair can be independently validated
After remediation:
OLD FAILURE
REMAINS EVIDENCED

NEW IMPLEMENTATION
REQUIRES
FULL REVALIDATION

54. ACCEPTANCE COMPLETENESS SCORE
The conceptual completeness model is:
ACCEPTANCE_SCORE
=
SPECIFICATION
+
IMPLEMENTATION
+
VALIDATION
+
TESTING
+
SECURITY
+
OBSERVABILITY
+
EVIDENCE
+
POLICY
The system MUST NOT use a numerical score to override a failed critical invariant.
Therefore:
HIGH SCORE
+
CRITICAL FAILURE
=
REJECTED

55. CANONICAL QUALITY PYRAMID
                    RELEASE
                       ▲
                       │
                 SYSTEM TESTS
                       ▲
                       │
            CROSS-DOMAIN TESTS
                       ▲
                       │
                DOMAIN TESTS
                       ▲
                       │
             INTEGRATION TESTS
                       ▲
                       │
               CONTRACT TESTS
                       ▲
                       │
                 UNIT TESTS
                       ▲
                       │
             STATIC VALIDATION
                       ▲
                       │
               SOURCE CODE
Acceptance requires controlled progression upward.

56. FINAL ACCEPTANCE PRINCIPLE
A FILE IS NOT COMPLETE
BECAUSE IT EXISTS.

A MODULE IS NOT COMPLETE
BECAUSE IT IMPORTS.

A DOMAIN IS NOT COMPLETE
BECAUSE UNIT TESTS PASS.

A SYSTEM IS NOT COMPLETE
BECAUSE SERVICES START.

A RELEASE IS NOT READY
BECAUSE THE BUILD SUCCEEDS.

YAHRIA IS ACCEPTED
ONLY WHEN:

SPECIFICATION
+
IMPLEMENTATION
+
VALIDATION
+
TESTING
+
SECURITY
+
POLICY
+
OBSERVABILITY
+
EVIDENCE

CONVERGE
WITHOUT VIOLATING
A CRITICAL INVARIANT.

57. MACHINE COMMANDMENT
DO NOT ASSUME SUCCESS.

PROVE SUCCESS.

DO NOT HIDE FAILURE.

CLASSIFY FAILURE.

DO NOT BYPASS THE TEST.

SATISFY THE TEST.

DO NOT PROMOTE CODE.

PROMOTE VERIFIED BEHAVIOR.

DO NOT TRUST THE CLAIM.

TRUST THE EVIDENCE.

58. FINAL STATUS
DOCUMENT:
ACCEPTANCE_TEST_MANIFEST.md

VERSION:
1.0.0

STATUS:
CANONICAL

ROLE:
FINAL ACCEPTANCE CONTROL
FOR AUTONOMOUS IMPLEMENTATION
OF YAHRIA
END OF ACCEPTANCE TEST MANIFEST
Les 8 documents racines sont maintenant cohérents
YAHRIA_CANONICAL_BLUEPRINT/
│
├── 00_AUTONOMOUS_CODING_CONTRACT.md
│   → Règles de comportement du système de codage autonome
│
├── CANONICAL_INDEX.md
│   → Carte officielle de YAHRIA
│
├── DEPENDENCY_GRAPH.md
│   → Graphe des dépendances
│
├── GLOBAL_INVARIANTS.md
│   → Lois inviolables du système
│
├── ARCHITECTURE_DECISIONS.md
│   → Décisions techniques figées
│
├── IMPLEMENTATION_MANIFEST.md
│   → Unités d'implémentation
│
├── FILE_GENERATION_MANIFEST.md
│   → Fichiers physiques à générer
│
└── ACCEPTANCE_TEST_MANIFEST.md
    → Conditions obligatoires d'acceptation
Chaîne autonome définitive
CONTRACT
   ↓
ARCHITECTURE
   ↓
DEPENDENCIES
   ↓
INVARIANTS
   ↓
IMPLEMENTATION UNITS
   ↓
FILES
   ↓
CODE
   ↓
TESTS
   ↓
EVIDENCE
   ↓
ACCEPTANCE
   ↓
PROMOTION
Étape suivante stratégique : figer EVIDENCE_MANIFEST.md, qui définira exactement quelle preuve doit être produite, stockée, hashée, liée et conservée pour chaque génération, test, décision et promotion. Ce serait le document qui fermerait définitivement la boucle Code → Test → Preuve → Gouvernance.
