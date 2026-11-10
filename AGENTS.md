# Agent Frontend & Full-Stack Feedback Loop Rules

Whenever making any frontend or full-stack changes in this repository, you **MUST** execute the closed-loop verification workflow before completing your turn:

1. **Lint**: Run `pnpm run lint` to validate JS/HTML/CSS syntax, UI security/branding invariants (zero API key modals or cloud/model jargon on the frontend), and Python backend syntax.
2. **Typecheck**: Run `pnpm run typecheck` to run TypeScript (`tsc --noEmit`) and frontend-backend contract checks.
3. **Automated Tests**: Run `pnpm run test` to run E2E API, Study Set CRUD, and live browser DOM checks.
4. **Live Chrome DevTools Verification**: Use the `chrome-devtools` MCP server configured in `.mcp.json` (`--browserUrl http://127.0.0.1:9222`) and follow `skills/chrome-debugging/SKILL.md` (launch Chrome on port `9222` via `pnpm run chrome:debug` if not already running) to inspect the live rendered DOM, console logs, network requests, and visual layout at `http://127.0.0.1:8000`.
