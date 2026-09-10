# 余量 repository working agreement

This is the independent `zhuyep/yuliang` app. Continue feature work here.

## Scope and privacy

- The tracked app supports synthetic examples, user-selected daily JSON, and an explicitly configured read-only adapter to the separate local Garmin database. The optional local model adapter is disabled by default; cloud AI is not implemented or authorized.
- `garmin-grafana/` is a separate, ignored checkout. Do not absorb it, modify its Git history, or commit its containers, sessions or data into this repository.
- `.private/`, `.jez/`, local QA screenshots, private connectors, databases and credentials must remain untracked. The only reviewed public screenshot is the clearly labelled synthetic asset under `docs/assets/`; never replace it with a live-data capture.
- New tracked files require explicit review of both `.gitignore` and `scripts/check-repo.mjs`; never use broad force-add commands.
- This repository is an approved public-source preview. Public visibility does not authorize telemetry, cloud model calls, additional account access, release promotion, or publishing any local data.
- No health values, GPS, credentials or private screenshots in commits, issues or CI logs. Do not send health summaries to any model without the user's explicit selection and consent. Use clearly labelled synthetic fixtures for tests and reviews.

## Implementation and verification

- Preserve local-only defaults and the static server's explicit asset allowlist.
- `/` serves the new insights UI; `/index.html` preserves the old prototype. API requests require localhost Host/Origin checks and the session header. Feedback lives outside the checkout, under the user's private local state directory; demo feedback is never persisted.
- Keep deterministic statistics separate from model explanations. Never present missing data as zero, a prototype threshold as clinically validated, or example data as a live connection.
- Read `docs/ROADMAP.md` before extending scope; completed repository setup is not completed AI integration.
- Run `npm run check` before committing. The repository check inspects staged/tracked content, so stage only reviewed explicit paths, then run it again before pushing.
- Before each release, review the full Git history, third-party attribution, licensing and privacy boundaries again. Open-source licensing is not Garmin API authorization.
