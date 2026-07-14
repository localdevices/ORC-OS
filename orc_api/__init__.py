"""Backend API for operations and configuration for NodeORC front end."""

import os

__version__ = "1.0.0_dev"  # version number
__release__ = "Ngwerere"  # major version name


# default key in case none is set in env variables
ORC_DEFAULT_KEY = "ORC_DEFAULT_KEY"

# cookie settings
ORC_COOKIE_NAME = "orc_token"
ORC_COOKIE_MAX_AGE = 3600  # one hour

# hash algorithm used
ALGORITHM = "HS256"

# only allow direct children
ORIGINS = ["*"]

__home__ = os.getenv("ORC_HOME")
UPLOAD_DIRECTORY = os.getenv("ORC_UPLOAD_DIRECTORY")
timeout_before_shutdown = os.getenv("ORC_TIMEOUT_BEFORE_SHUTDOWN", 15)

if not __home__:
    __home__ = os.path.join(os.path.expanduser("~"), ".ORC-OS")
if not (os.path.isdir(__home__)):
    os.makedirs(__home__)

LOG_DIRECTORY = os.path.join(__home__, "logs")

TMP_DIRECTORY = os.path.join(__home__, "tmp")
if not UPLOAD_DIRECTORY:
    UPLOAD_DIRECTORY = os.path.join(__home__, "uploads")

INCOMING_DIRECTORY = os.getenv("ORC_INCOMING_DIRECTORY")
if not INCOMING_DIRECTORY:
    INCOMING_DIRECTORY = os.path.join(UPLOAD_DIRECTORY, "incoming")

SERVICE_DIRECTORY = os.getenv("ORC_SERVICE_DIRECTORY")
if not SERVICE_DIRECTORY:
    SERVICE_DIRECTORY = os.path.join(__home__, "services")

SECRET_KEY = os.getenv("ORC_SECRET_KEY", ORC_DEFAULT_KEY)

DEV_MODE = os.getenv("ORC_DEV_MODE", "0") == "1"
if not SECRET_KEY and not DEV_MODE:
    raise ValueError("ORC_SECRET_KEY not set and not running in development mode. Exiting")

# make all directories if they don't exist
for directory in [LOG_DIRECTORY, TMP_DIRECTORY, UPLOAD_DIRECTORY, INCOMING_DIRECTORY, SERVICE_DIRECTORY]:
    os.makedirs(directory, exist_ok=True)

from . import crud, db, routers, schemas, utils
