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
    op.execute("PRAGMA foreign_keys=OFF")
    with op.batch_alter_table("video", recreate="always") as batch_op:
        batch_op.create_foreign_key(
            "fk_video_video_config_id",
            "video_config",
            ["video_config_id"],
            ["id"],
            ondelete="SET NULL",
        )
    # also make sure that sample_video_id is set to NULL when that video gets deleted. Requires recreation of table
    conn = op.get_bind()

    if conn.dialect.name == "sqlite":
        # --- Handle 'video_config' table foreign key ---
        op.create_table(
            'video_config_new',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False, comment="Named description of the video configuration"),
            sa.Column('camera_config_id', sa.Integer(), nullable=True),
            sa.Column('recipe_id', sa.Integer(), nullable=True),
            sa.Column('cross_section_id', sa.Integer(), nullable=True),
            sa.Column('cross_section_wl_id', sa.Integer(), nullable=True),
            sa.Column('sample_video_id', sa.Integer(), nullable=True, comment="Video containing sampling information such as GCPs"),
            sa.Column('rvec', sa.JSON(), nullable=False, comment="Rotation vector for matching CrossSection with CameraConfig"),
            sa.Column('tvec', sa.JSON(), nullable=False, comment="Translation vector for matching CrossSection with CameraConfig"),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('remote_id', sa.Integer(), nullable=True),
            sa.Column('sync_status', sa.Enum('LOCAL', 'SYNCED', 'UPDATED', 'FAILED', 'QUEUE', name='syncstatus'),
                      nullable=True),

            sa.ForeignKeyConstraint(['camera_config_id'], ['camera_config.id'], ),
            sa.ForeignKeyConstraint(['cross_section_id'], ['cross_section.id'], ),
            sa.ForeignKeyConstraint(['cross_section_wl_id'], ['cross_section.id'], ),
            sa.ForeignKeyConstraint(['recipe_id'], ['recipe.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('remote_id')
        )
        # Copy existing data
        conn.execute(sa.text("""
            INSERT INTO video_config_new (id, name, camera_config_id, recipe_id, cross_section_id, cross_section_wl_id, sample_video_id, rvec, tvec, created_at, remote_id, sync_status)
            SELECT id, name, camera_config_id, recipe_id, cross_section_id, cross_section_wl_id, sample_video_id, rvec, tvec, created_at, remote_id, sync_status FROM video_config;
        """))# noqa: E501

        # Drop old table
        op.drop_table('video_config')

        # Rename new table
        op.rename_table('video_config_new', 'video_config')

    op.execute("PRAGMA foreign_keys=OFF")


def downgrade() -> None:
    op.execute("PRAGMA foreign_keys=OFF")
    conn = op.get_bind()
    op.create_table(
        'video_config_old',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False, comment="Named description of the video configuration"),
        sa.Column('camera_config_id', sa.Integer(), nullable=True),
        sa.Column('recipe_id', sa.Integer(), nullable=True),
        sa.Column('cross_section_id', sa.Integer(), nullable=True),
        sa.Column('cross_section_wl_id', sa.Integer(), nullable=True),

        # ⬅️ restore FK to video (or whatever the pre-upgrade state was)
        sa.Column('sample_video_id', sa.Integer(), nullable=True),

        sa.Column('rvec', sa.JSON(), nullable=False),
        sa.Column('tvec', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('remote_id', sa.Integer(), nullable=True),
        sa.Column(
            'sync_status',
            sa.Enum('LOCAL', 'SYNCED', 'UPDATED', 'FAILED', 'QUEUE', name='syncstatus'),
            nullable=True,
        ),

        sa.ForeignKeyConstraint(['camera_config_id'], ['camera_config.id']),
        sa.ForeignKeyConstraint(['cross_section_id'], ['cross_section.id']),
        sa.ForeignKeyConstraint(['cross_section_wl_id'], ['cross_section.id']),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipe.id']),
        sa.ForeignKeyConstraint(['sample_video_id'], ['video.id']),

        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('remote_id'),
    )

    # Copy all data back
    conn.execute(sa.text("""
        INSERT INTO video_config_old (
            id, name,
            camera_config_id, recipe_id,
            cross_section_id, cross_section_wl_id,
            sample_video_id,
            rvec, tvec,
            created_at,
            remote_id,
            sync_status
        )
        SELECT
            id, name,
            camera_config_id, recipe_id,
            cross_section_id, cross_section_wl_id,
            sample_video_id,
            rvec, tvec,
            created_at,
            remote_id,
            sync_status
        FROM video_config;
    """))

    # Swap tables
    op.drop_table('video_config')
    op.rename_table('video_config_old', 'video_config')

    # also change video table back
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

    op.execute("PRAGMA foreign_keys=OFF")
