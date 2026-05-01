See @AGENTS.md for the main shared project instructions.
See @training-report-app/package.json for frontend scripts and dependency context.
See @training-report-app/src/App.tsx for route and off-season gate behavior.
See @training-report-app/src/pages/ProgressOverview.tsx for the most important progress data mapping logic.

# Claude Project Memory

## Priorities

- Preserve existing user-facing behavior unless the task explicitly asks for product changes.
- Prefer targeted edits over broad refactors.
- Keep Traditional Chinese UI labels intact unless asked to rewrite copy.

## Extra Guidance

- When changing API-driven UI, verify loading, error handling, and compatibility fallbacks.
- If changing shared contracts, update both producer and consumer in the same task when possible.
