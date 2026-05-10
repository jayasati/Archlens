# Archlens

Code architecture analysis platform — pnpm + Turborepo monorepo.

## Requirements

- Node.js `>= 20` (see `.nvmrc`)
- pnpm `>= 10`

## Getting started

```bash
pnpm install
pnpm build
pnpm lint
pnpm test
```

## Workspace layout

```
archlens/
├── apps/
│   ├── api/         NestJS backend
│   ├── web/         Next.js frontend
│   └── worker/      background scan runner (separate Nest app)
├── packages/
│   ├── shared-types/   IR schema, DTOs shared by api + web
│   ├── ir-schema/      JSON-Schema/Zod for IR (single source of truth)
│   └── analyzers/      language adapters as a library
├── tools/
│   ├── parser-jars/    bundled JavaParser/PMD jars
│   └── scripts/
├── docker/
└── .github/workflows/
```

## Apps

### `apps/api` — NestJS backend

The HTTP API surface. Owns auth, repositories, scans, reports, architecture
diagrams, hotspots, PR-checks, GitHub webhooks, billing, and health endpoints.
Talks to Postgres via Prisma, enqueues scan work via BullMQ, and exposes a
WebSocket gateway for live scan progress.

### `apps/web` — Next.js frontend

The user-facing dashboard. App Router, server components, shadcn UI primitives,
TanStack Query, Mermaid for layered diagrams and Cytoscape.js for interactive
graphs. Authentication runs through NextAuth; live scan progress comes over
WebSocket from the API.

### `apps/worker` — background scan runner

A standalone Nest app that consumes the BullMQ scan queue. Runs the analysis
pipeline: clone → detect languages → run adapters → compute metrics → build
graph → score → render diagrams → persist. Publishes progress events back to
the API via Redis.

## Packages

### `packages/shared-types`

DTOs and domain types shared across `api`, `web`, and `worker`. The contract
between frontend and backend lives here so a renamed field breaks the build,
not production.

### `packages/ir-schema`

The Zod / JSON-Schema definition of the Intermediate Representation produced
by analyzers. Single source of truth — every adapter output and every API
consumer validates against this schema.

### `packages/analyzers`

Language adapters (Java/Spring, Python, Node), metric calculators (complexity,
duplication, coupling, size, smells), graph algorithms (cycle detection,
Louvain, centrality), the scoring engine, and the diagram builders. Consumed
as a library by `apps/worker`.

## Tools

### `tools/parser-jars`

Bundled JavaParser/PMD jars shipped with the worker so Java analysis works
without a system JDK install on the analyzer side.

### `tools/scripts`

Repo-level scripts (release helpers, fixture generators, one-off migrations).

## Infrastructure

### `docker/`

Dockerfiles for `api` and `worker`, plus a `docker-compose.yml` for local
Postgres + Redis + S3-compatible storage.

### `.github/workflows/`

CI (`ci.yml`) and release (`release.yml`) pipelines.

## Common scripts

| Command          | What it does                                 |
| ---------------- | -------------------------------------------- |
| `pnpm build`     | Turbo-orchestrated build across all packages |
| `pnpm lint`      | ESLint across all packages                   |
| `pnpm test`      | Test suites across all packages              |
| `pnpm typecheck` | TypeScript `--noEmit` across all packages    |
| `pnpm dev`       | Run dev mode for every app in parallel       |
| `pnpm format`    | Prettier write across the repo               |
| `pnpm clean`     | Wipe build outputs and `node_modules`        |
