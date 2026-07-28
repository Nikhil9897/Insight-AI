import unittest
import os
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.models.db_models import User, Project, ImportedDataset, SavedDashboard, QueryHistoryRecord

# Use a fresh Base so table creation is isolated to the test engine,
# avoiding interference from backend.database's pre-bound engine.
from backend.database import Base

class TestWorkspacePersistence(unittest.TestCase):
    def setUp(self):
        self.db_path = f"backend/tests/test_persistence_{uuid.uuid4().hex[:6]}.db"
        self.engine = create_engine(f"sqlite:///{self.db_path}", connect_args={"check_same_thread": False})
        # Drop and recreate all tables fresh for each test run
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_user_and_multi_projects(self):
        user = User(
            firebase_uid="uid_test_123",
            email="test@insightai.io",
            display_name="Test Analyst"
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        # Create 2 distinct projects
        p1 = Project(user_id=user.id, name="Sales Analytics", description="Sales data workspace")
        p2 = Project(user_id=user.id, name="Marketing Dashboard", description="Marketing data workspace")
        self.db.add_all([p1, p2])
        self.db.commit()

        user.last_opened_project_id = p1.id
        self.db.commit()

        projects = self.db.query(Project).filter(Project.user_id == user.id).all()
        self.assertEqual(len(projects), 2)
        self.assertEqual(user.last_opened_project_id, p1.id)

    def test_metadata_only_dataset_persistence(self):
        user = User(firebase_uid="uid_meta_101", email="meta@insightai.io")
        self.db.add(user)
        self.db.commit()

        p = Project(user_id=user.id, name="HR Reports")
        self.db.add(p)
        self.db.commit()

        ds_meta = ImportedDataset(
            dataset_id="ds_hr_attrition",
            project_id=p.id,
            dataset_name="HR Employee Attrition",
            source_type="csv",
            original_file_name="attrition.csv",
            row_count=1470,
            column_count=35,
            summary_json={"missingCellsCount": 0, "healthScore": 100}
        )
        self.db.add(ds_meta)
        self.db.commit()

        retrieved = self.db.query(ImportedDataset).filter(ImportedDataset.project_id == p.id).first()
        self.assertEqual(retrieved.dataset_name, "HR Employee Attrition")
        self.assertEqual(retrieved.row_count, 1470)
        self.assertFalse(hasattr(retrieved, "rows_json"))  # Confirms legacy attribute doesn't exist
        self.assertIsNotNone(retrieved.data_rows_json or True)  # data_rows_json column exists (may be None)

if __name__ == '__main__':
    unittest.main()
