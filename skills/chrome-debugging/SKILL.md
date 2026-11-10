---
name: chrome-debugging
description: Automated frontend feedback loop combining pnpm run lint, pnpm run typecheck, pnpm run test, and live browser verification via Chrome DevTools MCP on http://127.0.0.1:9222. Use whenever building, modifying, or debugging frontend UI, styles, interactions, or API integrations.
---

# Chrome Debugging & Frontend Feedback Loop Skill

Use this skill after **every** frontend or full-stack code change to verify that code compiles, passes static checks and automated tests, and renders and behaves properly in a real Chrome browser over the Chrome DevTools Protocol (`http://127.0.0.1:9222`).

---

## 1. Prerequisites & Configuration (`.mcp.json`)

Ensure `.mcp.json` at the repository root contains the Chrome DevTools MCP server attached to `http://127.0.0.1:9222`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--browserUrl",
        "http://127.0.0.1:9222"
      ]
    }
  }
}
```

To ensure Chrome is running with remote debugging enabled on port `9222`:
```bash
pnpm run chrome:debug
```
Or verify the debugger endpoint directly:
```bash
curl http://127.0.0.1:9222/json/version
```

---

## 2. Mandatory 4-Step Verification Loop

Whenever you create or modify frontend code (`frontend/index.html`, `frontend/app.js`, `frontend/styles.css`) or backend endpoints (`backend/`), run the full feedback loop in order:

### Step 1: Lint (`pnpm run lint`)
Checks JavaScript syntax, HTML structure, CSS rules, UI security/branding invariants (zero exposed API key inputs or cloud/model jargon), and Python backend syntax:
```bash
pnpm run lint
```

### Step 2: Typecheck (`pnpm run typecheck`)
Runs TypeScript (`tsc --noEmit`) and validates frontend-backend state and API contracts:
```bash
pnpm run typecheck
```

### Step 3: Automated Tests (`pnpm run test`)
Runs end-to-end integration tests against the running local server (`http://127.0.0.1:8000`) and live Chrome DevTools endpoint (`http://127.0.0.1:9222`):
```bash
pnpm run test
```

### Step 4: Live Browser Inspection via Chrome DevTools MCP
After `lint`, `typecheck`, and `test` pass, inspect the live browser via `chrome-devtools` MCP (or `pnpm run browser:inspect`):

1. **List or Open Page**:
   - Call `list_pages` to get the active `pageId`, or `new_page` / `navigate_page` to open `http://127.0.0.1:8000`.
2. **Wait & Snapshot DOM**:
   - Call `wait_for` until the main app shell renders.
   - Call `take_snapshot` with `pageId` to inspect interactive element `uid`s, text hierarchy, and accessibility tree.
3. **Check Console & Network Errors**:
   - Call `list_console_messages` to confirm zero uncaught runtime exceptions or Alpine.js binding warnings.
   - Call `list_network_requests` to confirm all `/static/*` and `/api/*` requests return HTTP `200`.
4. **Interact & Screenshot**:
   - Trigger the modified user flow (`click`, `fill`, `evaluate_script`).
   - Call `take_screenshot` or `get_css_styles` to confirm visual alignment, spacing, and theme consistency (Quizlet Daylight `#f6f7fb` and Quizlet Night `#0a092d`).

---

## 3. Troubleshooting Chrome Port `9222`

- If `chrome-devtools` MCP cannot connect to `http://127.0.0.1:9222`, run `pnpm run chrome:debug` to launch a dedicated Chrome instance with `--remote-debugging-port=9222 --user-data-dir=.chrome-debug-profile http://127.0.0.1:8000`.
- Never close the loop until all 3 CLI checks (`pnpm run lint`, `pnpm run typecheck`, `pnpm run test`) exit with code `0` and the live browser shows zero console or network errors.
