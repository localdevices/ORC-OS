"""I/O utils."""

import json
from io import StringIO
from pathlib import Path
from typing import Union

import geopandas as gpd
import numpy as np
import pandas as pd
from fastapi import HTTPException
from pyorc.api.cross_section import _fit_line
from shapely.geometry import Point


def linearize_points(gdf):
    """Straighten points in GeoDataFrame along average line with nearest snapping."""
    centroid, direction, angle = _fit_line(gdf.geometry.x, gdf.geometry.y)
    # Project each point onto the line closest-distance
    coords = np.column_stack([gdf.geometry.x, gdf.geometry.y])
    coords_centered = coords - centroid

    # Project onto the line direction
    projections = np.dot(coords_centered, direction)

    # Calculate new coordinates on the line
    new_x = centroid[0] + projections * direction[0]
    new_y = centroid[1] + projections * direction[1]
    new_geometries = [Point(_x, _y, _z) for _x, _y, _z in zip(new_x, new_y, gdf.geometry.z)]
    # Create new geometries with Z preserved
    gdf.geometry = new_geometries
    return gdf


def read_cross_section_from_geojson(input: Union[Path, str], linearize=False) -> dict:
    """Read cross-section data from json-string or file and return as a CrossSectionCreate object."""
    if isinstance(input, Path):
        if not input.exists():
            raise FileNotFoundError(f"File {input} does not exist.")
        with open(input, "r") as f:
            cs_body = f.read()
    else:
        cs_body = input
    try:
        cs = json.loads(cs_body)
        if "crs" in cs:
            crs = cs["crs"]
        else:
            crs = None
        # extract crs
        gdf = gpd.read_file(cs_body)
        # gpd parses a random CRS on a gdf if no crs is given in shapefile. If crs is None, also set gdf.crs to None
        if crs is None:
            gdf = gdf.set_crs(None, allow_override=True)  # type: ignore
    except Exception:
        raise HTTPException(status_code=400, detail="File is not a properly formatted JSON file")
    try:
        if linearize:
            gdf = linearize_points(gdf)
        cs = json.loads(gdf.to_json())
        if crs is not None:
            # add the crs, this gets lost in translation
            cs["crs"] = crs
        else:
            cs.pop("crs")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cs


def read_cross_section_from_csv(input: Union[Path, str], linearize: bool = False) -> dict:
    """Read cross-section data from csv-string or file and return as a CrossSectionCreate object."""
    if isinstance(input, Path):
        if not input.exists():
            raise FileNotFoundError(f"File {input} does not exist.")
        with open(input, "r") as f:
            df = pd.read_csv(f)
    else:
        df = pd.read_csv(StringIO(input))
    # convert all keys to lower case
    df = df.rename(columns=str.lower)
    # look for (lower) X, Y, Z
    expected_keys = {"x", "y", "z"}
    # Check if all strings exist in the list
    if expected_keys.issubset([k.lower() for k in df.keys()]):
        # parse to gdf
        geometry = gpd.points_from_xy(df["x"], df["y"], df["z"])
        gdf = gpd.GeoDataFrame(df, geometry=geometry)
        if linearize:
            gdf = linearize_points(gdf)
        # turn into json
        cs = json.loads(gdf.to_json())
    else:
        raise HTTPException(status_code=400, detail="CSV file must contain columns X, Y, Z")
    return cs
