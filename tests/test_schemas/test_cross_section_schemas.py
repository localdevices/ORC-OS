import pytest
from sqlalchemy.orm import Session

from orc_api.db import CrossSection
from orc_api.schemas.cross_section import CrossSectionResponse


@pytest.fixture
def session_cross_section(session_empty, cross_section):
    cs = CrossSection(name="some cross section", features=cross_section)
    session_empty.add(cs)
    session_empty.commit()
    session_empty.refresh(cs)
    return session_empty


def test_cross_section_schema(session_cross_section: Session):
    # retrieve cross section
    cs_rec = session_cross_section.query(CrossSection).first()
    cs = CrossSectionResponse.model_validate(cs_rec)
    # check if crs is available
    assert cs.crs is not None
