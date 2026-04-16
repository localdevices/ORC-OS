"""Redis pub/sub utilities for real-time updates via websockets."""

import asyncio
import json
import logging
from typing import Callable, Optional

import redis.asyncio as aioredis
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class RedisPubSubManager:
    """Manage Redis pub/sub for real-time websocket updates."""

    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        """Initialize the Redis pub/sub manager.

        Parameters
        ----------
        redis_url : str
            URL of the Redis server for pub/sub

        """
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None

    async def connect(self):
        """Connect to Redis for pub/sub."""
        try:
            self.redis = await aioredis.from_url(self.redis_url, decode_responses=True)
            # ping the server to confirm connection
            await self.redis.ping()
            logger.info("Connected to Redis for pub/sub")
        except Exception as e:
            self.redis = None
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    async def disconnect(self):
        """Disconnect from Redis."""
        if self.redis:
            await self.redis.aclose()
            logger.info("Disconnected from Redis")

    async def is_available(self) -> bool:
        """Check if Redis connection is available."""
        if not self.redis:
            return False
        try:
            await self.redis.ping()
            return True
        except Exception as e:
            logger.error(f"Redis connection unavailable: {e}")
            return False

    async def subscribe_and_stream(
        self,
        websocket: WebSocket,
        channels: list[str],
        message_handler: Optional[Callable] = None,
    ):
        """Subscribe to Redis pub/sub channels and stream messages to websocket.

        Parameters
        ----------
        websocket : WebSocket
            The websocket to stream messages to
        channels : list[str]
            List of channel names to subscribe to
        message_handler : Optional[Callable]
            Optional async function to process messages before sending to websocket

        """
        if not self.redis:
            await self.connect()

        try:
            if not self.redis:
                # Should never happen as redis connection is awaited above, but just in case...
                logger.error("Redis connection not available for pub/sub")
                return
            pubsub = self.redis.pubsub()
            await pubsub.subscribe(*channels)
            logger.info(f"Subscribed to channels: {channels}")

            try:
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = message.get("data")

                        # Parse JSON if possible
                        try:
                            if isinstance(data, str):
                                data = json.loads(data)
                        except (json.JSONDecodeError, TypeError):
                            pass

                        # Apply custom handler if provided
                        if message_handler:
                            data = await message_handler(data)

                        # Send to websocket
                        try:
                            if isinstance(data, dict):
                                await websocket.send_json(data)
                            else:
                                await websocket.send_text(str(data))
                        except Exception as e:
                            logger.error(f"Error sending to websocket: {e}")
                            break
            finally:
                await pubsub.unsubscribe(*channels)

        except asyncio.CancelledError:
            # cancellation has specific exception handler
            logger.info("Redis subscription task cancelled")
        except Exception as e:
            # other errors have general exception handler
            logger.error(f"Error in Redis subscription: {e}")
        finally:
            if pubsub:
                await pubsub.close()


# Global Redis pub/sub manager instance
redis_pubsub_manager = RedisPubSubManager()


async def get_redis_pubsub_manager() -> RedisPubSubManager:
    """Get the Redis pub/sub manager, ensuring it's connected."""
    if redis_pubsub_manager.redis is None:
        # only return once connected, otherwise FastAPI startup will fail if Redis is unavailable
        await redis_pubsub_manager.connect()
    return redis_pubsub_manager
