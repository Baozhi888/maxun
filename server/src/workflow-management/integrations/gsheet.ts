import { google } from "googleapis";
import fs from 'fs';
import path from 'path';
import logger from "../../logger";
import { readFile } from "../storage";
interface GoogleSheetUpdateTask {
  name: string;
  runId: string;
  status: 'pending' | 'completed' | 'failed';
  retries: number;
}

const MAX_RETRIES = 5;

export let googleSheetUpdateTasks: { [runId: string]: GoogleSheetUpdateTask } = {};


// *** Temporary Path to the JSON file that will store the integration details ***
const getIntegrationsFilePath = (fileName: string) => path.join(__dirname, `integrations-${fileName}.json`);

export function loadIntegrations(fileName: string) {
  const filePath = getIntegrationsFilePath(fileName);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  }
  return {};
}

export function saveIntegrations(fileName: string, integrations: any) {
  const filePath = getIntegrationsFilePath(fileName);
  fs.writeFileSync(filePath, JSON.stringify(integrations, null, 2));
}

export async function updateGoogleSheet(fileName: string, runId: string) {
  try {
    const run = await readFile(`./../storage/runs/${fileName}_${runId}.json`);
    const parsedRun = JSON.parse(run);

    if (parsedRun.status === 'success' && parsedRun.serializableOutput) {
      const data = parsedRun.serializableOutput['item-0'] as { [key: string]: any }[];
      const integrationConfig = await loadIntegrations(fileName);

      if (integrationConfig) {
        const { fileName, spreadsheetId, range, credentials } = integrationConfig;

        if (fileName && spreadsheetId && range && credentials) {
          // Convert data to Google Sheets format (headers and rows)
          const headers = Object.keys(data[0]);
          const rows = data.map((row: { [key: string]: any }) => Object.values(row));
          const outputData = [headers, ...rows];

          await writeDataToSheet(fileName, spreadsheetId, range, outputData);
          logger.log('info', `Data written to Google Sheet successfully for ${fileName}_${runId}`);
        }
      }
      logger.log('error', `Google Sheet integration not configured for ${fileName}_${runId}`);
    }
    logger.log('error', `Run not successful or no data to update for ${fileName}_${runId}`);
  } catch (error: any) {
    logger.log('error', `Failed to write data to Google Sheet for ${fileName}_${runId}: ${error.message}`);
  }
};

export async function writeDataToSheet(fileName: string, spreadsheetId: string, range: string, data: any[]) {
  try {
    const integrationCredentialsPath = getIntegrationsFilePath(fileName);
    const integrationCredentials = JSON.parse(fs.readFileSync(integrationCredentialsPath, 'utf-8'));;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: integrationCredentials.credentials.client_email,
        private_key: integrationCredentials.credentials.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authToken = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authToken as any });

    const resource = { values: data };

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: resource,
    });

    logger.log(`info`, `Data written to Google Sheet: ${spreadsheetId}, Range: ${range}`);
  } catch (error: any) {
    logger.log(`error`, `Error writing data to Google Sheet: ${error.message}`);
    throw error;
  }
}

export const processGoogleSheetUpdates = async () => {
  while (true) {
    let hasPendingTasks = false;
    for (const runId in googleSheetUpdateTasks) {
      const task = googleSheetUpdateTasks[runId];
      if (task.status === 'pending') {
        hasPendingTasks = true;
        try {
          await updateGoogleSheet(task.name, task.runId);
          delete googleSheetUpdateTasks[runId];
        } catch (error: any) {
          if (task.retries < MAX_RETRIES) {
            googleSheetUpdateTasks[runId].retries += 1;
          } else {
            // Mark as failed after maximum retries
            googleSheetUpdateTasks[runId].status = 'failed';
          }
          console.error(`Failed to update Google Sheets for run ${task.runId}:`, error);
        }
      }
    }
    if (!hasPendingTasks) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
};