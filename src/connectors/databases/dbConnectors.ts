import { Connector } from '../types';
import { desktopBridge } from '../../services/desktopBridge';

const createUnsupportedDbConnector = (id: string, name: string): Connector => ({
  id,
  name,
  category: 'databases',
  description: `Connect to ${name} database.`,
  icon: 'Database',
  requiresDriver: true,
  configFields: [
    { id: 'host', label: 'Host', type: 'text', required: true },
    { id: 'port', label: 'Port', type: 'number', required: true },
    { id: 'database', label: 'Database Name', type: 'text', required: true },
    { id: 'username', label: 'Username', type: 'text', required: true },
    { id: 'password', label: 'Password', type: 'password', required: true },
    { id: 'query', label: 'SQL Query or Table Name', type: 'text', required: true }
  ],
  testConnection: async () => {
    return { status: 'unsupported', message: 'Database driver required. Native driver not installed in this environment.' };
  },
  preview: async () => {
    throw new Error('Database driver required. Cannot fetch preview.');
  },
  import: async () => {
    throw new Error('Database driver required. Cannot import data.');
  }
});

const createRealDbConnector = (id: string, name: string, type: string, defaultPort: number): Connector => ({
  id,
  name,
  category: 'databases',
  description: `Connect directly to ${name} database.`,
  icon: 'Database',
  requiresDriver: false,
  configFields: [
    { id: 'host', label: 'Host', type: 'text', required: true, defaultValue: 'localhost' },
    { id: 'port', label: 'Port', type: 'number', required: true, defaultValue: defaultPort },
    { id: 'database', label: 'Database Name', type: 'text', required: true },
    { id: 'username', label: 'Username', type: 'text', required: true },
    { id: 'password', label: 'Password', type: 'password', required: true },
    { id: 'query', label: 'Custom SQL or Table Name', type: 'text', required: true, placeholder: 'SELECT * FROM users' },
    { id: 'ssl', label: 'Enable SSL/TLS', type: 'select', required: false, options: [{label: 'No', value: 'false'}, {label: 'Yes', value: 'true'}] }
  ],
  testConnection: async (config) => {
    if (!desktopBridge.isElectron()) {
      return { status: 'error', message: 'Database connections require the Desktop application runtime.' };
    }
    const dbConfig = {
      type,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: { ssl: config.ssl === 'true' }
    };
    try {
      const res = await desktopBridge.db.testConnection(dbConfig);
      return res;
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Connection failed' };
    }
  },
  preview: async (config) => {
    if (!desktopBridge.isElectron()) {
      throw new Error('Desktop application required.');
    }
    const dbConfig = {
      type,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: { ssl: config.ssl === 'true' }
    };
    
    // Auto-wrap simple table names into a SELECT query
    let query = config.query || '';
    if (!query.toLowerCase().includes('select ')) {
      query = `SELECT * FROM ${query}`;
    }

    // Limit to 100 rows for preview
    const result = await desktopBridge.db.query(dbConfig, query, 100);
    return {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rows.length,
      columnCount: result.columns.length
    };
  },
  import: async (config) => {
    if (!desktopBridge.isElectron()) {
      throw new Error('Desktop application required.');
    }
    const dbConfig = {
      type,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: { ssl: config.ssl === 'true' }
    };
    
    let query = config.query || '';
    if (!query.toLowerCase().includes('select ')) {
      query = `SELECT * FROM ${query}`;
    }

    // Full import
    const result = await desktopBridge.db.query(dbConfig, query);
    return {
      columns: result.columns,
      rows: result.rows
    };
  }
});

export const postgresConnector = createRealDbConnector('db-postgres', 'PostgreSQL', 'postgresql', 5432);
export const mysqlConnector = createRealDbConnector('db-mysql', 'MySQL', 'mysql', 3306);
export const sqlServerConnector = createRealDbConnector('db-sqlserver', 'SQL Server', 'sqlserver', 1433);

export const oracleConnector = createUnsupportedDbConnector('db-oracle', 'Oracle');
export const db2Connector = createUnsupportedDbConnector('db-db2', 'IBM Db2');
export const snowflakeConnector = createUnsupportedDbConnector('db-snowflake', 'Snowflake');
export const sapHanaConnector = createUnsupportedDbConnector('db-saphana', 'SAP HANA');
export const accessConnector = createUnsupportedDbConnector('db-access', 'Microsoft Access');
