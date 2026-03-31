"""water level enabled/disabled option

Revision ID: e5328ed85676
Revises: b8cc02017430
Create Date: 2026-03-31 12:05:33.491598

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5328ed85676'
down_revision: Union[str, Sequence[str], None] = 'b8cc02017430'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    if bind.dialect.name == 'sqlite':
        # SQLite cannot reliably alter an existing column's nullability in-place.
        # Alembic recreates the table under the hood (temp table + copy + rename).
        # In this process each copied record will get the server default for the new column.
        with op.batch_alter_table('water_level_settings', recreate='always') as batch_op:
            batch_op.add_column(
                sa.Column(
                    'enabled',
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                    comment='Whether to enable water level retrieval using the script.'
                )
            )
    else:
        op.add_column(
            'water_level_settings',
            sa.Column(
                'enabled',
                sa.Boolean(),
                nullable=True,
                server_default=sa.false(),  # existing records receive a default
                comment='Whether to enable water level retrieval using the script.'
            )
        )
        op.execute('UPDATE water_level_settings SET enabled = false')
        op.alter_column('water_level_settings', 'enabled', nullable=False)

        # server default is no longer needed after migration, so drop!
        op.alter_column('water_level_settings', 'enabled', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()

    if bind.dialect.name == 'sqlite':
        # Keep downgrade SQLite-safe by forcing table recreation.
        with op.batch_alter_table('water_level_settings', recreate='always') as batch_op:
            batch_op.drop_column('enabled')
    else:
        op.drop_column('water_level_settings', 'enabled')
