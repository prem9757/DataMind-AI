import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { GoogleGenAI } from '@google/genai';

function geminiApiPlugin(): Plugin {
  return {
    name: 'gemini-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/gemini/analyze' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { query, datasetSummary, sampleRows, history } = JSON.parse(body || '{}');

              const apiKey = process.env.GEMINI_API_KEY;
              if (!apiKey) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No API key configured' }));
                return;
              }

              const ai = new GoogleGenAI({
                apiKey: apiKey,
                httpOptions: {
                  headers: {
                    'User-Agent': 'aistudio-build',
                  }
                }
              });

              const prompt = `You are the Smart Data Analysis Assistant, an elite Senior Principal Data Analyst.
A user is asking a question about a dataset. Answer with extreme analytical rigor using ONLY facts and values grounded in the dataset provided. Never hallucinate columns or invent numbers.

Dataset Summary:
Name: ${datasetSummary?.name || 'Dataset'}
Total Rows: ${datasetSummary?.totalRows || 0}
Columns & Profiles:
${JSON.stringify(datasetSummary?.columns || [], null, 2)}

Sample Data Rows:
${JSON.stringify(sampleRows || [], null, 2)}

Conversation History:
${JSON.stringify(history || [], null, 2)}

User Question: "${query}"

Return a valid JSON object matching this structure:
{
  "directAnswer": "Clear, concise direct answer containing exact numbers, percentages, and segment names.",
  "supportingMetrics": [
    {"label": "Metric Name", "value": "Formatted Value", "change": "+X%"}
  ],
  "chartData": {
    "type": "bar",
    "title": "Chart Title",
    "xAxisLabel": "X-axis column",
    "yAxisLabel": "Y-axis metric",
    "data": [{"Category": "A", "Value": 100}, {"Category": "B", "Value": 150}],
    "keys": ["Value"]
  },
  "explanation": "2-3 sentences explaining the analytical calculation performed and why.",
  "businessImplication": "Strategic takeaway for executive leadership and recommended action.",
  "pythonCode": "# Python pandas code executing this exact calculation\\nimport pandas as pd\\n...",
  "suggestedFollowUps": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;

              const response = await ai.models.generateContent({
                model: 'gemini-3.7-flash',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  temperature: 0.2
                }
              });

              const text = response.text || '{}';
              let parsedResult;
              try {
                parsedResult = JSON.parse(text);
              } catch (e) {
                parsedResult = { text };
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(parsedResult));
            } catch (err: any) {
              console.error('Gemini API middleware error:', err);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Analysis processing failed' }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), geminiApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
