"""make h optional in time_series

Revision ID: fb118712a136
Revises: b084946ad874
Create Date: 2025-12-09 15:28:40.698401

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb118712a136'
down_revision: Union[str, Sequence[str], None] = 'b084946ad874'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    # switch of foreign keys temporarily to prevent foreign key conflicts during migration.
    conn.execute(sa.text("PRAGMA foreign_keys=OFF"))
    with op.batch_alter_table("time_series") as batch_op:
        batch_op.alter_column(
            "h",
            existing_type=sa.FLOAT(),
            nullable=True,
        )
    conn.execute(sa.text("PRAGMA foreign_keys=ON"))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    # switch of foreign keys temporarily to prevent foreign key conflicts during migration.
    conn.execute(sa.text("PRAGMA foreign_keys=OFF"))
    with op.batch_alter_table("time_series") as batch_op:
        batch_op.alter_column(
            "h",
            existing_type=sa.FLOAT(),
            nullable=False,
        )
    conn.execute(sa.text("PRAGMA foreign_keys=ON"))
