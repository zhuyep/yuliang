# Yuliang · 余量

A local-first prototype for understanding wearable data and planning everyday activity. This is the independent application repository, not a fork of garmin-grafana.

[中文说明](README.md)

## Run locally

Requires Node.js 22.13+ (Node.js 24 is recommended). No third-party packages or package installation are needed.

```sh
npm run dev
```

Open [the local app](http://127.0.0.1:4173). Use `PORT=4180 npm run dev` if the port is occupied.

```sh
npm run check
```

## What works today

- Chinese daily-insights UI, traceable deterministic explanations and editable activity plans.
- Subjective feedback such as energy, soreness and discomfort.
- Synthetic examples, daily JSON import processed by the local service, and an opt-in read-only adapter to an existing local Garmin database.
- Explicit freshness, missing-data and baseline coverage checks; current-day steps are not compared to completed days.
- Feedback saved on demand outside the repository, with history and outcome updates. Demo feedback is not persisted.

No account login, automatic synchronization or cloud AI is included. An optional local Ollama adapter is implemented but disabled by default and only protocol-tested with synthetic responses; no actual model has been enabled. Real health summaries require separate explicit consent even for the local model. Rules are experimental, not clinically validated. This is not a medical device or diagnostic service.

Use `YULIANG_DATA_SOURCE=garmin-docker npm run dev` only when the existing local database is configured. See [local usage and model boundaries](docs/LOCAL_INSIGHTS.md). The original browser-only prototype remains at `/index.html`.

## Next steps and contribution boundary

See [the roadmap](docs/ROADMAP.md) and [architecture](docs/ARCHITECTURE.md). The next milestone is selecting and verifying an actual model with the owner's privacy choices, then evaluating the usefulness of daily feedback.

This repository starts private. Its public-release license is not selected yet; do not describe it as a released open-source product. Publication requires an explicit owner decision after privacy, licensing and usability review.

The working directory may also contain ignored private experiments. Only the reviewed application files belong to this repository. Do not force-add private data, credentials, screenshots or third-party checkouts. See [third-party notices](THIRD_PARTY_NOTICES.md).
