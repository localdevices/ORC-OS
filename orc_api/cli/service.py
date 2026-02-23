"""Service-related CLI commands (import/export)."""

import json
from pathlib import Path
from typing import Optional

import click

from orc_api import crud
from orc_api.database import get_session
from orc_api.schemas.service import (
    ServiceCreate,
    ServiceExecutor,
    ServiceExportData,
    ServiceParameterCreate,
    ServiceParameterResponse,
    ServiceUpdate,
)


def load_json_file(filepath: Path) -> dict:
    """Load JSON data from a file."""
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")
    with open(filepath, "r") as f:
        return json.load(f)


def save_json_file(filepath: Path, data: dict, pretty: bool = True) -> None:
    """Save JSON data to a file."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w") as f:
        if pretty:
            json.dump(data, f, indent=2)
        else:
            json.dump(data, f)


def import_service(
    json_path: Path,
    db,
    preserve_env: bool = True,
    deploy: bool = False,
) -> dict:
    """Import a service from a JSON file."""
    try:
        data = load_json_file(json_path)
        service_data = ServiceExportData.model_validate(data)

        existing = crud.service.get_service_by_short_name(db, service_data.service_short_name)

        if existing:
            click.echo(f"Service '{service_data.service_short_name}' already exists. Updating...")
            service_id = existing.id
            service_update = ServiceUpdate(
                service_long_name=service_data.service_long_name,
                description=service_data.description,
                version=service_data.version,
                update_url=service_data.update_url,
            )
            db_service = crud.service.update_service(db, service_id, service_update)
            for param in existing.parameters:
                crud.service.delete_service_parameter(db, param.id)
            for param in service_data.parameters:
                crud.service.add_service_parameter(db, service_id, param)
            db_service = crud.service.get_service(db, service_id)
        else:
            click.echo(f"Creating new service '{service_data.service_short_name}'...")
            service_create = ServiceCreate(
                service_short_name=service_data.service_short_name,
                service_long_name=service_data.service_long_name,
                service_type=service_data.service_type,
                description=service_data.description,
                parameters=service_data.parameters,
            )
            db_service = crud.service.create_service(db, service_create)
            service_update = ServiceUpdate(
                version=service_data.version,
                update_url=service_data.update_url,
            )
            db_service = crud.service.update_service(db, db_service.id, service_update)
        if not db_service:
            click.echo("✗ Failed to create service", err=True)
            exit(1)

        result = {
            "status": "success",
            "service_id": db_service.id,
            "service_short_name": db_service.service_short_name,
            "service_long_name": db_service.service_long_name,
            "version": db_service.version,
        }

        if deploy and service_data.script_content:
            click.echo("Deploying service to systemd...")
            executor = ServiceExecutor(
                service_short_name=db_service.service_short_name,
                service_long_name=db_service.service_long_name,
                parameters=[ServiceParameterResponse.model_validate(p) for p in db_service.parameters],
                service_type=db_service.service_type,
            )
            existing_env = {}
            if preserve_env:
                env_dict = executor.read_env_file()
                for param in db_service.parameters:
                    if param.parameter_short_name in env_dict:
                        existing_env[param.id] = env_dict[param.parameter_short_name]
            executor.deploy_service(
                script_content=service_data.script_content,
                parameter_values=existing_env if preserve_env else None,
                on_boot_sec=service_data.on_boot_sec or "5s",
                frequency=service_data.timer_frequency or 15,
            )
            result["deployed"] = True

        return result

    except Exception as e:
        return {"status": "error", "message": str(e)}


def export_service(service_id: int, db, output_path: Optional[Path] = None) -> dict:
    """Export a service to a JSON file."""
    try:
        service = crud.service.get_service(db, service_id)
        if not service:
            return {"status": "error", "message": f"Service with ID {service_id} not found"}

        script_content = None
        try:
            executor = ServiceExecutor(
                service_short_name=service.service_short_name,
                service_long_name=service.service_long_name,
                parameters=[ServiceParameterResponse.model_validate(p) for p in service.parameters],
                service_type=service.service_type,
            )
            if executor.service_script and Path(executor.service_script).is_file():
                with open(executor.service_script, "r") as f:
                    script_content = f.read()
        except Exception:
            pass

        parameters = [
            ServiceParameterCreate(
                parameter_short_name=p.parameter_short_name,
                parameter_long_name=p.parameter_long_name,
                parameter_type=p.parameter_type,
                default_value=p.default_value,
                nullable=p.nullable,
                description=p.description,
            )
            for p in service.parameters
        ]

        export_data = ServiceExportData(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            service_type=service.service_type,
            description=service.description,
            version=service.version or "0.0.0",
            update_url=service.update_url,
            parameters=parameters,
            script_content=script_content,
        )

        result = {
            "status": "success",
            "service_id": service_id,
            "service_short_name": service.service_short_name,
            "data": export_data.model_dump(mode="json"),
        }

        if output_path:
            save_json_file(output_path, export_data.model_dump(mode="json"))
            result["saved_to"] = str(output_path)
            click.echo(f"Service exported to: {output_path}")

        return result

    except Exception as e:
        return {"status": "error", "message": str(e)}


@click.group()
def service():
    """Service management commands."""
    pass


@service.command(name="import")
@click.argument("json_file", type=click.Path(exists=True), required=True)
@click.option("--preserve-env/--no-preserve-env", default=True, help="Preserve existing .env file values")
@click.option("--deploy", is_flag=True, help="Deploy the service to systemd after import")
def import_cmd(json_file, preserve_env, deploy):
    """Import a service from a JSON file through CLI."""
    db = get_session()
    try:
        result = import_service(Path(json_file), db, preserve_env=preserve_env, deploy=deploy)
        if result["status"] == "success":
            click.echo("\n✓ Service imported successfully!")
            click.echo(f"  Service ID: {result['service_id']}")
            click.echo(f"  Short name: {result['service_short_name']}")
            click.echo(f"  Long name: {result['service_long_name']}")
            click.echo(f"  Version: {result['version']}")
            if result.get("deployed"):
                click.echo("  Status: Deployed to systemd")
        else:
            click.echo(f"✗ Import failed: {result['message']}", err=True)
            exit(1)
    finally:
        db.close()


@service.command(name="export")
@click.argument("service_id", type=int, required=True)
@click.option("-o", "--output", type=click.Path(), help="Output file path")
def export_cmd(service_id, output):
    """Export a service to a JSON file through CLI."""
    db = get_session()
    try:
        output_path = Path(output) if output else None
        result = export_service(service_id, db, output_path)
        if result["status"] == "success":
            if output:
                click.echo("✓ Service exported successfully!")
            else:
                click.echo(json.dumps(result["data"], indent=2))
        else:
            click.echo(f"✗ Export failed: {result['message']}", err=True)
            exit(1)
    finally:
        db.close()


@click.command()
@click.argument("service_id", type=int, required=True)
@click.option("--force", is_flag=True, help="Force update without version check")
def update_cmd(service_id, force):
    """Check for and install service updates."""
    import requests

    db = get_session()
    try:
        service = crud.service.get_service(db, service_id)
        if not service:
            click.echo(f"✗ Service with ID {service_id} not found", err=True)
            exit(1)

        click.echo(f"Checking for updates for '{service.service_short_name}'...")
        current_version = service.version or "0.0.0"
        click.echo(f"  Current version: {current_version}")

        if not service.update_url:
            click.echo("✗ No update URL configured for this service", err=True)
            exit(1)

        try:
            response = requests.get(service.update_url, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            click.echo(f"✗ Failed to fetch update manifest: {str(e)}", err=True)
            exit(1)

        if "version" not in data or "service_data" not in data:
            click.echo("✗ Invalid update manifest format", err=True)
            exit(1)

        latest_version = data["version"]
        click.echo(f"  Latest version: {latest_version}")

        def compare_versions(current: str, latest: str) -> int:
            def parse_version(v: str) -> tuple:
                parts = v.split(".")
                try:
                    return tuple(int(p) for p in parts)
                except ValueError:
                    return tuple(0 for _ in parts)

            current_parts = parse_version(current)
            latest_parts = parse_version(latest)
            max_len = max(len(current_parts), len(latest_parts))
            current_parts = current_parts + (0,) * (max_len - len(current_parts))
            latest_parts = latest_parts + (0,) * (max_len - len(latest_parts))

            if current_parts < latest_parts:
                return -1
            elif current_parts > latest_parts:
                return 1
            else:
                return 0

        version_cmp = compare_versions(current_version, latest_version)

        if version_cmp >= 0 and not force:
            click.echo("✓ Service is already up to date")
            return

        if version_cmp < 0 or force:
            click.echo("Installing update...")
            service_data_dict = data["service_data"]
            import json
            from tempfile import NamedTemporaryFile

            temp = NamedTemporaryFile(delete=False, suffix=".json")
            try:
                temp.write(json.dumps(service_data_dict).encode())
                temp.flush()
                from orc_api.cli.service import import_service

                result = import_service(Path(temp.name), db, preserve_env=True, deploy=True)
                if result["status"] == "success":
                    click.echo("\n✓ Service updated successfully!")
                    click.echo(f"  New version: {data['version']}")
                    if result.get("deployed"):
                        click.echo("  Status: Redeployed to systemd")
                else:
                    click.echo(f"✗ Update failed: {result['message']}", err=True)
                    exit(1)
            finally:
                try:
                    import os

                    os.unlink(temp.name)
                except Exception:
                    pass
    finally:
        db.close()
