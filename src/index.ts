#!/usr/bin/env node
import 'dotenv/config';
import { buildCLI } from './cli';

buildCLI().parse(process.argv);
