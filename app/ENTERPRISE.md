# Enterprise Readiness Plan

Project Tracker is production-ready for a trusted solo-user workflow on a home PC. This document defines the additional product, security, operational, and compliance work required to make it suitable for enterprise adoption.

## Executive Summary

The current app is a local project analysis tool with a React/Vite frontend, Express API, optional Electron shell, local/offline AI support, optional OpenAI fallback, and heuristic analysis. It can scan local project directories and produce project health, easy-win, accessibility, publishing, and readiness guidance.

Enterprise readiness requires moving from a trusted single-user model to a governed multi-user or managed-device model. The most important changes are identity, access control, policy configuration, audit logging, deployment controls, data governance, and operational observability.

## Current Production Posture

### Strengths

- The app already has a clear local-first product purpose.
- The app can run without a cloud API key through local or heuristic analysis.
- The backend and frontend have separate build paths.
- Type checking, linting, testing, and production build scripts are present.
- Electron packaging exists for desktop distribution.
- The scanner ignores common heavy or generated directories such as `node_modules`, `.git`, `dist`, `build`, and cache folders.
- Existing documentation explains installation, configuration, API usage, project structure, and scanned inputs.

### Current Enterprise Gaps

- The current model assumes a trusted local user.
- API routes are not designed around enterprise identity or authorization.
- Folder selection and project scanning are sensitive filesystem operations that need policy controls.
- There is no documented enterprise audit log model.
- There is no organization, team, user, role, or workspace model.
- There is no central administration model for allowed paths, analyzers, AI providers, retention, or telemetry.
- Release packaging exists, but enterprise rollout requires signed artifacts, update policy, rollback notes, and deployment guidance.
- Accessibility and Web/PWA readiness still need explicit verification.

## Enterprise Readiness Goals

Enterprise readiness should mean the app can be deployed, configured, governed, audited, and supported by an organization without depending on implicit trust in a single local user.

### Required Outcomes

- Administrators can control where and how the app runs.
- Users authenticate through enterprise-compatible identity flows when deployed in server or managed modes.
- Users can only analyze approved folders, repositories, or workspaces.
- Analysis activity is auditable without exposing unnecessary source code or secrets.
- Sensitive data has explicit storage, retention, encryption, and deletion rules.
- Releases are versioned, signed, documented, and reversible.
- The app exposes health and operational signals suitable for IT support.
- Accessibility and deployment readiness are part of the release gate.

## Recommended Enterprise Product Modes

The app can evolve toward one or more enterprise modes. These should be explicitly chosen before large implementation work.

### Mode 1: Managed Local Desktop

This is the lowest-disruption path from the current product.

The app continues to run locally through Electron, but enterprise administrators can deploy a managed configuration that controls folder access, analyzers, model usage, telemetry, and update policy.

Best fit:

- Security-conscious teams that do not want source code sent to a central service.
- Organizations that want offline or air-gapped project analysis.
- Teams that can manage desktop installation through IT tooling.

Critical requirements:

- Signed installer.
- Managed configuration file or registry-equivalent policy source.
- Optional device-bound license or authenticated session.
- Local audit log export.
- Local encryption for sensitive settings and cached reports.

### Mode 2: Self-Hosted Team Server

The app runs as a web application and API inside the customer environment.

Best fit:

- Organizations that want shared dashboards and centralized reporting.
- Engineering teams that need team-level trends across projects.
- Customers who require data to remain in their own infrastructure.

Critical requirements:

- OIDC authentication.
- Role-based access control.
- Central database.
- Central audit logs.
- Container deployment.
- Health and readiness probes.
- Backup and restore process.

### Mode 3: Hybrid Desktop plus Control Plane

The desktop app performs local scanning while a central service manages identity, policy, licensing, audit sync, and shared report metadata.

Best fit:

- Enterprises that want local source code scanning but centralized governance.
- Customers that need policy enforcement across many developer machines.

Critical requirements:

- Desktop-to-control-plane authentication.
- Policy fetch and local enforcement.
- Offline grace period behavior.
- Audit event sync.
- Clear separation between metadata and source-derived content.

## Critical Assessment Areas

## 1. Security Model

### Current Concern

The app analyzes arbitrary local project directories. In an enterprise context, this is a privileged operation because local projects may contain secrets, source code, credentials, proprietary documentation, generated artifacts, and regulated data.

### Required Controls

- Define a threat model for local scanning, Electron execution, optional cloud AI usage, and local model execution.
- Restrict analysis to allowed roots in managed deployments.
- Block known sensitive paths by default unless explicitly allowed.
- Validate all API request payloads.
- Limit request body size and analysis scope.
- Add structured error handling that avoids leaking sensitive path or file details unnecessarily.
- Add rate limiting or concurrency limits for expensive analysis operations.
- Add secure defaults for production CORS and origin handling.
- Review Electron security settings before enterprise packaging.

### Acceptance Criteria

- A documented threat model exists.
- Sensitive operations are protected by explicit policy checks.
- Analysis cannot run outside allowed roots in enterprise mode.
- Production builds do not expose development-only behavior.

## 2. Identity and Access Management

### Current Concern

The current app does not appear to model enterprise users, organizations, teams, workspaces, or roles.

### Required Controls

- Define organization, user, role, workspace, and project concepts.
- Add role-based permissions for analysis, report viewing, configuration, export, and administration.
- Support OIDC for server or hybrid deployments.
- Consider SAML after OIDC if customer demand requires it.
- For managed desktop mode, support policy-bound local sessions or device authorization.

### Initial Role Model

| Role | Purpose |
|------|---------|
| Admin | Configure organization policy, users, workspaces, analyzers, retention, and deployment settings. |
| Analyst | Run analyses on approved projects and view generated reports. |
| Reviewer | View reports, trends, risks, and readiness guidance without changing configuration. |
| Read-only | View approved reports only. |

### Acceptance Criteria

- Every protected action maps to a role permission.
- Unauthorized users cannot analyze, export, or administer projects.
- Authentication and authorization behavior is testable.

## 3. Policy Configuration

### Current Concern

Enterprise administrators need deterministic control over local and server behavior.

### Required Controls

Add an enterprise policy layer that can be loaded from file or environment before introducing a full admin UI.

Policy should cover:

- Allowed project roots.
- Denied paths.
- Maximum scan depth.
- Maximum file count.
- Maximum report size.
- Allowed analyzer providers.
- Whether local LLM is enabled.
- Whether cloud AI fallback is allowed.
- Whether telemetry is enabled.
- Whether report export is allowed.
- Audit log destination.
- Retention period.
- Update channel.

### Acceptance Criteria

- The app can start with an enterprise policy file.
- Invalid policy fails safely with actionable errors.
- Policy decisions are logged for auditability.

## 4. Data Governance

### Current Concern

Enterprise customers need to know exactly what data is read, stored, transmitted, retained, and deleted.

### Required Controls

- Maintain a data inventory for scanner inputs, generated reports, local metadata, audit events, model prompts, model responses, and exported artifacts.
- Define what is stored locally versus centrally for each enterprise mode.
- Define retention defaults and admin override behavior.
- Encrypt sensitive local data where practical.
- Avoid storing source file contents unless explicitly required.
- Avoid sending source-derived content to cloud providers unless the organization has enabled that mode.
- Provide delete and export workflows for organization data.

### Data Classification

| Data Type | Sensitivity | Notes |
|-----------|-------------|-------|
| Project path | High | Can reveal customer, repository, or internal product names. |
| File tree | Medium to high | Can reveal architecture and proprietary modules. |
| README/docs excerpts | High | May contain internal plans, credentials, or customer details. |
| Dependency files | Medium | Can reveal technology choices and vulnerable versions. |
| Git metadata | Medium | Can reveal branch names, authors, and commit messages. |
| Analysis report | Medium to high | May summarize proprietary project health and risk. |
| Audit events | Medium | Needed for compliance but should avoid source content. |

### Acceptance Criteria

- Data flow documentation exists.
- Admins can configure retention.
- Reports and audit logs have deletion behavior.
- Cloud analyzer behavior is explicit and opt-in for enterprise mode.

## 5. API Hardening

### Current Concern

The key API operations include health checks, folder selection, and project analysis. Enterprise deployments need these routes to be validated, protected, observable, and policy-aware.

### Required Controls

- Add request validation for analysis inputs.
- Add authorization checks before folder selection or analysis.
- Add enterprise policy checks before scanning a path.
- Add concurrency limits for analysis jobs.
- Add request IDs for traceability.
- Add structured API errors.
- Add endpoint-level logging.
- Add integration tests for invalid paths, denied paths, oversized requests, and unauthorized access.

### Acceptance Criteria

- `/api/analyze` cannot scan denied or unauthorized paths.
- Error responses are consistent and do not expose unnecessary sensitive details.
- Analysis requests are traceable by request ID.
- API tests cover allowed and denied scenarios.

## 6. Audit Logging

### Current Concern

Enterprise users need evidence of who did what, when, where, and under which policy.

### Required Audit Events

- App start and shutdown.
- User sign-in and sign-out where applicable.
- Policy loaded.
- Policy load failure.
- Analysis requested.
- Analysis allowed.
- Analysis denied.
- Analysis completed.
- Analysis failed.
- Report exported.
- Configuration changed.
- Analyzer provider selected.
- Cloud analyzer used.
- Local model started or failed.

### Recommended Audit Fields

- Event ID.
- Timestamp.
- Request ID.
- User ID where available.
- Device ID or host ID where appropriate.
- Organization ID where applicable.
- Workspace or project ID.
- Event type.
- Decision result.
- Policy version.
- App version.
- Analyzer provider.
- Sanitized project path or path hash.
- Error code if applicable.

### Acceptance Criteria

- Sensitive source content is not written to audit logs.
- Audit logs can be exported or shipped to enterprise logging systems.
- Denied actions are auditable.

## 7. Deployment and Release Management

### Current Concern

The app has build and Electron packaging support, but enterprise deployment requires more rigorous release controls.

### Required Controls

- Signed desktop installers.
- Published checksums.
- Versioned release artifacts.
- Release notes.
- Rollback instructions.
- Update channel policy.
- Silent install guidance.
- Admin configuration deployment guidance.
- Container deployment guidance for server mode.
- Environment variable reference for production.

### Release Gate

Before an enterprise release, run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run build:electron
```

Add security and accessibility checks as they are introduced.

### Acceptance Criteria

- Every release has a version, changelog entry, artifacts, checksums, and rollback notes.
- Enterprise admins can install and configure the app without manual source-code edits.

## 8. Observability and Supportability

### Current Concern

Enterprise operations teams need enough visibility to diagnose failures without reading source code or reproducing user machines manually.

### Required Controls

- Structured logs.
- Request IDs.
- Health endpoint.
- Readiness endpoint for server mode.
- Local diagnostics bundle for desktop mode.
- Crash reporting strategy for Electron.
- Optional OpenTelemetry support for server mode.
- Clear error codes and troubleshooting documentation.

### Acceptance Criteria

- Support can diagnose common failures from logs and diagnostics.
- Production logs avoid source content and secrets.
- Health checks distinguish between app availability, analyzer availability, and local model readiness.

## 9. Compliance Readiness

### Current Concern

Enterprise customers often need documentation and controls aligned with procurement, legal, and security review processes.

### Required Documents

- Security overview.
- Data flow diagram.
- Data retention policy.
- Privacy policy.
- Deployment guide.
- Admin guide.
- Incident response outline.
- Subprocessor or external-service disclosure for cloud AI usage.
- Accessibility conformance notes.

### Control Areas

- Least privilege.
- Authentication and authorization.
- Audit logging.
- Encryption in transit for server mode.
- Encryption at rest where applicable.
- Secure software updates.
- Dependency management.
- Vulnerability response process.
- Backup and restore for server mode.

### Acceptance Criteria

- Security reviewers can understand what the app reads, stores, and transmits.
- Cloud AI usage is fully optional and clearly disclosed.
- Compliance documentation is versioned with releases.

## 10. Accessibility and UX Governance

### Current Concern

The current Easy Wins analysis flagged WCAG 2.2 AA verification as a remaining readiness task.

### Required Controls

- Keyboard navigation review.
- Visible focus states.
- Accessible labels for controls and charts.
- Color contrast verification.
- Screen reader pass for the core dashboard.
- Reduced motion consideration for animations.
- Error and status messages that are announced appropriately.

### Acceptance Criteria

- Core flows are usable with keyboard only.
- The main dashboard and charts have accessible text equivalents.
- Accessibility checks are part of the release process.

## 11. AI and Model Governance

### Current Concern

The app can use local/offline AI, optional OpenAI fallback, or heuristic analysis. Enterprise customers need explicit control over these modes.

### Required Controls

- Admin policy for allowed analyzer providers.
- Explicit cloud AI opt-in.
- Clear prompt and response data handling documentation.
- Local model provenance and checksum guidance.
- Model path restrictions.
- Local model process lifecycle logging.
- Timeout and resource controls.

### Acceptance Criteria

- Enterprise mode can disable cloud AI completely.
- Enterprise mode can restrict local model paths.
- Users can see which analyzer provider produced a report.

## 12. Multi-User and Team Reporting

### Current Concern

The app is primarily a local single-user dashboard. Enterprise teams will need shared visibility and governance.

### Required Capabilities

- Workspaces or teams.
- Shared project records.
- Historical analysis trend tracking.
- Report ownership.
- Report sharing permissions.
- Organization-level easy-win and readiness summaries.
- Export controls.

### Acceptance Criteria

- Reports can be scoped to a team or workspace.
- Users only see reports they are authorized to view.
- Admins can review organization-level readiness without accessing raw source code.

## Phased Roadmap

## Phase 1: Enterprise Foundation

Goal: make the current local product governable.

Deliverables:

- Enterprise mode definition.
- Threat model.
- Policy configuration schema.
- API request validation.
- Allowed and denied path enforcement.
- Basic audit event model.
- Release checklist.

Success criteria:

- The app can run in enterprise mode with a managed policy file.
- Sensitive operations are policy-aware.
- Analysis events are auditable.

## Phase 2: Secure Managed Desktop

Goal: make desktop deployment acceptable for IT-managed environments.

Deliverables:

- Signed installer process.
- Enterprise deployment guide.
- Local diagnostics bundle.
- Local encrypted sensitive settings where applicable.
- Update channel policy.
- Offline behavior specification.

Success criteria:

- IT can deploy the app without developer intervention.
- Administrators can control local behavior through managed configuration.

## Phase 3: Team Server Mode

Goal: support shared enterprise reporting.

Deliverables:

- OIDC authentication.
- Role-based access control.
- Organization, workspace, and project model.
- Central report storage.
- Central audit logging.
- Container deployment guide.
- Backup and restore process.

Success criteria:

- Multiple users can securely share reports within authorized workspaces.
- Admins can review organization-level readiness trends.

## Phase 4: Hybrid Governance

Goal: combine local scanning with centralized policy and audit.

Deliverables:

- Desktop authentication.
- Central policy fetch.
- Offline grace period.
- Audit event sync.
- Central license or entitlement model.

Success criteria:

- Source code can remain local while enterprise admins retain governance and visibility.

## Phase 5: Compliance Package

Goal: make security and procurement review straightforward.

Deliverables:

- Security overview.
- Data flow diagram.
- Privacy and retention docs.
- Accessibility conformance notes.
- Vulnerability response policy.
- Release artifact signing and checksum process.

Success criteria:

- Enterprise reviewers can evaluate the product without requiring ad hoc engineering explanations.

## Initial Implementation Backlog

1. Add an enterprise policy schema and loader.
2. Add path allowlist and denylist enforcement before analysis.
3. Add request validation and structured errors for analysis routes.
4. Add request IDs and structured logging.
5. Add audit event types and a local audit writer.
6. Add tests for allowed paths, denied paths, invalid payloads, and oversized scans.
7. Add release checklist and checksum workflow.
8. Add WCAG 2.2 AA verification checklist.
9. Add cloud AI opt-in policy and provider disclosure.
10. Add deployment guide for managed desktop mode.

## Enterprise Acceptance Checklist

An enterprise-ready release should satisfy all of the following:

- Enterprise mode is documented.
- Security threat model is documented.
- Admin policy can restrict analysis behavior.
- API routes validate input and enforce policy.
- Analysis actions are auditable.
- Cloud AI usage is optional, disclosed, and controllable.
- Local model usage is controllable by policy.
- Sensitive data retention is documented.
- Release artifacts are versioned and signed or checksum-published.
- Deployment and rollback instructions exist.
- Accessibility checks are part of release readiness.
- Support diagnostics are available without exposing source code.
- Multi-user deployments have authentication, authorization, and workspace scoping.

## Recommended Next Step

Start with Phase 1 by adding an enterprise policy schema and enforcement path around project analysis. This creates the foundation for admin controls, audit logging, identity integration, and managed deployment without disrupting the current solo-user experience.
