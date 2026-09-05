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

- Chinese responsive UI, rule-based explanations and editable activity plans.
- Subjective feedback such as energy, soreness and discomfort.
- Synthetic examples and local JSON import, processed only in the browser session.

No real-data connector, automatic synchronization, cloud AI or persistent feedback store is included in this repository. Rules are experimental, not clinically validated. This is not a medical device or diagnostic service.

## Next steps and contribution boundary

See [the roadmap](docs/ROADMAP.md) and [architecture](docs/ARCHITECTURE.md). The next planned milestone is a read-only data adapter with data-quality checks, followed by traceable daily explanations.

This repository starts private. Its public-release license is not selected yet; do not describe it as a released open-source product. Publication requires an explicit owner decision after privacy, licensing and usability review.

The working directory may also contain ignored private experiments. Only the reviewed application files belong to this repository. Do not force-add private data, credentials, screenshots or third-party checkouts. See [third-party notices](THIRD_PARTY_NOTICES.md).
