"""Backend API for operations and configuration for NodeORC front end."""

import os
import socket
import warnings

__version__ = "0.2.1"

# default key in case none is set in env variables
ORC_DEFAULT_KEY = "ORC_DEFAULT_KEY"

# cookie settings
ORC_COOKIE_NAME = "orc_token"
ORC_COOKIE_MAX_AGE = 3600  # one hour

# hash algorithm used
ALGORITHM = "HS256"

# define origins
HOSTNAME = socket.gethostname()
HOSTIPS = [
    socket.gethostbyname(HOSTNAME),
    socket.gethostbyname(HOSTNAME) + ".home",
    socket.gethostbyname(HOSTNAME) + ".local",
    socket.gethostbyname(HOSTNAME).lower(),
    socket.gethostbyname(HOSTNAME).lower() + ".home",
    socket.gethostbyname(HOSTNAME).lower() + ".local",
]
ports = ["80", "5173"]
subdomains = ["", ".home", ".local"]
ORIGINS = []
ORIGINS += ["http://localhost"]
ORIGINS += [f"http://{HOSTNAME}{subdomain}" for subdomain in subdomains]
for ip in HOSTIPS:
    ORIGINS += [f"http://{ip}"]
for port in ports:
    ORIGINS += ["http://localhost:" + port]
    ORIGINS += [f"http://{HOSTNAME}{subdomain}:{port}" for subdomain in subdomains]
    for ip in HOSTIPS:
        ORIGINS += [f"http://{ip}:{port}"]

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

SECRET_KEY = os.getenv("ORC_SECRET_KEY", ORC_DEFAULT_KEY)

DEV_MODE = os.getenv("ORC_DEV_MODE", "0") == "1"
if not SECRET_KEY and not DEV_MODE:
    raise ValueError("ORC_SECRET_KEY not set and not running in development mode. Exiting")

if SECRET_KEY == "ORC_DEFAULT_KEY":
    warnings.warn(
        "WARNING: Using default ORC_SECRET_KEY. This is not secure and should be changed in a production environment.",
        stacklevel=2,
    )
from . import crud, db, routers, schemas, utils
