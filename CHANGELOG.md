## [0.2.2] - 2025-09-10

This is a **preproduction alpha release**, not yet fit for production and operational environments.
This release should only be used for:
- testing
- piloting
- evaluation purposes

Feedback and bug reports are highly appreciated to improve future versions.

### Added
- unit test for database creation with alembic. Essential to gaurantee migration consistency.

### Changed
- OTA updates now only replacing content of www folder to preserve folder rights and ownership
- API approached via relative url /api to prevent CORS issues
- increased timeout for video uploads to ensure enough time for larger videos is available.

### Deprecated
### Removed
### Fixed
- OTA update process front end placement fixed (was not executed)
- fixed SHA256 not recognized duirng front end download

### Security

## [0.2.1] - 2025-08-29

This is a **preproduction alpha release**, not yet fit for production and operational environments.
This release should only be used for:
- testing
- piloting
- evaluation purposes

Feedback and bug reports are highly appreciated to improve future versions.

### Added
### Changed
### Deprecated
### Removed
### Fixed
- A bug in the frames used for water level detection. Only the first frame was used. Now all frames as selected
  by the user are used. This is particularly important for videos that are pre-processed with time range for water
  level detection.

### Security


## [0.2.0] - 2025-08-15
### Added
**Authentication**. This release protects the OS from use by third parties.
- Set a password at the first start of the OS. (remember this! You can only change it with the API or from the back-end)
- After setting, you must always login with your password before using the OS.

This is a **preproduction alpha release**, not yet fit for production and operational environments.
This release should only be used for:
- testing
- piloting
- evaluation purposes

Feedback and bug reports are highly appreciated to improve future versions.

### Changed
- Small modifications in the front end to allow for more intuitive user experience.
- Moved general configuration options to top-right menu

### Deprecated
### Removed
### Fixed
- Several small bugs fixed.
- unit test for the database migrations.
### Security
- CORS origins specified. A user from outside can no longer access the API.

## [0.2.0] - 2025-08-15
### Added
**Less back-end, more front-end**. This release focuses on allowing a user to organize
as many actions as possible from the front end, so that no complicated console operations
are required.
- Over-The-Air updates. With a single click in the front end, new updates are installed.
  If updates fail, roll back of the previous version will occur automatically. Database
  migrations are also handled automatically.

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
