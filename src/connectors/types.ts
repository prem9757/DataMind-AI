export type ConnectorCategory = 'files' | 'databases' | 'cloud' | 'web' | 'microsoft';

export interface ConnectorConfigField {
  id: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'boolean' | 'file';
  options?: { label: string; value: string }[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: any;
}

export interface ConnectorStatus {
  status: 'idle' | 'testing' | 'success' | 'error' | 'unsupported';
  message?: string;
}

export interface Connector {
  id: string;
  name: string;
  category: ConnectorCategory;
  description: string;
  icon: string;
  requiresAuthentication?: boolean;
  requiresDriver?: boolean;
  configFields: ConnectorConfigField[];
  
  testConnection: (config: Record<string, any>) => Promise<ConnectorStatus>;
  preview: (config: Record<string, any>) => Promise<{
    columns: string[];
    rows: any[];
    rowCount: number;
    columnCount: number;
  }>;
  import: (config: Record<string, any>) => Promise<{
    columns: string[];
    rows: any[];
  }>;
}
