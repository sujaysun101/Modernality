---
name: chrome-debugging
description: Automated frontend feedback loop combining pnpm run lint, pnpm run typecheck, pnpm run test, and live browser verification via Chrome DevTools MCP on http://127.0.0.1:9222. Use whenever building, modifying, or debugging frontend UI, styles, interactions, or API integrations.
---

# Chrome Debugging & Frontend Feedback Loop Skill

Use this skill after **every** frontend or full-stack code change to verify that code compiles, passes static checks and automated tests, and renders and behaves properly in a real Chrome browser over the Chrome DevTools Protocol (`http://127.0.0.1:9222`).

Please follow the full workflow in `skills/chrome-debugging/SKILL.md`:
1. `pnpm run lint`
2. `pnpm run typecheck`
3. `pnpm run test`
4. Live Chrome DevTools MCP inspection on `http://127.0.0.1:9222` (`list_pages` → `navigate_page` → `take_snapshot` → `list_console_messages` → `list_network_requests` → `take_screenshot`).
