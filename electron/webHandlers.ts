import { ipcMain } from 'electron';
import * as cheerio from 'cheerio';

export function registerWebHandlers() {
  ipcMain.handle('web:fetch-rest', async (_, config) => {
    try {
      const { url, method = 'GET', headers, body } = config;
      if (!url || typeof url !== 'string') {
        throw new Error('Valid URL is required.');
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const res = await fetch(url, {
          method,
          headers: headers || { 'Content-Type': 'application/json' },
          body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
        }
        
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await res.json();
        } else {
          return await res.text();
        }
      } catch (fErr: any) {
        clearTimeout(timeoutId);
        if (fErr.name === 'AbortError') {
          throw new Error('Request timed out after 20 seconds.');
        }
        throw fErr;
      }
    } catch (err: any) {
      throw new Error(err.message || 'REST API Fetch failed.');
    }
  });

  ipcMain.handle('web:fetch-html-tables', async (_, url: string) => {
    try {
      if (!url || typeof url !== 'string') {
        throw new Error('Valid URL is required.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      let html = '';
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
        html = await res.text();
      } catch (fErr: any) {
        clearTimeout(timeoutId);
        if (fErr.name === 'AbortError') {
          throw new Error('Page request timed out after 20 seconds.');
        }
        throw fErr;
      }
      const $ = cheerio.load(html);
      
      const tables: any[] = [];
      
      $('table').each((i, table) => {
        const rows: any[] = [];
        let headers: string[] = [];
        
        // Find headers
        $(table).find('th').each((j, th) => {
          headers.push($(th).text().trim() || `Col_${j}`);
        });
        
        // Find data rows
        $(table).find('tr').each((j, tr) => {
          const rowData: Record<string, string> = {};
          const tds = $(tr).find('td');
          if (tds.length > 0) {
            tds.each((k, td) => {
              const header = headers[k] || `Col_${k}`;
              rowData[header] = $(td).text().trim();
            });
            rows.push(rowData);
          }
        });
        
        if (rows.length > 0) {
          tables.push({
            id: `table_${i}`,
            columns: headers.length > 0 ? headers : Object.keys(rows[0]),
            rows: rows
          });
        }
      });
      
      return tables;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to extract HTML tables.');
    }
  });
}
