"""Pydantic models for control points."""

import math
from typing import List, Optional, Union

import pyproj
from pydantic import BaseModel


def compute_utm_zone(points: List[dict]) -> pyproj.CRS:
    """Compute UTM zone from list of coordinates.

    Args:
        points: List of dictionaries containing x (longitude) and y (latitude) coordinates

    Returns:
        pyproj.CRS: Complete UTM CRS object including hemisphere

    """
    # Calculate average longitude and latitude
    avg_lon = sum(p.x for p in points) / len(points)
    avg_lat = sum(p.y for p in points) / len(points)
    # UTM zones are 6 degrees wide
    # Zone 1 starts at -180 degrees
    zone = math.floor((avg_lon + 180) / 6) + 1
    # Ensure zone is within valid range (1-60)
    zone = max(1, min(60, zone))
    # Determine hemisphere
    hemisphere = "north" if avg_lat >= 0 else "south"
    # Create CRS object
    return pyproj.CRS(f"+proj=utm +zone={zone} +{hemisphere} +ellps=WGS84 +datum=WGS84 +units=m +no_defs")


# Pydantic model for responses
class ControlPoint(BaseModel):
    """Base model for a cross-section."""

    x: float
    y: float
    z: Optional[float] = None
    row: Optional[float] = None
    col: Optional[float] = None


class ControlPointSet(BaseModel):
    """Model for a set of control points."""

    control_points: Optional[List[ControlPoint]] = None
    crs: Optional[Union[str, int]] = None
    z_0: Optional[float] = None
    h_ref: Optional[float] = None

    @classmethod
    def from_gdf(cls, gdf):
        """Create ControlPointSet from GeoDataFrame."""
        if gdf.crs is not None:
            # check if not projected
            if not gdf.crs.is_projected:
                # first project to nearest UTM
                utm_zone = compute_utm_zone(points=gdf.geometry)
                gdf = gdf.to_crs(utm_zone)
            try:
                if gdf.crs.to_epsg():
                    crs_serialized = gdf.crs.to_epsg()
                else:
                    crs_serialized = gdf.crs.to_proj4()
            except Exception:
                crs_serialized = None
        else:
            crs_serialized = None
        # check if all geometries are points
        control_points = [ControlPoint(x=point.x, y=point.y, z=point.z) for point in gdf.geometry]
        return cls(control_points=control_points, crs=crs_serialized)

    @classmethod
    def from_df(cls, df):
        """Create control point set from DataFrame."""
        control_points = [ControlPoint(x=point["x"], y=point["y"], z=point["z"]) for _, point in df.iterrows()]
        return cls(control_points=control_points)

    def parse(self):
        """Parse control points into lists of coordinates."""
        # in case z is always empty, only collect x and y.
        all_z_none = all(point.z is None for point in self.control_points)
        dst = [[point.x, point.y] if all_z_none else [point.x, point.y, point.z] for point in self.control_points]
        src = [[point.col, point.row] for point in self.control_points]
        # check if any src or dst coordinates are None
        if any(None in coord for coord in src) or any(None in coord for coord in dst):
            return None, None
        return src, dst


class FittedPoints(BaseModel):
    """Response model for fitted points for a camera configuration."""

    src_est: List[List[float]]
    dst_est: List[List[float]]
    f: float
    k1: float
    k2: float
    camera_position: List[float]
    camera_rotation: List[float]
    error: float
