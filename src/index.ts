#!/usr/bin/env node
import 'dotenv/config';
import { buildCLI } from './cli';

buildCLI().parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
