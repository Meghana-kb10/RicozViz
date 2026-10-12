# AGENTS.md - Vite Client Agentic Playbook

## Agent Role & Scope
You are working on the Vite 6 / React Router v8 client application. Your primary responsibilities are SPA routing correctness, type generation fidelity, Material UI styling, and maintaining 1:1 parity with `apps/next`.

---

## Key Workflows

### 1. Adding a New Route
1. Add the path constant to `src/config/page-route.config.ts`.
2. Create the page files under `src/app/<route-path>/`:
   - `page.tsx`
   - `components/header/header.tsx` with nested `components/navbar/navbar.tsx`
   - Co-located hooks and context.
3. Register the route in `src/app/routes.ts`:
   ```typescript
   route('my-route', 'my-route/page.tsx')
   ```
4. Run `pnpm --filter vite-app check-types` to execute `react-router typegen && tsc --noEmit`.

### 2. Navigating in React Router v8
- Always use `import { Link, useNavigate } from 'react-router'`.
- Pass target route using `to`: `<Link to={PAGE_ROUTES.LOGIN}>...</Link>`.
- Programmatic redirect: `const navigate = useNavigate(); navigate(PAGE_ROUTES.HOME);`.

### 3. Material UI Component Usage
- Use `<Button variant="contained">` for primary buttons with touch ripples.
- Use `<Input label="Label" />` for outlined text fields with floating labels.
- Use `<Card variant="elevated">` with `<CardHeader>`, `<CardContent>`, and `<CardActions>`.

---

## Constraints & Gotchas
- Never move `src/app` out of `src/` without updating `appDirectory` in `react-router.config.ts`.
- `react-router.config.ts` has `ssr: false` enabled for client SPA execution.
- If you encounter routing errors like `No route matches URL`, check that the file is declared in `src/app/routes.ts`.
- Always verify changes with `pnpm --filter vite-app check-types`.
