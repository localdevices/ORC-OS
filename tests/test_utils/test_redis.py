from unittest.mock import AsyncMock, MagicMock

import pytest

from orc_api.utils.redis_pubsub import RedisPubSubManager


@pytest.mark.asyncio
async def test_redis_connect(mocker):
    manager = RedisPubSubManager(redis_url="redis://mock-server:6379/0")
    fake_redis = MagicMock()
    fake_redis.ping = AsyncMock()
    mock_from_url = mocker.patch(
        "orc_api.utils.redis_pubsub.aioredis.from_url",
        new_callable=AsyncMock,
        return_value=fake_redis,
    )

    await manager.connect()

    mock_from_url.assert_called_once_with("redis://mock-server:6379/0", decode_responses=True)
    fake_redis.ping.assert_awaited_once()
    assert manager.redis is fake_redis


@pytest.mark.asyncio
async def test_redis_connect_ping_fails(mocker):
    manager = RedisPubSubManager(redis_url="redis://mock-server:6379/0")
    fake_redis = MagicMock()
    fake_redis.ping = AsyncMock()
    fake_redis.ping.side_effect = RuntimeError("redis unavailable")
    mocker.patch(
        "orc_api.utils.redis_pubsub.aioredis.from_url",
        new_callable=AsyncMock,
        return_value=fake_redis,
    )

    with pytest.raises(RuntimeError, match="redis unavailable"):
        await manager.connect()

    assert manager.redis is None
