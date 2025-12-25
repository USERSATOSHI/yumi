## Project: Yumi — Technical Case Study

## Overview
Yumi is a modular IoT and device-control platform composed of multiple TypeScript packages and services. Core capabilities include device management, real-time communication via WebSocket, analytics, command/control routing, speech synthesis endpoints, and a local vector database for semantic search and chat features. Runtime environment targets Bun for low-latency operation and lightweight deployment. HTTP APIs and a WebSocket endpoint provide programmatic and real-time interfaces.

## Primary goals
- Provide a robust API for IoT device lifecycle management and control.
- Support real-time device telemetry and command propagation over WebSocket.
- Deliver semantic search and chat capabilities through a local vector database with Transformer-based embeddings.
- Maintain modular package boundaries to isolate responsibilities across functional domains.
- Optimize for performance and resource efficiency with Bun and minimal external dependencies.

## High-level architecture
- HTTP API server built on Elysia, configured and bootstrapped in `packages/core/src/index.ts`.
  - Swagger documentation mounted at `/docs`.
  - API routes prefixed under `/api`, assembled via `packages/core/src/routes/index.ts`.
  - WebSocket routing provided by a `WebSocketManager` abstraction.
- Real-time communication layer implemented by `WebSocketManager`, handling message routing, authentication, and channel subscriptions.
- Persistence and semantic search implemented in `@yumi/db`, leveraging Bun SQLite for storage and `@xenova/transformers` for embeddings.
- Shared utilities and types provided via `@yumi/results`, `@yumi/logger`, and `@yumi/patterns`.
- Device-specific integrations and tooling provided by `@yumi/link`, `@yumi/deck`, and `@yumi/hotword`.

## Key components and files
- `packages/core/src/index.ts`
  - Boot sequence: database initialization, WebSocket manager instantiation, middleware selection, route registration, and Elysia server startup (default port `2000`).
  - Environment-aware rate limiting selection.
- `packages/core/src/routes/index.ts`
  - API aggregation and endpoints registration including `/api/health` and `/api/info`.
  - Modular route creators for device, control, devicestats, analytics, music, speech, logging, and serverinfo.
- `packages/core/src/websocket/*` and `packages/core/src/websocket/README.md`
  - WebSocket manager, message handler, device lifecycle logic, and message schema documentation.
- `packages/db/*` and `packages/db/README.md`
  - Vector DB subsystem: embedding pipeline, semantic and hybrid search, chat-scoped storage, and analytics.
- `packages/core/src/db/*`
  - Repository abstractions, cache implementation, and migration scripts for structured storage of devices, commands, analytics, and metrics.
- `packages/logger`, `packages/patterns`, `packages/results`
  - Cross-package logging, utility patterns, and Result-based error handling primitives.

## API surface (summary)
API prefix: `/api`

Core endpoints:
- `GET /api/health` — System health, database status, cache metrics, and timestamped service state.
- `GET /api/info` — Service metadata and endpoint listing.
- Device management: endpoints under `/api/device` for CRUD and status queries.
- Control endpoints: `/api/control` for command submission, scene activation, and command history.
- Device statistics: `/api/devicestats` for telemetry ingestion and historical queries.
- Analytics: `/api/analytics` for command and device analytics reporting.
- Music control: `/api/music` for playback and broadcast control.
- Speech synthesis: `/api/speak` for text-to-speech generation and audio artifact retrieval.
- Logging: `/api/log` for paginated logs, search, export, and statistics.
- Server operations: `/api/serverinfo` for network and system-level actions.

Detailed route definitions and payload schemas implemented in `packages/core/src/routes/*.routes.ts`.

## WebSocket protocol
- Endpoint: `ws://<host>:2000/ws` (route created by `WebSocketManager`).
- Primary message types:
  - `auth` — Authentication payload containing `type`, `hash`, `identifier`, `nonce`, `timestamp`, `signature`, and `clientVersion`.
  - `device` — Device registration, status propagation, and metadata updates.
  - `control` — Command messages targeting devices (examples: `set-volume:50`, `shutdown`).
  - `music` — Playback state and metadata broadcasts.
  - `device_stats` — Real-time telemetry (CPU, RAM, battery metrics).
  - `heartbeat` — Keepalive messages for connection health.
- Authentication model:
  - HMAC-style signatures, timestamp validation, and device-type identifiers used to validate connection attempts.
- Channel model:
  - Device-specific channels keyed by device hash for targeted messages.
  - Broadcast channels for device classes (for example, `deck`) for grouped messaging.

Message schema examples and lifecycle behavior documented in `packages/core/src/websocket/README.md`.

## Persistence and data model
- Vector DB (`@yumi/db`)
  - Message and embedding storage implemented with Bun SQLite.
  - Embeddings generated by `@xenova/transformers` and stored with metadata (chat ID, role, timestamp).
  - Search modes: chat-local semantic, global semantic, hybrid with keyword boosting, and reranking with configurable top-K.
- Relational stores and repositories
  - Device records, control commands, analytics, and device statistics persisted via repository abstractions under `packages/core/src/db/repositories`.
  - In-memory caching layer implemented in `packages/core/src/db/cache.ts` to reduce read amplification and improve latency.
- Migrations and schema
  - Migration scripts located in `packages/core/src/db/migrations.ts` provide reproducible schema evolution.
  - Command tracking tables and analytics schemas designed for time-series ingestion and aggregated reporting.

## Middleware and security
- Rate limiting
  - Environment-aware middleware selection: lenient development limits or strict production policies (`developmentRateLimitMiddleware`, `standardRateLimitMiddleware`).
- HTTP authentication
  - Route-level authentication enforced through `auth.middleware` for sensitive endpoints.
- WebSocket authentication
  - Connection opening requires a validated `auth` message signed using configured secrets and device identifiers.
- Logging and observability
  - Enhanced request logging middleware (`enhancedLoggingMiddleware`) produces structured logs emitted via `@yumi/logger`.
- API error handling
  - Centralized error middleware ensures consistent response formatting and HTTP status semantics.

## Performance characteristics and tradeoffs
- Runtime choice
  - Bun provides fast startup and a low-overhead event loop suitable for mixed HTTP and WebSocket workloads.
- Embedding pipeline
  - Local Transformer inference via `@xenova/transformers` supports offline deployments and privacy-preserving local processing. Model selection, batching, and quantization settings determine CPU and memory requirements.
- Storage model
  - Bun SQLite provides efficient local persistence with minimal operational complexity. Single-process SQLite access requires careful cache strategies to prevent contention under high concurrency.
- Resource management
  - Embedding generation can be CPU- and memory-intensive. Batching, caching, and dedicated embedding workers reduce peak load and improve throughput for concurrent requests.
- Maintenance tradeoffs
  - Direct control over middleware and WebSocket flow reduces external dependencies but increases testing and maintenance surface.

## Build, run, and deployment notes
- Development workflow:
  - Primary runtime: Bun.
  - Commands:
    - `bun install` — Dependency installation.
    - `bun run --cwd packages/core dev` or `bun run packages/core dev` — Start core service in development mode.
    - `bun test` — Run test suites.
  - Default server port: `2000`. Environment variable `NODE_ENV` selects environment-specific behavior.
- Containerization:
  - Production containers should provision a Bun runtime or use multi-stage builds to install Bun and assemble artifacts.
  - Environment variables required for secrets, database file paths, and Transformer model locations.
  - Persistent storage required for vector DB files and logs.
  - Single-process WebSocket manager implies sticky sessions or a message broker for horizontal WebSocket scaling across multiple instances.

## Testing and quality
- Unit and integration tests available via `bun test` across packages.
- Example scripts and demos available in `packages/core/src/examples` (for example, `logs-demo.ts`) for API and WebSocket behavior validation.
- Performance validation recommended on target deployment hardware when enabling local Transformer models.

## AI capabilities
- Hotword detection (planned): Hotword detection capability planned for near-term integration. Hotword component will provide continuous low-latency wake-word detection and event emission for downstream TTS and control flows.
- Voice-based answers: Text-to-speech endpoints and voice synthesis workflows available. Generated audio artifacts can be returned directly via HTTP endpoints or stored for playback by devices. Transformer-backed semantic search and chat pipelines enable contextual, multimodal responses.
- Voice-based control of devices via single device: Centralized voice control model enables issuing commands to multiple target devices through a single authenticated control device. Command routing uses WebSocket channels keyed by target device hash and supports both direct commands and scene-based multi-device orchestration.

## Notable design decisions
- Monorepo modularization reduces coupling across vector DB, core API, and device integrations while enabling independent package testing and versioning.
- Bun chosen for high-performance TypeScript execution and native SQLite support; `@xenova/transformers` chosen for on-device embedding capability to enable offline semantics.
- Elysia selected for modular HTTP routing and straightforward Swagger integration.
- Environment-aware middleware selection preserves developer ergonomics in non-production environments while applying stricter safeguards in production.

## References (key paths)
- Core entrypoint: `packages/core/src/index.ts`
- API composition: `packages/core/src/routes/index.ts`
- WebSocket manager and docs: `packages/core/src/websocket/*` and `packages/core/src/websocket/README.md`
- Vector DB subsystem: `packages/db/README.md` and `packages/db/src/*`
- Shared utilities: `packages/logger`, `packages/patterns`, `packages/results`

---