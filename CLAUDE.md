# CLAUDE.md

## Project Context

<!-- Passe diesen Abschnitt pro Projekt an -->

- **Tech Stack**: Node.js
- **Test Framework**: 
- **Linting**: 
- **Key Paths**:
  - Task tracking: `tasks/todo.md`
  - Lessons learned: `tasks/lessons.md`

---

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: ALWAYS find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes MUST only touch what's necessary. Never introduce new bugs.

---

## Workflow Orchestration

### 1. Plan Mode Default

- ALWAYS enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP immediately and re-plan – do NOT keep pushing.
- Use plan mode for verification steps, not just building.
- Write detailed specs upfront to reduce ambiguity.

### 2. Subagent Strategy

- ALWAYS spawn subagents for research, exploration, and parallel analysis.
- Keep the main context window clean – offload aggressively.
- For complex problems, throw more compute at it via subagents.
- One task per subagent for focused execution.

### 3. Self-Improvement Loop

- After ANY correction from the user: IMMEDIATELY update `tasks/lessons.md` with the pattern.
- Write rules for yourself that prevent the same mistake from recurring.
- Ruthlessly iterate on these lessons until the mistake rate drops to zero.
- Review `tasks/lessons.md` at session start for the relevant project.

### 4. Verification Before Done

- NEVER mark a task complete without proving it works.
- Diff behavior between main and your changes when relevant.
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness – no exceptions.
- Write the tests before you've written a single line of code.

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "Is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution."
- Skip this for simple, obvious fixes – do NOT over-engineer.
- Challenge your own work before presenting it.

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Do NOT ask for hand-holding.
- Point at logs, errors, failing tests – then resolve them.
- Zero context switching required from the user.
- Go fix failing CI tests without being told how.

---

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items (`- [ ]`).
2. **Verify Plan**: Check in with the user before starting implementation.
3. **Track Progress**: Mark items complete (`- [x]`) as you go.
4. **Explain Changes**: Provide a high-level summary at each step.
5. **Document Results**: Add a review section to `tasks/todo.md` when done.
6. **Capture Lessons**: Update `tasks/lessons.md` after ANY correction.

---

## Communication Style

- Be direct and concise. No filler, no fluff.
- Summarize changes at a high level – don't narrate every line.
- If blocked or uncertain, say so immediately instead of guessing.
- Default language: Deutsch für Kommunikation, Englisch für Code und Docs.

---

# Websiteerstellung

## Design-Regeln
- Nutze das AskUserQuestion Tool, um den Nutzer über das Websitedesign zu interviewen, damit du die Vorstellungen des Nutzers genau abbilden kannst
- Nutze den frontend-design Skill für alle UI-Entscheidungen
- Nutze UI/UX Pro Max für Design-System-Generierung
- Nutze ggf. 21st.dev für Component-Inspiration (falls vorgegeben)
- Keine generischen AI-Aesthetics
- Bold, distinctive Design-Choices
- Performance-optimiert (Core Web Vitals)
