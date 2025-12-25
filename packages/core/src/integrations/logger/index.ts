import { Logger, LogQuery } from '@yumi/logger';

const logger = Logger.getInstance({
	file: true,
});

const {logDir} = logger.config;

const voicevox = logger.child('voicevox');
const ledfx = logger.child('ledfx');
const db = logger.child('db');
const request = logger.child('request');
const model = logger.child('model');
const toolcall = logger.child('toolcall');
const ha = logger.child('home_assistant');
const wslog = logger.child('ws');

const query = new LogQuery(logDir);

export { logger, voicevox, ledfx, db, request, query, model, toolcall, ha , wslog };