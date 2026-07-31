import unittest
import os
import sqlite3
import pandas as pd
from backend.services.db_connector_service import verify_db_connection, introspect_schema_details, import_table_snapshot_rows
from backend.services.excel_service import parse_excel_workbook

class TestUniversalConnectors(unittest.TestCase):
    def setUp(self):
        # Create a sample SQLite DB in memory / temp file for testing
        self.db_path = "backend/tests/sample_test.db"
        con = sqlite3.connect(self.db_path)
        cur = con.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS customers (id INT, name TEXT, spend FLOAT);")
        cur.execute("INSERT INTO customers VALUES (1, 'Alice', 500.5), (2, 'Bob', 1200.0);")
        con.commit()
        con.close()

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_sqlite_introspection(self):
        tables = introspect_schema_details(source_type='sqlite', sqlite_path=self.db_path)
        self.assertTrue(len(tables) > 0)
        self.assertEqual(tables[0]['tableName'], 'customers')
        self.assertEqual(tables[0]['rowCount'], 2)

    def test_sqlite_snapshot_import(self):
        rows = import_table_snapshot_rows(source_type='sqlite', table_name='customers', sqlite_path=self.db_path)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['name'], 'Alice')

if __name__ == '__main__':
    unittest.main()
