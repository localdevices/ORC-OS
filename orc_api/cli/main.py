"""Main CLI entrypoint that registers subcommand groups."""

import click

from .db import db as db_group
from .misc import password_reset_cmd
from .service import service as service_group
from .video import video as video_group


@click.group()
def orc():
    """ORC-OS Command Line Interface."""
    pass


# register groups
orc.add_command(service_group)
orc.add_command(video_group)
orc.add_command(db_group)

# register top-level commands
orc.add_command(password_reset_cmd, name="password_reset")


if __name__ == "__main__":
    orc()
