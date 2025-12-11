# Repository Guidelines

## Project Structure & Module Organization
- SvelteKit app rooted at `src`. Routes live in `src/routes` (each `+page.svelte` or `+layout.svelte` file is a page/layout). Shared UI, helpers, and assets belong in `src/lib`; export new utilities via `src/lib/index.ts` for easy imports. Static files (favicons, public assets) go in `static`. Vite/SvelteKit configuration sits in `vite.config.ts` and `svelte.config.js`; TypeScript config is in `tsconfig.json`.

## Build, Test, and Development Commands
- `npm run dev` — start the dev server; add `-- --open` to launch a browser tab.  
- `npm run build` — create the production bundle.  
- `npm run preview` — serve the built app to verify the production output.  
- `npm run check` — run `svelte-kit sync` plus `svelte-check` against `tsconfig.json` for type and props validation.  
- `npm run check:watch` — watch mode for the same checks.  
- `npm run prepare` — syncs SvelteKit types after dependency changes.

## Coding Style & Naming Conventions
- Language: Svelte + TypeScript. Prefer typed props/exports in components and avoid `any`.  
- Formatting: follow default Svelte conventions (two-space indent, single quotes in scripts when practical, semicolons in TS). Keep markup lean; move logic into `<script>` blocks or utilities in `src/lib`.  
- Naming: components `PascalCase.svelte`, helper modules `camelCase.ts`, routes use folder-based slugs (e.g., `src/routes/jobs/[id]/+page.svelte`).

## Testing Guidelines
- No automated test harness is present yet; add coverage with the SvelteKit testing stack when introducing complex logic (e.g., Playwright for E2E, Vitest for units).  
- Co-locate tests near sources (e.g., `MyComponent.spec.ts` beside `MyComponent.svelte`) and mirror route paths for page tests.  
- Aim to exercise critical flows (data fetching, form validation, navigation guards) before merging.

## Commit & Pull Request Guidelines
- Use concise, imperative commit subjects (e.g., `Add job detail route`, `Fix salary filter`). Bundle related changes per commit when possible.  
- Pull requests should describe scope, motivation, and testing performed; link tickets/issues. Include screenshots or short screen captures for UI-visible changes (desktop and mobile).  
- Ensure `npm run check` passes before review; for visual updates, run `npm run preview` locally to confirm production parity.

## Security & Configuration Tips
- Avoid committing secrets; prefer environment variables and document required keys in a `.env.example` without values.  
- Keep dependencies minimal; remove unused imports/components to reduce bundle size.  
- When adding adapters or deployment config, update `README.md` with platform-specific steps.
