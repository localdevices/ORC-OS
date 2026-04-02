"""Schemas for update-related API endpoints."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class CheckStatus(str, Enum):
    """Supported statuses for a compatibility check result."""

    OK = "OK"
    NOT_AVAILABLE = "NOT_AVAILABLE"  # e.g. when optional dependency does not apply, e.g. LiveORC version
    OUTDATED = "OUTDATED"
    ERROR = "ERROR"


class ManifestCheckResult(BaseModel):
    """Single manifest check outcome."""

    check_id: str = Field(description="Stable identifier for the check.")
    status: CheckStatus = Field(description="Machine-readable status.")
    message: str = Field(description="User-facing explanation.")
    remedy: str | None = Field(default=None, description="Suggested action to resolve a failing check.")
    details: dict[str, Any] | None = Field(default=None, description="Extra debug details.")


class ManifestPreflightResult(BaseModel):
    """Aggregated preflight outcome for a release manifest."""

    ok_to_update: bool = Field(description="Whether the update may proceed.")
    blocking_statuses: list[CheckStatus] = Field(description="Statuses that block updating.")
    results: list[ManifestCheckResult] = Field(description="Ordered list of check results.")


class VersionedPreflightResponse(ManifestPreflightResult):
    """Preflight response that includes version information about the release being checked."""

    tag_name: str


class ReleaseItem(BaseModel):
    """Single release item from GitHub API response."""

    tag_name: str = Field(description="Release tag, e.g. v0.6.1")
    published_at: str | None = Field(default=None, description="GitHub release publish timestamp")
    prerelease: bool = Field(default=False, description="Whether this is a prerelease")


class ReleaseListResponse(BaseModel):
    """List of release items from GitHub API response."""

    releases: list[ReleaseItem]
