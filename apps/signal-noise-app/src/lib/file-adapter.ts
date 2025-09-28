import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

class FileAdapter {
  async ensureDataDir() {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  }

  async readDataFile(filePath: string, defaultValue: any = []) {
    try {
      await this.ensureDataDir();
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  async writeDataFile(filePath: string, data: any) {
    await this.ensureDataDir();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async getUsers() {
    return this.readDataFile(USERS_FILE, {});
  }

  async saveUsers(users: any) {
    await this.writeDataFile(USERS_FILE, users);
  }

  async getSessions() {
    return this.readDataFile(SESSIONS_FILE, {});
  }

  async saveSessions(sessions: any) {
    await this.writeDataFile(SESSIONS_FILE, sessions);
  }
}

export const fileAdapter = new FileAdapter();