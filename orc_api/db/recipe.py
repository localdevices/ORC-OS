"""Model for ORC recipe."""

from pyorc.cli.cli_utils import validate_recipe
from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, validates

from orc_api.db import RemoteBase


class Recipe(RemoteBase):
    """Model for ORC recipe."""

    __tablename__ = "recipe"
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )
    name: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )
    data: Mapped[dict] = mapped_column(JSON, nullable=False)

    def __str__(self):
        return "{}: {}".format(self.id, self.name)

    def __repr__(self):
        return "{}".format(self.__str__())

    @validates("data")
    def validate_recipe(self, key, value):
        """Validate that the provided JSON is a valid recipe."""
        # try to read the config with pyorc
        try:
            _ = validate_recipe(value)
            return value
        except Exception as e:
            raise ValueError(f"Error while validating recipe: {str(e)}")
