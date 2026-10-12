# Engineering Standards & Git Guidelines

## 1. Core Principles
* **KISS (Keep It Simple, Stupid):** Write code for readability first. Clever, overly compact code is harder to debug and maintain.
* **DRY (Don’t Repeat Yourself), within reason:** Abstract shared logic, but avoid premature abstractions. Duplication is far cheaper than the wrong abstraction.
* **YAGNI (You Aren't Gonna Need It):** Build for the current requirement. Do not add speculative parameters, flags, or architecture for hypothetical futures.

---

## 2. Naming & Readability
* **Intention-revealing names:** Name variables and functions by what they represent or do, not how they are implemented.
  * *Bad:* `data`, `arr`, `temp`, `doStuff()`
  * *Good:* `pendingOrders`, `activeUserIds`, `calculateInvoiceTotal()`
* **Boolean naming:** Always use a boolean prefix: `isActive`, `hasPermission`, `canEdit`, `shouldRetry`.
* **Standard casing:**
  * `camelCase`: Variables, functions, methods
  * `PascalCase`: Classes, interfaces, types, React components
  * `UPPER_SNAKE_CASE`: Global constants and configuration limits
  * `kebab-case`: Files, directories, endpoints, and CSS classes
* **Comments as "Why", not "What":** Write self-documenting code. Use comments only to explain business constraints, edge-case rationale, or performance workarounds.

---

## 3. Architecture & Code Structure
* **Separation of Concerns:** 
  * Keep data access, business domain logic, and presentation/transport layers distinct.
  * Route handlers/controllers must remain thin (orchestration only); move logic into services/use-cases.
* **Explicit dependencies:** Inject dependencies (services, database clients) rather than using global or mutable singletons where practical.
* **Fail fast & Guard clauses:** Validate input parameters at the boundary and return early to avoid nested `if/else` blocks.

---

## 4. Error Handling & Logging
* **Never swallow errors:** Never leave an empty `catch` block. Always handle, wrap, or rethrow.
* **Use typed/custom domain errors:** Throw descriptive errors (e.g., `EntityNotFoundError`, `PaymentFailedError`) rather than generic `Error('something went wrong')`.
* **Structured Logging:**
  * Log events with context metadata (e.g., `userId`, `requestId`, `action`), not string concatenation.
  * Avoid raw `console.log` in production code; use the shared application logger.
  * **Zero PII in logs:** Never print passwords, API keys, tokens, session cookies, credit card numbers, or sensitive user PII.

---

## 5. Security & Safety
* **Zero Hardcoded Secrets:** Never commit API keys, private keys, database credentials, or environment-specific values. Use `.env.example` templates and load secrets via environment variables or secret managers.
* **Sanitize and Validate All Input:** Treat all client input (query params, bodies, headers) as untrusted. Validate using schemas (e.g., Zod, Joi) before passing data to domain layers.
* **Prevent Injection:** Always use parameterized queries or ORM abstractions. Never concatenate user input into database queries or shell commands.

---

## 6. Testing Standards
* **Write deterministic tests:** Unit tests must be fast, isolated, and produce identical results regardless of order or execution environment.
* **Test behavior, not implementation details:** Verify inputs vs. outputs and external contract guarantees rather than testing internal private methods.
* **Cover the unhappy paths:** Tests must cover failure scenarios, null/undefined inputs, boundary conditions, and unauthorized access attempts.

---

## 7. Git Workflow & Branching Guidelines

We follow a strict Git branching model to maintain stability across environments. Direct pushes to `main` or `develop` are prohibited. All development work originates from and merges through pull requests.

```text
feature/* ──(PR + Changeset)──> develop ──(PR + Release)──> main
```

### Branch Strategy

| Branch | Purpose | Merge Source | Direct Push Allowed? |
| :--- | :--- | :--- | :--- |
| `main` | Production-ready code. Triggers version tags & prod deployments. | `develop` only | **NO** |
| `develop` | Staging/integration branch. Aggregates completed features. | `feature/*` (or `fix/*`) | **NO** |
| `feature/*` | Individual feature or task development. | Cut from latest `develop` | **YES** |

### Feature Branch Lifecycle (Step-by-Step)

#### Step 1: Sync and Cut a New Branch
Always base your feature branch on the latest `develop` branch:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/order-receipt-pdf
```

**Branch Naming Conventions:**
* `feature/<short-description>`: New features, routes, or capabilities (e.g., `feature/table-reservation-api`).
* `fix/<short-description>`: Non-urgent bug fixes (e.g., `fix/pos-tax-rounding`).
* Use lowercase kebab-case. Avoid vague names like `feature/backend` or `feature/update`.

#### Step 2: Implement Changes and Verify Locally
Keep commits atomic and use Conventional Commits:
```bash
git commit -m "feat(orders): implement pdf receipt rendering"
```

Run local quality checks before pushing:
```bash
pnpm check-types
pnpm build
```

#### Step 3: Generate a Changeset (Mandatory)
Every pull request targeting `develop` must include a Changeset markdown file. Pull requests without a changeset will fail CI and cannot be merged.

Run the Changesets CLI from the repository root:
```bash
pnpm changeset
```

1. Select the packages affected by your changes.
2. Choose the appropriate SemVer bump type:
   * **patch**: Bug fixes, minor performance tuning, non-breaking internal changes.
   * **minor**: New features, new endpoints, backwards-compatible additions.
   * **major**: Breaking API changes, deleted endpoints, schema migrations requiring manual intervention.
3. Enter a clear summary describing the change for the changelog.
4. Stage and commit the generated `.changeset/*.md` file:
```bash
git add .changeset/
git commit -m "chore(changeset): add release notes for receipt generation"
```

#### Step 4: Push the Feature Branch
Push your branch to the remote origin:
```bash
git push -u origin feature/order-receipt-pdf
```

#### Step 5: Open a Pull Request to `develop`
1. Navigate to GitHub and open a Pull Request.
2. Set the base branch to `develop` (never target `main` directly).
3. Ensure the head branch matches `feature/*`.
4. Fill in the PR description template (summary, testing instructions, ticket links).
5. Wait for automated CI checks (Branch Governance, Verify Changeset Exists, type checks, build) to pass.
6. Request review from at least one peer. Address all review comments before merging.

### Strict Prohibitions
* **Never push directly to `develop` or `main`**: All code must pass through pull requests.
* **Never merge `feature/*` directly into `main`**: Features must sit in `develop` first for integration verification.
* **Do not bypass Changesets**: Do not delete or commit empty changelogs to skirt CI checks.
* **Keep branches up to date**: If `develop` has moved ahead while your PR is in review, merge `origin/develop` into your branch:
```bash
git checkout feature/order-receipt-pdf
git fetch origin
git merge origin/develop
git push origin feature/order-receipt-pdf
```

---

## 8. Definition of Done (DoD)
A task is only considered complete when:
* Business requirements and edge cases are implemented.
* Unit and integration tests are written and passing locally and on CI.
* Linter, type checks, and formatters report zero errors (`pnpm check-types`).
* No security vulnerabilities or leaked credentials exist.
* Documentation, `.env.example`, or API specifications are updated.
* The PR has received required peer review approvals, passes CI governance, and merges cleanly without conflicts.