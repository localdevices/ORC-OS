"""Runtime utilities for executing release manifest compatibility checks."""

from __future__ import annotations

import asyncio
import inspect
from types import ModuleType
from typing import Any, Awaitable, Callable, cast

from orc_api.schemas.updates import CheckStatus, ManifestCheckResult, ManifestPreflightResult

CheckCallable = Callable[[], ManifestCheckResult | dict[str, Any] | Awaitable[ManifestCheckResult | dict[str, Any]]]


def _load_manifest_module(source_code: str) -> ModuleType:
    """Load an in-memory module from release-provided manifest source."""
    module = ModuleType("release_manifest")
    exec(compile(source_code, filename="release_manifest.py", mode="exec"), module.__dict__)
    return module


def _normalize_result(check_name: str, raw_result: ManifestCheckResult | dict[str, Any]) -> ManifestCheckResult:
    """Normalize check output into a typed result model."""
    if isinstance(raw_result, ManifestCheckResult):
        if not raw_result.check_id:
            raw_result.check_id = check_name
        return raw_result

    if isinstance(raw_result, dict):
        payload = dict(raw_result)
        payload.setdefault("check_id", check_name)
        payload.setdefault("status", CheckStatus.OK)
        payload.setdefault("message", "Check completed")
        return ManifestCheckResult.model_validate(payload)

    raise TypeError(
        f"Check '{check_name}' returned unsupported result type {type(raw_result).__name__}. "
        "Return a dict or ManifestCheckResult."
    )


def _get_checks(manifest_module: ModuleType) -> list[CheckCallable]:
    """Collect checks from the manifest module.

    Preferred API is a `get_checks()` function returning a list of callables.
    As fallback, all callables prefixed with `check_` are used.
    """
    get_checks = getattr(manifest_module, "get_checks", None)
    if callable(get_checks):
        checks = get_checks()
        if not isinstance(checks, list):
            raise TypeError("Manifest get_checks() must return a list of callables.")
        if not checks:
            raise ValueError("Manifest get_checks() returned an empty list.")
        for check in checks:
            if not callable(check):
                raise TypeError("Manifest get_checks() returned a non-callable item.")
        return checks

    # if get_checks does not exist, use all check_* functions as a best effort fallback
    fallback_checks = []
    for name in sorted(dir(manifest_module)):
        candidate = getattr(manifest_module, name)
        if callable(candidate) and name.startswith("check_"):
            fallback_checks.append(candidate)

    if not fallback_checks:
        raise ValueError("Manifest does not define get_checks() or any check_* functions.")
    return fallback_checks


async def _run_check(check: CheckCallable, timeout_s: float) -> ManifestCheckResult:
    """Run one check with timeout and robust error mapping."""
    check_name = getattr(check, "__name__", "unnamed_check")
    try:
        if inspect.iscoroutinefunction(check):
            raw_result = await asyncio.wait_for(check(), timeout=timeout_s)
        else:
            raw_result = await asyncio.wait_for(asyncio.to_thread(check), timeout=timeout_s)
        if inspect.isawaitable(raw_result):
            raw_result = await asyncio.wait_for(raw_result, timeout=timeout_s)
        raw_result = cast(ManifestCheckResult | dict[str, Any], raw_result)
        return _normalize_result(check_name=check_name, raw_result=raw_result)
    except asyncio.TimeoutError:
        return ManifestCheckResult(
            check_id=check_name,
            status=CheckStatus.ERROR,
            message=f"Check '{check_name}' timed out after {timeout_s:.1f}s.",
            remedy="Inspect system load and retry update.",
        )
    except Exception as exc:  # noqa: BLE001
        return ManifestCheckResult(
            check_id=check_name,
            status=CheckStatus.ERROR,
            message=f"Check '{check_name}' failed with error: {exc}",
            remedy="Review logs and fix the reported issue before updating.",
        )


async def run_manifest_checks_from_source(
    source_code: str,
    timeout_s: float = 10.0,
    blocking_statuses: list[CheckStatus] | None = None,
) -> ManifestPreflightResult:
    """Execute all checks in a release manifest and aggregate results."""
    if blocking_statuses is None:
        blocking_statuses = [CheckStatus.OUTDATED, CheckStatus.ERROR]

    manifest_module = _load_manifest_module(source_code)
    checks = _get_checks(manifest_module)

    results: list[ManifestCheckResult] = []
    # perform all checks
    for check in checks:
        results.append(await _run_check(check, timeout_s=timeout_s))

    # determine whether update can be performed or not. No test should return a blocking status.
    ok_to_update = all(result.status not in blocking_statuses for result in results)
    return ManifestPreflightResult(
        ok_to_update=ok_to_update,
        blocking_statuses=blocking_statuses,
        results=results,
    )
