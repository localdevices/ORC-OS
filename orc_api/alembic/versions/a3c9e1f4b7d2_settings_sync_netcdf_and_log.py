"""settings sync netcdf and log

Revision ID: a3c9e1f4b7d2
Revises: 0dc9eeb97575
Create Date: 2026-11-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c9e1f4b7d2'
down_revision: Union[str, Sequence[str], None] = '0dc9eeb97575'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'settings',
        sa.Column(
            'sync_netcdf',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment='Flag for syncing netcdf result files to remote server',
        )
    )
    op.add_column(
        'settings',
        sa.Column(
            'sync_log',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment='Flag for syncing log files to remote server',
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('settings', 'sync_log')
    op.drop_column('settings', 'sync_netcdf')
