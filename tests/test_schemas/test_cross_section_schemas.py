import pytest
from sqlalchemy.orm import Session

from orc_api.db import CrossSection
from orc_api.schemas.cross_section import CrossSectionResponse


@pytest.fixture
def cross_section_response(session_cross_section: Session):
    # retrieve cross section
    cs_rec = session_cross_section.query(CrossSection).first()
    return CrossSectionResponse.model_validate(cs_rec)


def test_cross_section_schema(cross_section_response):
    # check if crs is available
    assert cross_section_response.crs is not None
