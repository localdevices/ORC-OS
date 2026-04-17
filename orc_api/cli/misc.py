"""Miscellaneous top-level CLI commands."""

import click

from orc_api.crud import disk_management as disk_mgmt
from orc_api.crud import login as login_crud
from orc_api.database import get_session
from orc_api.schemas.disk_management import DiskManagementCreate


def update_dm(db, min_free_space, critical_space, frequency):
    """Add a disk management record from standard inputs."""
    dm = DiskManagementCreate(
        min_free_space=min_free_space,
        critical_space=critical_space,
        frequency=frequency,
    )
    disk_mgmt.create_update(db, dm)
    click.echo("✓ Disk management settings updated successfully!")


@click.command()
def password_reset_cmd():
    """Reset password by removing password record from database."""
    db = get_session()
    try:
        deleted = login_crud.delete_all_passwords(db)
        if deleted:
            click.echo("✓ Password reset successful!")
            click.echo("  Users will be prompted to create a new password on next login.")
        else:
            click.echo("ℹ No password records found in database.")
    except Exception as e:
        click.echo(f"✗ Password reset failed: {str(e)}", err=True)
        exit(1)
    finally:
        db.close()


@click.command()
@click.argument("min_free_space", type=float, required=True)
@click.argument("critical_space", type=float, required=True)
@click.argument("frequency", type=int, required=True)
def disk_management_cmd(min_free_space, critical_space, frequency):
    """Create or update disk management settings record in database.

    MIN_FREE_SPACE: Amount of free space in GB under which cleanup will be performed.

    CRITICAL_SPACE: Amount of free space in GB considered critical (currently not used).

    FREQUENCY: Frequency in seconds for checking disk space (minimum 600s).
    """
    db = get_session()
    try:
        update_dm(db, min_free_space, critical_space, frequency)
    except Exception as e:
        click.echo(f"✗ Failed to update disk management settings: {str(e)}", err=True)
        raise SystemExit(1)
    finally:
        db.close()
