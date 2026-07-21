# Development Principles

This project follows the engineering guidance collected in the
[Singularity Society development handbook](https://github.com/SingularitySociety/societys_statement/blob/main/development/README.md).
When this document and the upstream handbook differ, confirm the reason and record the
project-specific decision before changing the architecture.

## Product Boundary

- Help people verify and share spray or fertilizer work before, during, and after the job.
- Do not present the service as approving a spray, making a legal judgment, or identifying
  the cause of damage.
- Keep each role focused: applicators see execution tasks, neighboring farmers see relevant
  notices and privacy controls, and regional managers see aggregate status and review queues.
- Prefer improvements demonstrated by user workflows and measurable outcomes over adding
  speculative features.

## Architecture

- Keep domain rules in small, testable modules with explicit inputs and outputs.
- Keep browser rendering, storage, maps, network access, and provider SDKs at the edges.
- Integrate xarvio, WAGRI, weather services, and drone vendors through provider adapters and
  canonical application contracts. Provider payloads must not leak into core UI logic.
- Put credentials and paid-provider calls behind the Cloudflare BFF. Never expose secrets in
  browser code or committed files.
- Keep the current vanilla frontend while its state and ownership remain understandable.
  Introduce a framework or backend database only when their operational value exceeds their
  migration cost.
- Avoid premature abstraction. Extract shared code when it removes demonstrated duplication
  or isolates a real source of change.

## Data And Security

- Treat field locations, cultivation status, contact details, replies, and work history as
  access-controlled data with an explicit owner and sharing scope.
- Fail closed when authentication, configuration, validation, or provider responses are
  incomplete.
- Require application authentication and role authorization before enabling production BFF
  integrations. A shared integration token is only a disabled-by-default prototype control.
- Bound request size, response size, duration, and concurrency for external services. Add
  rate limits and audit records before handling production traffic.
- Separate forecasts, operator confirmation, and on-site measurements in both data and UI.

## Delivery Workflow

- Make small commits with one clear purpose. Separate behavior changes from refactoring when
  practical, and preserve the reason for architectural decisions in Git.
- Run focused tests after each change and the full relevant suite before pushing or deploying.
- Inspect diffs mechanically; AI-generated code is not accepted on confidence alone.
- Deploy only a tested commit. The published artifact must contain only required public assets
  and server functions, never local agent files, notes, credentials, or source-only documents.
- Add CI for tests, static checks, dependency review, and deployment as the project moves from
  demonstration to shared development.

## AI Collaboration

- Git-tracked documentation is the handoff source of truth across Codex, Claude Code, and
  human contributors. Read `HANDOFF.md`, this file, and relevant integration docs first.
- Prefer mature libraries, official specifications, and primary documentation; verify APIs
  and changing external facts before implementation.
- Do not send private repository code to an external model or service without explicit user
  approval. Share generalized architecture questions when source disclosure is unnecessary.
- Record unfinished work, assumptions, and verification results before changing agents or
  ending a development session.
