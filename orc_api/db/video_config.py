"""Model for video config."""

from sqlalchemy import JSON, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from orc_api.db import RemoteBase


class VideoConfig(RemoteBase):
    """Represents all information required to process Video instances."""

    __tablename__ = "video_config"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, comment="Named description of the video configuration")
    camera_config_id: Mapped[int] = mapped_column(Integer, ForeignKey("camera_config.id"), nullable=True)
    recipe_id: Mapped[int] = mapped_column(Integer, ForeignKey("recipe.id"), nullable=True)
    cross_section_id: Mapped[int] = mapped_column(Integer, ForeignKey("cross_section.id"), nullable=True)
    cross_section_wl_id: Mapped[int] = mapped_column(Integer, ForeignKey("cross_section.id"), nullable=True)
    sample_video_id: Mapped[int] = mapped_column(
        Integer,
        # ForeignKey("video.id", ondelete="SET NULL"),
        nullable=True,
        comment="Video containing sampling information such as GCPs",
    )
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
    camera_config = relationship("CameraConfig", foreign_keys=[camera_config_id])
    recipe = relationship("Recipe", foreign_keys=[recipe_id])
    cross_section = relationship("CrossSection", foreign_keys=[cross_section_id])
    cross_section_wl = relationship("CrossSection", foreign_keys=[cross_section_wl_id])
    sample_video = relationship(
        "Video", foreign_keys=[sample_video_id], primaryjoin="Video.id == VideoConfig.sample_video_id"
    )

    def __str__(self):
        return "{}: {}".format(self.id, self.name)

    def __repr__(self):
        return "{}".format(self.__str__())
