"""CLI commands for managing ORC-OS passwords."""

import click

from orc_api.crud import login as login_crud
from orc_api.database import get_session


def reset_password():
    """Reset the single password of ORC-OS."""
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
    return deleted


def check_for_existing_password(db):
    """Check if a password record exists in the database."""
    try:
        existing_password = login_crud.get(db)
        return existing_password is not None
    except Exception as e:
        click.echo(f"✗ Failed to check for existing password: {str(e)}", err=True)
        exit(1)
    finally:
        db.close()


@click.group()
def password():
    """Password commands."""
    pass


@password.command(name="reset")
def reset():
    """Reset the password for ORC-OS. You may generate a new password in the UI."""
    deleted = reset_password()
    if deleted:
        click.echo("  Users will be prompted to create a new password on next login.")


@password.command(name="set")
@click.option("--new_password", type=str, prompt=True)
def set_password(new_password):
    """Set a new password for ORC-OS."""
    print(f"PASSWORD: {new_password}")
    try:
        with get_session() as db:
            pw_exists = check_for_existing_password(db)
            if pw_exists:
                click.echo("Existing password found. Please enter your existing password to confirm the change.")
                old_password = click.prompt("Existing Password", hide_input=True, confirmation_prompt=False)
                # verify
                if not login_crud.verify(db, old_password):
                    click.echo("✗ Existing password is incorrect.", err=True)
                    exit(1)
                click.echo("Existing password verified. Proceeding to update the password.")
            else:
                click.echo("No existing password found. Setting a new password.")
            if pw_exists:
                login_crud.update(db, new_password)
            else:
                login_crud.create(db, new_password)
            click.echo("✓ Password set successfully!")
    except Exception as e:
        click.echo(f"✗ Failed to set password: {str(e)}", err=True)
        exit(1)
