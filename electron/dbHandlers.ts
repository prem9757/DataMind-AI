import { ipcMain, safeStorage, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { Client } from 'pg';
import mysql from 'mysql2/promise';
import sql from 'mssql';

function getVaultPath(): string {
  try {
    return path.join(app.getPath('userData'), 'credentials_vault.dat');
  } catch {
    return path.join(process.cwd(), '.credentials_vault.dat');
  }
}

function readVault(): Record<string, string> {
  try {
    const p = getVaultPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to read credentials vault:', err);
  }
  return {};
}

function writeVault(vault: Record<string, string>): boolean {
  try {
    const p = getVaultPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(p, JSON.stringify(vault), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to write credentials vault:', err);
    return false;
  }
}

export function registerDBHandlers() {
  ipcMain.handle('db:test-connection', async (_, config) => {
    try {
      if (config.type === 'postgresql') {
        const client = new Client({
          host: config.host,
          port: config.port ? parseInt(config.port) : 5432,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.options?.ssl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 10000,
        });
        await client.connect();
        await client.end();
        return { status: 'success', message: 'Connection successful.' };
      }

      if (config.type === 'mysql') {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port ? parseInt(config.port) : 3306,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.options?.ssl ? { rejectUnauthorized: false } : undefined,
          connectTimeout: 10000,
        });
        await connection.end();
        return { status: 'success', message: 'Connection successful.' };
      }

      if (config.type === 'sqlserver') {
        const pool = new sql.ConnectionPool({
          server: config.host || 'localhost',
          port: config.port ? parseInt(config.port) : 1433,
          database: config.database,
          user: config.user,
          password: config.password,
          options: {
            encrypt: config.options?.ssl || false,
            trustServerCertificate: true,
            connectTimeout: 10000,
          },
        });
        await pool.connect();
        await pool.close();
        return { status: 'success', message: 'Connection successful.' };
      }

      return { status: 'unsupported', message: `Driver for ${config.type} not configured.` };
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Connection failed.' };
    }
  });

  ipcMain.handle('db:get-metadata', async (_, config) => {
    try {
      if (config.type === 'postgresql') {
        const client = new Client({
          host: config.host,
          port: config.port ? parseInt(config.port) : 5432,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.options?.ssl ? { rejectUnauthorized: false } : false,
        });
        await client.connect();
        const res = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        const viewsRes = await client.query(`
          SELECT table_name 
          FROM information_schema.views 
          WHERE table_schema = 'public'
        `);
        await client.end();
        return { 
          tables: res.rows.map(r => r.table_name),
          views: viewsRes.rows.map(r => r.table_name)
        };
      }

      if (config.type === 'mysql') {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port ? parseInt(config.port) : 3306,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.options?.ssl ? { rejectUnauthorized: false } : undefined,
        });
        const [rows] = await connection.execute(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`);
        const [viewRows] = await connection.execute(`SHOW FULL TABLES WHERE Table_type = 'VIEW'`);
        await connection.end();
        
        return { 
          tables: (rows as any[]).map(r => Object.values(r)[0] as string),
          views: (viewRows as any[]).map(r => Object.values(r)[0] as string)
        };
      }

      if (config.type === 'sqlserver') {
        const pool = await sql.connect({
          server: config.host || 'localhost',
          port: config.port ? parseInt(config.port) : 1433,
          database: config.database,
          user: config.user,
          password: config.password,
          options: {
            encrypt: config.options?.ssl || false,
            trustServerCertificate: true,
          },
        });
        const res = await pool.request().query(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_TYPE = 'BASE TABLE'
        `);
        const viewsRes = await pool.request().query(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.VIEWS
        `);
        await pool.close();
        return { 
          tables: res.recordset.map(r => r.TABLE_NAME),
          views: viewsRes.recordset.map(r => r.TABLE_NAME)
        };
      }

      throw new Error(`Driver for ${config.type} not configured.`);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to fetch metadata.');
    }
  });

  ipcMain.handle('db:query', async (_, { config, query, limit }) => {
    let finalQuery = query;

    try {
      if (config.type === 'postgresql') {
        if (limit) {
          finalQuery = `SELECT * FROM (${query}) AS subq LIMIT ${limit}`;
        }
        const client = new Client({
          host: config.host,
          port: config.port ? parseInt(config.port) : 5432,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.options?.ssl ? { rejectUnauthorized: false } : false,
        });
        await client.connect();
        const res = await client.query(finalQuery);
        await client.end();
        return {
          columns: res.fields.map(f => f.name),
          rows: res.rows
        };
      }

      if (config.type === 'mysql') {
        if (limit) {
          finalQuery = `SELECT * FROM (${query}) AS subq LIMIT ${limit}`;
        }
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port ? parseInt(config.port) : 3306,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.options?.ssl ? { rejectUnauthorized: false } : undefined,
        });
        const [rows, fields] = await connection.execute(finalQuery);
        await connection.end();
        return {
          columns: fields.map(f => f.name),
          rows: rows as any[]
        };
      }

      if (config.type === 'sqlserver') {
        if (limit) {
           finalQuery = `SELECT TOP ${limit} * FROM (${query}) AS subq`;
        }
        const pool = await sql.connect({
          server: config.host || 'localhost',
          port: config.port ? parseInt(config.port) : 1433,
          database: config.database,
          user: config.user,
          password: config.password,
          options: {
            encrypt: config.options?.ssl || false,
            trustServerCertificate: true,
          },
        });
        const res = await pool.request().query(finalQuery);
        await pool.close();
        return {
          columns: Object.keys(res.recordset[0] || {}),
          rows: res.recordset
        };
      }

      throw new Error(`Driver for ${config.type} not configured.`);
    } catch (err: any) {
      throw new Error(err.message || 'Query failed.');
    }
  });

  // Secure Credentials Storage
  ipcMain.handle('credentials:save', async (_, { key, value }) => {
    try {
      if (!key || typeof key !== 'string') return false;
      const vault = readVault();
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value || '');
        vault[key] = `enc:${encrypted.toString('base64')}`;
      } else {
        vault[key] = `raw:${Buffer.from(value || '', 'utf8').toString('base64')}`;
      }
      return writeVault(vault);
    } catch (err) {
      console.error('Error saving credential to vault:', err);
      return false;
    }
  });

  ipcMain.handle('credentials:load', async (_, key: string) => {
    try {
      if (!key || typeof key !== 'string') return null;
      const vault = readVault();
      const val = vault[key];
      if (!val) return null;

      if (val.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(val.slice(4), 'base64');
        return safeStorage.decryptString(buffer);
      } else if (val.startsWith('raw:')) {
        return Buffer.from(val.slice(4), 'base64').toString('utf8');
      } else {
        if (safeStorage.isEncryptionAvailable()) {
          try {
            return safeStorage.decryptString(Buffer.from(val, 'base64'));
          } catch {
            return val;
          }
        }
        return val;
      }
    } catch (err) {
      console.error('Error loading credential from vault:', err);
      return null;
    }
  });

  ipcMain.handle('credentials:delete', async (_, key: string) => {
    try {
      if (!key || typeof key !== 'string') return false;
      const vault = readVault();
      if (key in vault) {
        delete vault[key];
        return writeVault(vault);
      }
      return true;
    } catch (err) {
      console.error('Error deleting credential from vault:', err);
      return false;
    }
  });
}
