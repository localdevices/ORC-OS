"""set video_config_id NULL in video on DELETE

Revision ID: 1e2f8592d51d
Revises: fb118712a136
Create Date: 2026-02-04 13:40:56.671757

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1e2f8592d51d'
down_revision: Union[str, Sequence[str], None] = 'fb118712a136'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("video", recreate="always") as batch_op:
        # batch_op.drop_constraint(
        #     "fk_video_video_config_id",
        #     type_="foreignkey",
        # )
        batch_op.create_foreign_key(
            "fk_video_video_config_id",
            "video_config",
            ["video_config_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("video", recreate="always") as batch_op:
        batch_op.drop_constraint(
            "fk_video_video_config_id",
            type_="foreignkey",
        )
        batch_op.create_foreign_key(
            None,
            "video_config",
            ["video_config_id"],
            ["id"],
        )
