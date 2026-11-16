import sqlite3
import uuid
conn = sqlite3.connect(r'C:\DB sentinel\agent-engine\db_sentinel.db')
cursor = conn.cursor()

# Delete the failing database
cursor.execute('DELETE FROM databases WHERE id = "sqlite-local"')
conn.commit()

# Add a working SQLite database with proper UUID
db_id = str(uuid.uuid4())
cursor.execute('''
INSERT INTO databases (id, name, type, host, port, database_name, schema_name, username, connection_config, pool_config, tags, description, is_active, created_by, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
''', (
    db_id,
    'local-sqlite',
    'sqlite',
    'localhost',
    0,
    'db_sentinel.db',
    'main',
    '',
    '{}',
    '{}',
    '["local", "sqlite"]',
    'Local SQLite database',
    1,
    '79d54fb8-ec61-4800-b4e2-598346bf43d9'
))
conn.commit()

cursor.execute('SELECT * FROM databases')
dbs = cursor.fetchall()
print('Databases:', dbs)

conn.close()