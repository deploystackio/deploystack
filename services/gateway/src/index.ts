#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  registerLoginCommand,
  registerLogoutCommand,
  registerStartCommand,
  registerStopCommand,
  registerStatusCommand,
  registerConfigCommand
} from './commands';

const program = new Command();

program
  .name('deploystack')
  .description('DeployStack Gateway - Local secure proxy for MCP servers')
  .version('0.1.0');

// Register all commands
registerLoginCommand(program);
registerLogoutCommand(program);
registerStartCommand(program);
registerStopCommand(program);
registerStatusCommand(program);
registerConfigCommand(program);

// Show help if no command is provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
