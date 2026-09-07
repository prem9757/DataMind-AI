import { Connector } from '../types';

const createMicrosoftConnector = (id: string, name: string): Connector => ({
  id,
  name,
  category: 'microsoft',
  description: `Connect to Microsoft ${name}.`,
  icon: 'Briefcase',
  requiresAuthentication: true,
  configFields: [
    { id: 'endpoint', label: 'Endpoint / Workspace URL', type: 'text', required: true }
  ],
  testConnection: async () => {
    return { status: 'unsupported', message: 'Authentication required. Microsoft Identity platform not configured.' };
  },
  preview: async () => {
    throw new Error('Authentication required.');
  },
  import: async () => {
    throw new Error('Authentication required.');
  }
});

export const analysisServicesConnector = createMicrosoftConnector('ms-as', 'Analysis Services');
export const powerPlatformConnector = createMicrosoftConnector('ms-power', 'Power Platform');
export const dataverseConnector = createMicrosoftConnector('ms-dataverse', 'Dataverse');
export const fabricConnector = createMicrosoftConnector('ms-fabric', 'Microsoft Fabric');
