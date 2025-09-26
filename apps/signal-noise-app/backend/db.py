import sqlite3
import json
import uuid
import datetime
import os
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

DB_FILE = os.path.join(os.path.dirname(__file__), "tasks.db")

def get_db_connection():
    """Get database connection with proper configuration"""
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # Enable dict-like access to rows
    return conn

def init_db():
    """Initialize database with required tables"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Create tasks table
        c.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_name TEXT NOT NULL,
            priority TEXT DEFAULT 'normal',
            status TEXT DEFAULT 'pending',
            progress TEXT DEFAULT '0%',
            current_step TEXT,
            result TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Create index for faster lookups
        c.execute("""
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)
        """)
        c.execute("""
        CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks(entity_name, entity_type)
        """)
        
        conn.commit()
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        raise
    finally:
        conn.close()

def create_task(entity_type: str, entity_name: str, priority: str = "normal") -> str:
    """Create a new task and return the task ID"""
    try:
        task_id = str(uuid.uuid4())
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("""
        INSERT INTO tasks (id, entity_type, entity_name, priority, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """, (task_id, entity_type, entity_name, priority))
        
        conn.commit()
        logger.info(f"Created task {task_id} for {entity_name}")
        return task_id
        
    except Exception as e:
        logger.error(f"Failed to create task: {str(e)}")
        raise
    finally:
        conn.close()

def update_task(task_id: str, result: Dict[str, Any]) -> bool:
    """Update task with new result data"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Extract fields from result
        status = result.get("status", "unknown")
        progress = result.get("progress", "0%")
        current_step = result.get("current_step")
        
        # Convert result to JSON string
        result_json = json.dumps(result) if result else None
        
        c.execute("""
        UPDATE tasks 
        SET status = ?, progress = ?, current_step = ?, result = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, (status, progress, current_step, result_json, task_id))
        
        if c.rowcount == 0:
            logger.warning(f"No task found with ID {task_id}")
            return False
            
        conn.commit()
        logger.info(f"Updated task {task_id} with status: {status}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to update task {task_id}: {str(e)}")
        raise
    finally:
        conn.close()

def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    """Get task by ID"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("""
        SELECT id, entity_type, entity_name, priority, status, progress, current_step, 
               result, created_at, updated_at
        FROM tasks WHERE id = ?
        """, (task_id,))
        
        row = c.fetchone()
        if not row:
            return {"status": "not_found"}
        
        # Convert row to dict
        task_data = dict(row)
        
        # Parse result JSON if it exists
        if task_data.get("result"):
            try:
                task_data["result"] = json.loads(task_data["result"])
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse result JSON for task {task_id}")
                task_data["result"] = {"error": "Invalid JSON in result"}
        
        return task_data
        
    except Exception as e:
        logger.error(f"Failed to get task {task_id}: {str(e)}")
        raise
    finally:
        conn.close()

def get_tasks_by_status(status: str, limit: int = 100) -> list:
    """Get tasks by status with optional limit"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("""
        SELECT id, entity_type, entity_name, priority, status, progress, current_step, 
               created_at, updated_at
        FROM tasks 
        WHERE status = ? 
        ORDER BY created_at DESC 
        LIMIT ?
        """, (status, limit))
        
        rows = c.fetchall()
        return [dict(row) for row in rows]
        
    except Exception as e:
        logger.error(f"Failed to get tasks by status {status}: {str(e)}")
        raise
    finally:
        conn.close()

def get_recent_tasks(limit: int = 50) -> list:
    """Get recent tasks regardless of status"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("""
        SELECT id, entity_type, entity_name, priority, status, progress, current_step, 
               created_at, updated_at
        FROM tasks 
        ORDER BY created_at DESC 
        LIMIT ?
        """, (limit,))
        
        rows = c.fetchall()
        return [dict(row) for row in rows]
        
    except Exception as e:
        logger.error(f"Failed to get recent tasks: {str(e)}")
        raise
    finally:
        conn.close()

def cleanup_old_tasks(days: int = 30) -> int:
    """Clean up old completed/failed tasks"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("""
        DELETE FROM tasks 
        WHERE status IN ('complete', 'failed') 
        AND created_at < datetime('now', '-{} days')
        """.format(days))
        
        deleted_count = c.rowcount
        conn.commit()
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old tasks")
        
        return deleted_count
        
    except Exception as e:
        logger.error(f"Failed to cleanup old tasks: {str(e)}")
        raise
    finally:
        conn.close()

# Initialize database when module is imported
init_db()
