# Project Instructions

## What This Repo Is

- `training-report-app/` is the main React + TypeScript + Vite frontend.
- `firebase/` contains Firebase Functions and supporting scripts.
- The product is a training report / progress tracking app with camp scheduling logic.

## Working Style

- Make focused, low-risk edits that fit the existing structure.
- Prefer TypeScript for frontend changes and functional React components.
- Preserve existing Chinese UI wording and route behavior unless the task explicitly asks for copy or UX changes.
- Do not remove compatibility code paths like AWS API plus legacy fallback without confirmation.

## Frontend Notes

- Camp timing and off-season behavior are important and currently live around `training-report-app/src/pages/utils/campConfig.ts` and `training-report-app/src/App.tsx`.
- Be careful when editing progress mapping logic in `training-report-app/src/pages/ProgressOverview.tsx`.
- Keep loading, error, and empty states explicit in UI code.
- Use `VITE_`-prefixed env vars for new Vite environment variables.

## Backend Notes

- Preserve API contracts between Firebase or AWS-backed endpoints and the frontend.
- Do not hardcode secrets.

## Useful Commands

- Frontend dev: `cd training-report-app && npm run dev`
- Frontend build: `cd training-report-app && npm run build`
- Frontend lint: `cd training-report-app && npm run lint`
