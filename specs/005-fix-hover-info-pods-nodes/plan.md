
# Implementation Plan: Fix Hover Info for Pods and Nodes

**Branch**: `005-fix-hover-info-pods-nodes` | **Date**: 2025-09-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-fix-hover-info-pods-nodes/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Fix the broken hover tooltip functionality for pods and implement new hover tooltips for node boxes in the Three.js-based Kubernetes visualization. The hover system was working previously but broke after recent changes, requiring investigation and repair alongside the new node hover feature.

## Technical Context
**Language/Version**: JavaScript/TypeScript (ES2022+), Node.js 20+
**Primary Dependencies**: Three.js (3D visualization), @kubernetes/client-node (K8s API), Express/WebSocket (real-time)
**Storage**: N/A (real-time data from Kubernetes API)
**Testing**: Jest/Vitest for unit tests, integration tests for K8s interactions
**Target Platform**: Web browser (Chrome, Firefox, Safari, Edge)
**Project Type**: web - frontend + backend architecture
**Performance Goals**: 60 FPS during hover interactions, no frame drops
**Constraints**: <50ms tooltip response time, no UI jank, maintain existing WebSocket connections
**Scale/Scope**: Support clusters with 100+ nodes and 1000+ pods

**Additional Context from User**: Hovering for pod info is no longer working after recent changes, so this must be addressed. Additionally it should be possible to hover over a node box to get info about it.

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since the constitution is not yet customized (template only), using standard engineering practices:
- ✓ Fix existing bug before adding new features (pod hover)
- ✓ Maintain consistency across hover interactions
- ✓ Performance requirements clearly defined (60 FPS)
- ✓ No unnecessary complexity added

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - Project has frontend and backend components for Three.js visualization and K8s API integration

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Fix existing pod hover regression first (priority)
- Then implement new node hover functionality
- Finally optimize for performance and instanced rendering

**Specific Tasks to Generate**:
1. **Diagnostic Tasks** (understand the regression)
   - Investigate SceneManager raycasting setup
   - Test current hover detection with pods
   - Verify PodInstanceManager integration

2. **Fix Pod Hover Tasks** (restore functionality)
   - Re-enable proper raycasting for pods
   - Integrate PodInstanceManager hover detection
   - Test with various cluster sizes

3. **Implement Node Hover Tasks** (new feature)
   - Enable raycasting on NodeObject meshes
   - Implement hover priority system (pods over nodes)
   - Add getTooltipData method to NodeObject
   - Display node information in tooltip

4. **Integration Tasks** (unified system)
   - Consolidate hover detection logic
   - Remove duplicate event handlers
   - Implement proper state management
   - Add performance optimizations

5. **Testing Tasks** (validation)
   - Unit tests for hover detection
   - Integration tests for tooltip display
   - Performance tests for large clusters
   - Edge case testing (viewport bounds, etc.)

**Ordering Strategy**:
- Fix before feature: Restore pod hover before adding node hover
- Test-driven: Write tests before implementation
- Incremental: Small, verifiable changes
- Mark [P] for parallel execution where possible

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
