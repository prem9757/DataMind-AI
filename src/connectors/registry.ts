import { Connector, ConnectorCategory } from './types';

class ConnectorRegistry {
  private connectors: Map<string, Connector> = new Map();

  register(connector: Connector) {
    this.connectors.set(connector.id, connector);
  }

  getConnector(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  getConnectorsByCategory(category: ConnectorCategory): Connector[] {
    return Array.from(this.connectors.values()).filter(c => c.category === category);
  }

  getAllConnectors(): Connector[] {
    return Array.from(this.connectors.values());
  }
}

export const globalConnectorRegistry = new ConnectorRegistry();
