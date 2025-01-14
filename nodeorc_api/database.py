from nodeorc.db import Session
# Dependency to get the DB session
def get_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()
