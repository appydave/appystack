# Template .gitignore Gaps

**Raised**: 2026-03-28
**Source**: AngelEye Wave 12 — discovered when `.playwright-mcp/` caused false "Dirty" status in git-sync pill

## Missing from template/.gitignore and create-appystack/template/.gitignore

| Entry | Why |
|-------|-----|
| `.playwright-mcp/` | Playwright MCP server dumps console logs + screenshots here. Any project using the MCP server gets untracked junk. |
| `playwright-report/` | Playwright test HTML reports. Generated on test runs. |
| `*.log` | Runtime log files. Pino and other loggers may write these. |
| `logs/` | Log directory convention. |
| `.screenshots/` | Screenshot artifacts from browser testing or MCP tools. |

## NOT recommended to add

| Entry | Why not |
|-------|---------|
| `data/` | App-specific. Some projects commit seed data. CLAUDE.md already documents this as a case-by-case decision. |
| `.nyc_output/` | Istanbul/nyc coverage tool — obsolete. Vitest uses `coverage/` which is already ignored. |
