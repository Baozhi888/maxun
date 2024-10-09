import fs from "fs";
import { uuid } from "uuidv4";
import { chromium } from "playwright";
import { io, Socket } from "socket.io-client";
import { readFile, saveFile } from "../storage";
import { createRemoteBrowserForRun, destroyRemoteBrowser } from '../../browser-management/controller';
import logger from '../../logger';
import { browserPool } from "../../server";
import { googleSheetUpdateTasks, processGoogleSheetUpdates } from "../integrations/gsheet";
import { getRecordingByFileName } from "../../routes/storage";
import Robot from "../../models/Robot";
import Run from "../../models/Run";
import { getDecryptedProxyConfig } from "../../routes/proxy";

async function runWorkflow(id: string) {
  if (!id) {
    id = uuid();
  }

  const recording = await Robot.findOne({
    where: {
      'recording_meta.id': id
    },
    raw: true
  });

  if (!recording || !recording.recording_meta || !recording.recording_meta.id) {
    return {
      success: false,
      error: 'Recording not found'
    };
  }

  // req.user.id will not be available here :)
  const proxyConfig = await getDecryptedProxyConfig(req.user.id);
  let proxyOptions: any = {};

  if (proxyConfig.proxy_url) {
    proxyOptions = {
      server: proxyConfig.proxy_url,
      ...(proxyConfig.proxy_username && proxyConfig.proxy_password && {
        username: proxyConfig.proxy_username,
        password: proxyConfig.proxy_password,
      }),
    };
  }

  try {
    const browserId = createRemoteBrowserForRun({
      browser: chromium,
      launchOptions: { headless: true }
    });

    const run = await Run.create({
      status: 'Scheduled',
      name: recording.recording_meta.name,
      robotId: recording.id,
      robotMetaId: recording.recording_meta.id,
      startedAt: new Date().toLocaleString(),
      finishedAt: '',
      browserId: id,
      interpreterSettings: { maxConcurrency: 1, maxRepeats: 1, debug: true },
      log: '',
      runId: id,
      serializableOutput: {},
      binaryOutput: {},
    });

    const plainRun = run.toJSON();

    return {
      browserId,
      runId: plainRun.runId,
    }

  } catch (e) {
    const { message } = e as Error;
    logger.log('info', `Error while scheduling a run with id: ${id}`);
    console.log(message);
    return {
      success: false,
      error: message,
    };
  }
}

async function executeRun(id: string) {
  try {
    const run = await Run.findOne({ where: { runId: id } });
    if (!run) {
      return {
        success: false,
        error: 'Run not found'
      }
    }

    const plainRun = run.toJSON();

    const recording = await Robot.findOne({ where: { 'recording_meta.id': plainRun.robotMetaId }, raw: true });
    if (!recording) {
      return {
        success: false,
        error: 'Recording not found'
      }
    }

    plainRun.status = 'running';

    const browser = browserPool.getRemoteBrowser(plainRun.browserId);
    if (!browser) {
      throw new Error('Could not access browser');
    }

    const currentPage = await browser.getCurrentPage();
    if (!currentPage) {
      throw new Error('Could not create a new page');
    }

    const interpretationInfo = await browser.interpreter.InterpretRecording(
      recording.recording, currentPage, plainRun.interpreterSettings);

    await destroyRemoteBrowser(plainRun.browserId);

    await run.update({
      ...run,
      status: 'success',
      finishedAt: new Date().toLocaleString(),
      browserId: plainRun.browserId,
      log: interpretationInfo.log.join('\n'),
      serializableOutput: interpretationInfo.serializableOutput,
      binaryOutput: interpretationInfo.binaryOutput,
    });

    googleSheetUpdateTasks[id] = {
      name: plainRun.name,
      runId: id,
      status: 'pending',
      retries: 5,
    };
    processGoogleSheetUpdates();
    return true;
  } catch (error: any) {
    logger.log('info', `Error while running a recording with id: ${id} - ${error.message}`);
    console.log(error.message);
    return false;
  }
}

async function readyForRunHandler(browserId: string, fileName: string, runId: string) {
  try {
    const interpretation = await executeRun(fileName, runId);

    if (interpretation) {
      logger.log('info', `Interpretation of ${fileName} succeeded`);
    } else {
      logger.log('error', `Interpretation of ${fileName} failed`);
      await destroyRemoteBrowser(browserId);
    }

    resetRecordingState(browserId, fileName, runId);

  } catch (error: any) {
    logger.error(`Error during readyForRunHandler: ${error.message}`);
    await destroyRemoteBrowser(browserId);
  }
}

function resetRecordingState(browserId: string, fileName: string, runId: string) {
  browserId = '';
  fileName = '';
  runId = '';
  logger.log(`info`, `reset values for ${browserId}, ${fileName}, and ${runId}`);
}

export async function handleRunRecording(fileName: string, runId: string) {
  try {
    const result = await runWorkflow(fileName, runId);
    const { browserId, runId: newRunId } = result;

    if (!browserId || !newRunId) {
      throw new Error('browserId or runId is undefined');
    }

    const socket = io(`http://localhost:8080/${browserId}`, {
      transports: ['websocket'],
      rejectUnauthorized: false
    });

    socket.on('ready-for-run', () => readyForRunHandler(browserId, fileName, newRunId));

    logger.log('info', `Running recording: ${fileName}`);

    socket.on('disconnect', () => {
      cleanupSocketListeners(socket, browserId, newRunId);
    });

  } catch (error: any) {
    logger.error('Error running recording:', error);
  }
}

function cleanupSocketListeners(socket: Socket, browserId: string, runId: string) {
  socket.off('ready-for-run', () => readyForRunHandler(browserId, '', runId));
  logger.log('info', `Cleaned up listeners for browserId: ${browserId}, runId: ${runId}`);
}

export { runWorkflow };