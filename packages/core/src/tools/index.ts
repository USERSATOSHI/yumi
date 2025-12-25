/**
 * External Dependencies
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Yumi Internal Packages
 */
import { generateToolSchemasFromFile } from '@yumi/tools';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const tools = generateToolSchemasFromFile(resolve(__dirname, 'tools.ts')).unwrap()!;
