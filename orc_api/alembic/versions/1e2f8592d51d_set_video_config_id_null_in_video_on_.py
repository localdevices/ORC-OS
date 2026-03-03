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
    conn = op.get_bind()
    conn.execute(sa.text("""
        PRAGMA foreign_keys=OFF;
    """))
    try:
        # op.execute("PRAGMA foreign_keys=OFF")

        # with op.batch_alter_table("video", recreate="always", reflect_args=[]) as batch_op:
        #     pass

            # # first drop old constraint
            # batch_op.drop_constraint("fk_video_video_config_id", type_="foreignkey")
            # # then create new stricter constraint
            # batch_op.create_foreign_key(
            #     "fk_video_video_config_id",
            #     "video_config",
            #     ["video_config_id"],
            #     ["id"],
            #     ondelete="SET NULL",
            # )
        # Now add the correct FK after recreation
        # with op.batch_alter_table("video") as batch_op:
        #     batch_op.create_foreign_key(
        #         "fk_video_video_config_id",
        #         "video_config",
        #         ["video_config_id"],
        #         ["id"],
        #         ondelete="SET NULL",
        #     )
        # Drop indexes from old table
        op.drop_index('ix_video_timestamp', table_name='video')
        op.drop_index('ix_video_status', table_name='video')
        op.drop_index('ix_video_sync_status', table_name='video')

        # Rename old table
        op.rename_table('video', 'video_old')

        # Create new table with correct FK
        op.create_table(
            'video',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('timestamp', sa.DateTime(), nullable=False),
            sa.Column('status', sa.Enum('NEW', 'QUEUE', 'TASK', 'DONE', 'ERROR', name='videostatus'), nullable=False),
            sa.Column('file', sa.String(), nullable=True),
            sa.Column('image', sa.String(), nullable=True),
            sa.Column('thumbnail', sa.String(), nullable=True),
            sa.Column('video_config_id', sa.Integer(), nullable=True),
            sa.Column('time_series_id', sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("remote_id", sa.Integer(), nullable=True),
            sa.Column("sync_status", sa.Enum("LOCAL", "SYNCED", "UPDATED", "FAILED", name="syncstatus"), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['video_config_id'], ['video_config.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['time_series_id'], ['time_series.id']),
            sa.UniqueConstraint("remote_id"),
            sa.UniqueConstraint("time_series_id"),
        )

        # Create indexes
        op.create_index('ix_video_timestamp', 'video', ['timestamp'])
        op.create_index(op.f("ix_video_sync_status"), "video", ["sync_status"], unique=False)
        op.create_index('ix_video_status', 'video', ['status'])

        # Copy data
        # conn = op.get_bind()
        conn.execute(sa.text("""
            INSERT INTO video (id, timestamp, status, file, image, thumbnail, video_config_id, time_series_id, created_at, remote_id, sync_status)
            SELECT id, timestamp, status, file, image, thumbnail, video_config_id, time_series_id, created_at, remote_id, sync_status
            FROM video_old
        """))

        # Drop old table
        op.drop_table('video_old')

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
    finally:
        op.execute("PRAGMA foreign_keys=ON")


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

    op.execute("PRAGMA foreign_keys=ON")
