"""Video-related CLI commands."""

import json
import os
import shutil
import traceback
from datetime import datetime
from pathlib import Path

import click

from orc_api import UPLOAD_DIRECTORY, crud
from orc_api.crud import video as video_crud
from orc_api.database import get_session
from orc_api.db import Video
from orc_api.db.video_config import VideoConfig
from orc_api.schemas.camera_config import CameraConfigData, CameraConfigResponse
from orc_api.schemas.cross_section import CrossSectionResponse
from orc_api.schemas.recipe import RecipeResponse
from orc_api.schemas.video import VideoCreate
from orc_api.schemas.video_config import VideoConfigResponse
from orc_api.utils.io import read_cross_section_from_csv, read_cross_section_from_geojson


@click.group()
def video():
    """Video management commands."""
    pass


@video.command()
@click.argument("file_path", type=click.Path(exists=True), required=True)
@click.argument("timestamp", type=str, required=True)
@click.option("--video-config-id", type=int, default=None, help="Optional video configuration id")
def add(file_path, timestamp, video_config_id):
    """Add a new video from file path and timestamp through CLI."""
    try:
        ts = datetime.strptime(timestamp, "%Y%m%dT%H%M%SZ")
    except Exception:
        click.echo("✗ Invalid timestamp format. Use %Y%m%dT%H%M%SZ", err=True)
        raise SystemExit(1)

    db = get_session()
    try:
        video_schema = VideoCreate(timestamp=ts, video_config_id=video_config_id)
        video_instance = Video(**video_schema.model_dump(exclude_none=True))
        video_instance = video_crud.add(db=db, video=video_instance)

        date_dir = ts.strftime("%Y%m%d")
        rel_file_path = os.path.join("videos", date_dir, str(video_instance.id), os.path.basename(file_path))
        abs_file_path = os.path.join(UPLOAD_DIRECTORY, rel_file_path)
        os.makedirs(os.path.dirname(abs_file_path), exist_ok=True)
        shutil.copyfile(file_path, abs_file_path)

        video_instance.file = rel_file_path
        db.commit()
        db.refresh(video_instance)

        click.echo(f"✓ Video added: id={video_instance.id} file={rel_file_path}")
    except Exception as e:
        click.echo(f"✗ Adding video failed: {e}", err=True)
        raise SystemExit(1)
    finally:
        db.close()


@video.command(name="list")
@click.option("--skip", type=int, default=0, help="Number of records to skip (default: 0)")
@click.option("--limit", type=int, default=100, help="Maximum number of records to return (default: 100)")
def list_cmd(skip, limit):
    """List videos on CLI."""
    db = get_session()
    try:
        videos = video_crud.get_list(db, first=skip, count=limit)
        if not videos:
            click.echo("No videos found.")
            return
        header = f"{'ID':<6} {'Timestamp':<20} {'Status':<10} {'Sync':<10} {'File':<50}"
        click.echo(header)
        click.echo("-" * len(header))
        for video in videos:
            video_id = str(video.id)[:6]
            timestamp = video.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            status = video.status.name if video.status else "UNKNOWN"
            sync_status = video.sync_status.name if video.sync_status else "UNKNOWN"
            file_name = os.path.basename(video.file) if video.file else "N/A"
            if len(file_name) > 50:
                file_name = file_name[:47] + "..."
            click.echo(f"{video_id:<6} {timestamp:<20} {status:<10} {sync_status:<10} {file_name:<50}")
        click.echo(f"\nShowing {len(videos)} video(s) (skip={skip}, limit={limit})")
    except Exception as e:
        click.echo(f"✗ List command failed: {e}", err=True)
        raise SystemExit(1)
    finally:
        db.close()


@video.command()
@click.argument("video_id", type=int, required=True)
def delete(video_id):
    """Delete a single video through CLI."""
    db = get_session()
    try:
        video = video_crud.get(db, video_id)
        if not video:
            click.echo(f"✗ Video with ID {video_id} not found", err=True)
            raise SystemExit(1)
        file_info = video.file if video.file else "N/A"
        timestamp = video.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        click.echo("Deleting video:")
        click.echo(f"  ID: {video_id}")
        click.echo(f"  Timestamp: {timestamp}")
        click.echo(f"  File: {file_info}")
        video_crud.delete(db, video_id)
        click.echo(f"✓ Video {video_id} deleted successfully")
    except ValueError as e:
        click.echo(f"✗ Error: {e}", err=True)
        raise SystemExit(1)
    except Exception as e:
        click.echo(f"✗ Delete command failed: {e}", err=True)
        raise SystemExit(1)
    finally:
        db.close()


@video.command()
@click.argument("config_name", type=str, required=True)
@click.option(
    "--sample-video-id",
    type=click.INT,
    required=True,
    help="ID of an existing video to use as sample for camera config",
)
@click.option(
    "--camera-config-file",
    type=click.Path(exists=True),
    required=True,
    help="Path to camera configuration file (JSON format)",
)
@click.option(
    "--recipe-file", type=click.Path(exists=True), required=True, help="Path to recipe file (JSON or YAML format)"
)
@click.option(
    "--cross-section-file",
    "cross_section_file",
    type=click.Path(exists=True),
    required=True,
    help="Path to cross-section file (CSV or JSON format)",
)
@click.option(
    "--cross-section-wl-file",
    "cross_section_wl_file",
    type=click.Path(exists=True),
    required=False,
    help="Path to cross-section file for water level (CSV or JSON format)",
)
def add_config(
    config_name, sample_video_id, camera_config_file, recipe_file, cross_section_file, cross_section_wl_file
):
    """Add a new video configuration with dependencies from CLI."""
    db = get_session()
    try:
        click.echo("Loading camera configuration...")
        try:
            with open(camera_config_file, "r") as f:
                camera_config_dict = json.load(f)
        except json.JSONDecodeError as e:
            click.echo(f"✗ Invalid JSON in camera config file: {e}", err=True)
            raise SystemExit(1)
        except Exception as e:
            click.echo(f"✗ Failed to read camera config file: {e}", err=True)
            raise SystemExit(1)

        click.echo("Loading recipe...")
        recipe_path = Path(recipe_file)
        try:
            if recipe_path.suffix.lower() in [".yaml", ".yml"]:
                import yaml

                with open(recipe_file, "r") as f:
                    recipe_dict = yaml.safe_load(f)
            else:
                with open(recipe_file, "r") as f:
                    recipe_dict = json.load(f)
        except json.JSONDecodeError as e:
            click.echo(f"✗ Invalid JSON in recipe file: {e}", err=True)
            raise SystemExit(1)
        except Exception as e:
            click.echo(f"✗ Failed to read recipe file: {e}", err=True)
            raise SystemExit(1)

        if cross_section_file:
            click.echo("Loading cross-section data...")
            try:
                if Path(cross_section_file).suffix.lower() == ".csv":
                    cross_section = read_cross_section_from_csv(Path(cross_section_file))
                elif Path(cross_section_file).suffix.lower() in [".json", ".geojson"]:
                    cross_section = read_cross_section_from_geojson(Path(cross_section_file))
                else:
                    click.echo(f"✗ Unsupported cross-section file format: {cross_section_file}", err=True)
                    raise SystemExit(1)
            except Exception as e:
                click.echo(f"✗ Failed to read cross-section file: {e}", err=True)
                raise SystemExit(1)
        else:
            cross_section = None

        if cross_section_wl_file:
            click.echo("Loading cross-section for water level data...")
            try:
                if Path(cross_section_wl_file).suffix.lower() == ".csv":
                    cross_section_wl = read_cross_section_from_csv(Path(cross_section_wl_file))
                elif Path(cross_section_wl_file).suffix.lower() in [".json"]:
                    cross_section_wl = read_cross_section_from_geojson(Path(cross_section_wl_file))
                else:
                    click.echo(f"✗ Unsupported cross-section file format: {cross_section_wl_file}", err=True)
                    raise SystemExit(1)
            except Exception as e:
                click.echo(f"✗ Failed to read cross-section file: {e}", err=True)
                raise SystemExit(1)
        else:
            cross_section_wl = None

        click.echo("Creating camera configuration object...")
        try:
            # create proper camera config
            camera_config_data_obj = CameraConfigData(**camera_config_dict)
            camera_config = CameraConfigResponse(name=config_name, data=camera_config_data_obj)
            camera_config = camera_config.patch_post(db)
        except Exception as e:
            click.echo(f"✗ Invalid camera configuration: {e}", err=True)
            traceback.print_exc()
            raise SystemExit(1)

        click.echo("Creating recipe object...")
        try:
            recipe = RecipeResponse(name=config_name, data=recipe_dict)
            recipe = recipe.patch_post(db)
        except Exception as e:
            click.echo(f"✗ Invalid recipe: {e}", err=True)
            traceback.print_exc()
            raise SystemExit(1)

        if cross_section:
            click.echo("Creating cross-section object...")
            try:
                cross_section_obj = CrossSectionResponse(name=config_name, features=cross_section)
                cross_section_obj = cross_section_obj.patch_post(db)
            except Exception as e:
                click.echo(f"✗ Invalid cross-section data: {e}", err=True)
                traceback.print_exc()
                raise SystemExit(1)
        else:
            cross_section_obj = None

        if cross_section_wl:
            click.echo("Creating cross-section for water level object...")
            try:
                cross_section_wl_obj = CrossSectionResponse(name=f"{config_name}_wl", features=cross_section_wl)
                cross_section_wl_obj = cross_section_wl_obj.patch_post(db)
            except Exception as e:
                click.echo(f"✗ Invalid cross-section for water level data: {e}", err=True)
                traceback.print_exc()
                raise SystemExit(1)
        else:
            cross_section_wl_obj = None

        click.echo("Creating video configuration...")
        try:
            video_config = VideoConfig(
                name=config_name,
                sample_video_id=sample_video_id,
                camera_config_id=camera_config.id,
                recipe_id=recipe.id,
                cross_section_id=cross_section_obj.id if cross_section_obj else None,
                cross_section_wl_id=cross_section_wl_obj.id if cross_section_wl_obj else None,
            )
            saved_config = crud.video_config.add(db, video_config)
            saved_config = VideoConfigResponse.model_validate(saved_config)
            # update the selected video
            crud.video.update(db, sample_video_id, {"video_config_id": saved_config.id})
            click.echo("\n✓ Video configuration created successfully!")
            click.echo(f"  Config ID: {saved_config.id}")
            click.echo(f"  Name: {saved_config.name}")
            click.echo(f"  Camera Config ID: {saved_config.camera_config_id}")
            click.echo(f"  Recipe ID: {saved_config.recipe_id}")
            if saved_config.cross_section_id:
                click.echo(f"  Cross-section ID: {saved_config.cross_section_id}")
            if saved_config.cross_section_wl_id:
                click.echo(f"  Cross-section WL ID: {saved_config.cross_section_wl_id}")
            if saved_config.camera_config:
                click.echo(f"  Ready to run cam-config: {saved_config.camera_config.allowed_to_run}")
            click.echo(f"  Ready to run: {saved_config.ready_to_run}")
        except Exception as e:
            click.echo(f"✗ Failed to create video configuration: {e}", err=True)
            raise SystemExit(1)

    except SystemExit:
        raise
    except Exception as e:
        click.echo(f"✗ Unexpected error: {e}", err=True)
        raise SystemExit(1)
    finally:
        db.close()
