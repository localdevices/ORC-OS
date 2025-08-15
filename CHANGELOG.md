## [0.2.0] - 2025-08-XX
### Added
**Less back-end, more front-end**. This release focusses on allowing a user to organize
as many actions as possible from the front end, so that no complicated console operations
are required.
- Over-The-Air updates. With a single click in the front end, new updates are installed.
  If updates fail, roll back of the previous version will occur automatically. Database
  migrations are also handled automatically.
- Required back-end restart is recognised and button is displayed to restart.

This is a **preproduction alpha release**, not yet fit for production and operational environments.
This release should only be used for:
- testing
- piloting
- evaluation purposes

Feedback and bug reports are highly appreciated to improve future versions.

### Changed
- Small modifications in the front end to allow for more intuitive user experience.
- Moved general configuration options to top-right menu
-
### Deprecated
### Removed
### Fixed
### Security


## [0.1.0] - 2025-07-16
### Added
**First release of ORC-OS**. The following features are available:
- Fully visual front end for video calibration and settings for processing of videos.
- Configure automated processing on field deployed devices with a daemon settings page.
- SQLite database with migration options supported by alembic.
- Full syncing with LiveOpenRiverCam instances running on your server or in the cloud.
- API for interacting with video processing features at programming level.
This is a **preproduction alpha release**, not yet fit for production and operational environments.
This release should only be used for:
- testing
- piloting
- evaluation purposes

Feedback and bug reports are highly appreciated to improve future versions.

#### Known Limitations
- Some features may be incomplete or subject to change.
- Testing has been conducted, but unexpected issues might arise in certain setups.
- Over-the-air updates are not yet available.

### Changed
### Deprecated
### Removed
### Fixed
### Security
