"""Los tests usan una base de datos temporal propia: nunca tocan backend/data/senda.db."""
import os
import tempfile
from pathlib import Path

_DB = Path(tempfile.mkdtemp(prefix="senda-tests-")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB.as_posix()}"
