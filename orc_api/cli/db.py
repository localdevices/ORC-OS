"""Database migration CLI commands (alembic wrapper)."""

from pathlib import Path

import click

from alembic import command
from alembic.config import Config as AlembicConfig


def get_alembic_config():
    """Get Alembic configuration object."""
    alembic_dir = Path(__file__).parent.parent / "alembic.ini"
    return AlembicConfig(str(alembic_dir))


@click.group()
def db():
    """Database migration commands."""
    pass


@db.command()
@click.option("--revision", type=str, default="head", help="Target revision (default: head for latest)")
def migrate(revision):
    """Run database migrations to a target revision, defaulting to head."""
    try:
        alembic_config = get_alembic_config()
        click.echo(f"Running migrations to {revision}...")
        command.upgrade(alembic_config, revision)
        click.echo("✓ Migrations completed successfully!")
    except Exception as e:
        click.echo(f"✗ Migration failed: {str(e)}", err=True)
        exit(1)


@db.command()
@click.option("--revision", type=str, required=True, help="Target revision to downgrade to")
def downgrade(revision):
    """Downgrade database to a previous revision."""
    try:
        alembic_config = get_alembic_config()
        click.echo(f"Downgrading database to {revision}...")
        command.downgrade(alembic_config, revision)
        click.echo("✓ Downgrade completed successfully!")
    except Exception as e:
        click.echo(f"✗ Downgrade failed: {str(e)}", err=True)
        exit(1)


@db.command()
@click.option("--message", type=str, required=True, help="Description of the migration")
@click.option("--autogenerate", is_flag=True, help="Attempt to automatically detect changes")
def revision(message, autogenerate):
    """Create a new migration script using message and optional autogenerate flag."""
    try:
        alembic_config = get_alembic_config()
        click.echo(f"Creating new migration: {message}...")
        if autogenerate:
            command.revision(alembic_config, message=message, autogenerate=True)
        else:
            command.revision(alembic_config, message=message)
        click.echo("✓ Migration script created successfully!")
    except Exception as e:
        click.echo(f"✗ Failed to create migration: {str(e)}", err=True)
        exit(1)


@db.command()
def current():
    """Show current database revision code."""
    try:
        alembic_config = get_alembic_config()
        click.echo("Current database revision:")
        command.current(alembic_config)
    except Exception as e:
        click.echo(f"✗ Failed to get current revision: {str(e)}", err=True)
        exit(1)


@db.command()
def history():
    """Show migration history."""
    try:
        alembic_config = get_alembic_config()
        click.echo("Migration history:")
        command.history(alembic_config)
    except Exception as e:
        click.echo(f"✗ Failed to get migration history: {str(e)}", err=True)
        exit(1)
