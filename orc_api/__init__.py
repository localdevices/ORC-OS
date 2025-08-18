"""Backend API for operations and configuration for NodeORC front end."""

import os

__version__ = "0.1.0"
__home__ = os.getenv("ORC_HOME")
UPLOAD_DIRECTORY = os.getenv("ORC_UPLOAD_DIRECTORY")
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


from . import crud, db, routers, schemas, utils
