import asyncio
import logging
from datetime import datetime

import pytest
from fastapi import WebSocketDisconnect

from orc_api import log as log_module


def test_log_component_prefers_env(monkeypatch):
    monkeypatch.setenv("ORC_LOG_COMPONENT", "CeLeRy")
    # pretend we are running main.py without celery in argv
    monkeypatch.setattr(log_module.sys, "argv", ["python", "main.py"])
    # check if the env variable overrides the arguments used
    assert log_module._log_component() == "celery"


def test_log_component_falls_back_to_argv(monkeypatch):
    monkeypatch.delenv("ORC_LOG_COMPONENT", raising=False)
    # pretend as if we are running celery worker
    monkeypatch.setattr(log_module.sys, "argv", ["python", "-m", "celery", "worker"])

    assert log_module._log_component() == "celery"


def test_get_log_files_uses_given_path(tmp_path):
    files = log_module.get_log_files(str(tmp_path))

    assert files == [
        str((tmp_path / "orc-os.log").resolve()),
        str((tmp_path / "orc-os-celery.log").resolve()),
    ]


def test_function_filter_matches_only_target_function():
    filt = log_module.FunctionFilter("target_fn")

    target_record = logging.LogRecord(
        name="x",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="ok",
        args=(),
        exc_info=None,
        func="target_fn",
    )
    other_record = logging.LogRecord(
        name="x",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="ok",
        args=(),
        exc_info=None,
        func="other_fn",
    )

    assert filt.filter(target_record) is True
    assert filt.filter(other_record) is False


def test_add_and_remove_filehandler(tmp_path):
    logger = logging.getLogger("test-log-add-remove")
    logger.handlers.clear()
    logger.propagate = False

    file_path = tmp_path / "logs" / "worker.log"
    log_module.add_filehandler(logger, str(file_path), backupCount=0)

    handlers = [h for h in logger.handlers if isinstance(h, logging.FileHandler)]
    assert len(handlers) == 1
    assert file_path.parent.is_dir()

    log_module.remove_file_handler(logger, name_contains="worker")
    handlers = [h for h in logger.handlers if isinstance(h, logging.FileHandler)]
    assert handlers == []


def test_parse_log_timestamp_valid_and_invalid():
    valid_line = "2026-05-27 12:34:56,123 - ORC-OS - x - INFO - message"
    invalid_line = "not-a-timestamp"

    valid_ts = log_module._parse_log_timestamp(valid_line)
    invalid_ts = log_module._parse_log_timestamp(invalid_line)

    assert valid_ts == datetime(2026, 5, 27, 12, 34, 56, 123000)
    assert invalid_ts == datetime.min


def test_tail_lines_and_get_last_lines(tmp_path):
    fn = tmp_path / "sample.log"
    fn.write_text("1\n2\n3\n4\n", encoding="utf-8")

    assert log_module._tail_lines(str(fn), 2) == ["3\n", "4\n"]
    assert log_module.get_last_lines(str(fn), count=2) == "3\n4\n"


def test_get_last_lines_raises_when_missing(tmp_path):
    missing = tmp_path / "missing.log"

    with pytest.raises(FileNotFoundError):
        log_module.get_last_lines(str(missing), count=10)


def test_get_merged_last_lines_orders_by_timestamp(tmp_path):
    f1 = tmp_path / "a.log"
    f2 = tmp_path / "b.log"

    f1.write_text(
        "2026-05-27 12:00:00,001 - ORC-OS - x - INFO - a1\n2026-05-27 12:00:02,001 - ORC-OS - x - INFO - a2\n",
        encoding="utf-8",
    )
    f2.write_text(
        "2026-05-27 12:00:01,001 - ORC-OS - x - INFO - b1\n",
        encoding="utf-8",
    )

    merged = log_module.get_merged_last_lines([str(f1), str(f2)], count=10)

    assert "a1" in merged
    assert "b1" in merged
    assert "a2" in merged
    assert merged.index("a1") < merged.index("b1") < merged.index("a2")


@pytest.mark.asyncio
async def test_stream_new_lines_emits_and_stops_on_cancel(monkeypatch, tmp_path):
    class DummyWebSocket:
        def __init__(self):
            self.messages = []

        async def send_text(self, text):
            self.messages.append(text)

    ws = DummyWebSocket()
    fn = tmp_path / "stream.log"

    sleep_calls = {"count": 0}

    async def fake_sleep(_):
        sleep_calls["count"] += 1
        if sleep_calls["count"] == 1:
            fn.write_text(
                "2026-05-27 12:00:00,001 - ORC-OS - x - INFO - stream-line\n",
                encoding="utf-8",
            )
            return
        raise asyncio.CancelledError

    monkeypatch.setattr(log_module.asyncio, "sleep", fake_sleep)

    await log_module.stream_new_lines(ws, [str(fn)])

    assert ws.messages == ["2026-05-27 12:00:00,001 - ORC-OS - x - INFO - stream-line\n"]


@pytest.mark.asyncio
async def test_stream_new_lines_stops_on_disconnect(monkeypatch, tmp_path):
    class DisconnectWebSocket:
        async def send_text(self, _):
            raise WebSocketDisconnect

    ws = DisconnectWebSocket()
    fn = tmp_path / "stream_disconnect.log"
    fn.write_text(
        "2026-05-27 12:00:00,001 - ORC-OS - x - INFO - first\n",
        encoding="utf-8",
    )

    async def fake_sleep(_):
        raise AssertionError("sleep should not be reached when websocket disconnects")

    monkeypatch.setattr(log_module.asyncio, "sleep", fake_sleep)

    # Existing content is ignored on startup. Append after startup so it is treated as a new line.
    original_getsize = log_module.os.path.getsize

    calls = {"count": 0}

    def fake_getsize(path):
        calls["count"] += 1
        if calls["count"] == 1:
            return 0
        if calls["count"] == 2:
            fn.write_text(
                "2026-05-27 12:00:01,001 - ORC-OS - x - INFO - second\n",
                encoding="utf-8",
            )
        return original_getsize(path)

    monkeypatch.setattr(log_module.os.path, "getsize", fake_getsize)

    await log_module.stream_new_lines(ws, [str(fn)])
