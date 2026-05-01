# Viewer — Documentation & Integration Kit

Documentation and reference materials for **the Viewer** — a React + Three.js runtime for configurable, geometric SaaS products (homes, cabins, boats, similar assemblies). Designed to be embedded inside a host App (a *CustomApp*) that owns business logic.

This repo is a **read-only mirror** of selected content from the Viewer's main repo (private). It is auto-synced on demand. Each commit's message records the source commit SHA so you can correlate against the main repo's history.

## What's here

- [docs/](docs/) — the full documentation set.
- [integration-kit/](integration-kit/) — reference source files copied from the main repo:
  - [viewerContractTypes.js](integration-kit/viewerContractTypes.js) — JS shapes of the Viewer's `input` and `output`.
  - [DemoApp.jsx](integration-kit/DemoApp.jsx) — the canonical reference host App. **Reference reading**: it imports from elsewhere in the main repo, so it won't run as-is from this mirror — read it for the patterns you'll mirror in your own host App.

## Where to start

- **New here?** [docs/overview.md](docs/overview.md) — what the Viewer is and the host-App pattern.
- **Integrating the Viewer into your App?** [docs/integration_guide.md](docs/integration_guide.md), then [docs/integration_walkthrough.md](docs/integration_walkthrough.md).
- **Reference for `input` / `output` types?** [docs/viewer_contract_v1_7.md](docs/viewer_contract_v1_7.md) (and the JS types in [integration-kit/viewerContractTypes.js](integration-kit/viewerContractTypes.js)).
- **Want to see a real integration?** [integration-kit/DemoApp.jsx](integration-kit/DemoApp.jsx).
- **Authoring captures (admin)?** [docs/admin_authoring_guide.md](docs/admin_authoring_guide.md).
- **Preparing a 3D model?** [docs/model_authoring_guide.md](docs/model_authoring_guide.md).
- **Testing the live build?** [docs/tester_quickstart.md](docs/tester_quickstart.md).

## A note on the Viewer's distribution

The Viewer is not yet published as an npm package or CDN bundle. Until that exists, host-App integration means vendoring the source from the main repo or pulling it in as a path/git dependency. A framework-agnostic web-component wrapper for non-React hosts (Vue, vanilla, etc.) is on the roadmap — see [docs/integration_guide.md#delivery](docs/integration_guide.md#delivery).

## License

(To be specified.)
