"""Backend API for operations and configuration for NodeORC front end."""

import os

__version__ = "0.1.0"
__home__ = os.getenv("ORC_HOME")

if not __home__:
    __home__ = os.path.join(os.path.expanduser("~"), ".ORC-OS")
if not (os.path.isdir(__home__)):
    os.makedirs(__home__)

from . import crud, db, routers, schemas, utils
