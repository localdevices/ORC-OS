"""Model for video config."""

from sqlalchemy import JSON, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from orc_api.db import RemoteBase


class VideoConfig(RemoteBase):
    """Represents all information required to process Video instances."""

    __tablename__ = "video_config"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    camera_config_id: Mapped[int] = mapped_column(Integer, ForeignKey("camera_config.id"), nullable=False)
    recipe_id: Mapped[int] = mapped_column(Integer, ForeignKey("recipe.id"), nullable=False)
    cross_section_id: Mapped[int] = mapped_column(Integer, ForeignKey("cross_section.id"), nullable=True)
    rvec: Mapped[list[float]] = mapped_column(
        JSON,
        nullable=False,
        default=[0.0, 0.0, 0.0],
        comment="Rotation vector for matching CrossSection with CameraConfig",
    )
    tvec: Mapped[list[float]] = mapped_column(
        JSON,
        nullable=False,
        default=[0.0, 0.0, 0.0],
        comment="Translation vector for matching CrossSection with CameraConfig",
    )
    camera_config = relationship("CameraConfig")
    recipe = relationship("Recipe")
    cross_section = relationship("CrossSection")

    def __str__(self):
        return "{}: {}".format(self.timestamp, self.file)

    def __repr__(self):
        return "{}".format(self.__str__())
