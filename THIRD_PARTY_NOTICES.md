# Third-party provenance and release boundary

## Independent application

This repository contains the existing Yuliang browser prototype and its local tooling. It is not a GitHub fork or a redistributed copy of the garmin-grafana source tree. No third-party runtime packages, fonts or remote assets are required by this initial application.

Yuliang is released under the MIT License. Copyright in this repository belongs to its contributors unless a file states otherwise.

The public core was independently implemented. Before release, the two existing commits and all historical paths were reviewed, and no exact overlap was found when 1,498 unique Yuliang source/document lines of at least 48 characters were compared with 1,123 such lines in the separately checked-out garmin-grafana tree. This bounded check supports provenance review but cannot prove the absence of every possible similarity. Generic wearable metric names, protocol shapes, and database field names are interoperability facts rather than copied implementations.

## Related, separately maintained tools

- [arpanghosh8453/garmin-grafana](https://github.com/arpanghosh8453/garmin-grafana) is a related optional local data collection and visualization tool. Its [BSD 3-Clause license](https://github.com/arpanghosh8453/garmin-grafana/blob/main/LICENSE) credits Arpan Ghosh. Its source, modifications, database, images and authentication sessions are not included here.
- [Grafana](https://grafana.com/licensing/) and other infrastructure have their own licenses. This app does not redistribute or modify Grafana's source. Any future bundling or source reuse needs a new dependency and license review.
- Garmin, Garmin Connect, Body Battery and related marks are third-party names used only to describe interoperability. This project is not affiliated with, sponsored by or endorsed by Garmin or the authors of the related tools.

If third-party code is copied into this repository later, preserve its original copyright, license and required notices at that time. An attribution link alone is not a substitute for the applicable license requirements. A software license does not grant access to Garmin's data services.
