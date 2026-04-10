# ExecPlans

An ExecPlan is this repository's execution-plan format for multi-step features and refactors. It must let a new contributor finish the work with only the current tree and the plan itself.

## When to write one
- The change spans multiple modules or tools.
- Design choices or sequencing matter.
- The work may last long enough that handoff or restart is likely.
- Feasibility is uncertain and needs proof-of-concept validation first.

## Required properties
- State the user-visible outcome first.
- Summarize the current state and constraints in plain language.
- Name the files and modules expected to change.
- Break the work into milestones, each with explicit validation.
- Keep a progress log and decision log current while work is active.
- Record assumptions, open questions, and non-goals.
- Keep the document self-contained instead of relying on chat history.

## Execution rules
- Read the full plan before editing code.
- Implement milestone by milestone without asking for "next steps" unless truly blocked.
- Update the plan at every stopping point so another agent can resume immediately.
- Prefer small proofs of concept when feasibility is unclear.
- Do not mark work done until the described behavior is demonstrably working.

## Suggested template
1. Goal
2. Current State
3. Scope and Non-goals
4. Design
5. Milestones
6. Validation
7. Progress Log
8. Decision Log
9. Follow-ups
