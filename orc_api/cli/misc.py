"""Miscellaneous top-level CLI commands."""

import click

from orc_api.crud import login as login_crud
from orc_api.database import get_session


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
