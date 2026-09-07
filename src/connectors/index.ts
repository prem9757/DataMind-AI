import { globalConnectorRegistry } from './registry';
import { csvConnector, excelConnector, jsonConnector } from './files/fileConnectors';
import { postgresConnector, mysqlConnector, sqlServerConnector, oracleConnector, db2Connector, snowflakeConnector, sapHanaConnector, accessConnector } from './databases/dbConnectors';
import { sharepointConnector, onedriveConnector, azureConnector, googleDriveConnector, googleAnalyticsConnector, salesforceConnector, dynamics365Connector } from './cloud/cloudConnectors';
import { restApiConnector, htmlTableConnector, odataConnector } from './web/webConnectors';
import { analysisServicesConnector, powerPlatformConnector, dataverseConnector, fabricConnector } from './microsoft/microsoftConnectors';

export function initializeConnectors() {
  // Files
  globalConnectorRegistry.register(csvConnector);
  globalConnectorRegistry.register(excelConnector);
  globalConnectorRegistry.register(jsonConnector);
  
  // Databases
  globalConnectorRegistry.register(postgresConnector);
  globalConnectorRegistry.register(mysqlConnector);
  globalConnectorRegistry.register(sqlServerConnector);
  globalConnectorRegistry.register(oracleConnector);
  globalConnectorRegistry.register(db2Connector);
  globalConnectorRegistry.register(snowflakeConnector);
  globalConnectorRegistry.register(sapHanaConnector);
  globalConnectorRegistry.register(accessConnector);
  
  // Cloud
  globalConnectorRegistry.register(sharepointConnector);
  globalConnectorRegistry.register(onedriveConnector);
  globalConnectorRegistry.register(azureConnector);
  globalConnectorRegistry.register(googleDriveConnector);
  globalConnectorRegistry.register(googleAnalyticsConnector);
  globalConnectorRegistry.register(salesforceConnector);
  globalConnectorRegistry.register(dynamics365Connector);
  
  // Web
  globalConnectorRegistry.register(restApiConnector);
  globalConnectorRegistry.register(htmlTableConnector);
  globalConnectorRegistry.register(odataConnector);
  
  // Microsoft
  globalConnectorRegistry.register(analysisServicesConnector);
  globalConnectorRegistry.register(powerPlatformConnector);
  globalConnectorRegistry.register(dataverseConnector);
  globalConnectorRegistry.register(fabricConnector);
}

export * from './types';
export * from './registry';
