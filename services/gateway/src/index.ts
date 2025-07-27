#!/usr/bin/env node

import { Command } from 'commander';
import { getVersionString } from './config/version';
import {
  registerLoginCommand,
  registerLogoutCommand,
  registerWhoamiCommand,
  registerTeamsCommand,
  registerStartCommand,
  registerStopCommand,
  registerStatusCommand,
  registerConfigCommand,
  registerVersionCommand
} from './commands';

const program = new Command();

program
  .name('deploystack')
  .description('DeployStack Gateway - Local secure proxy for MCP servers')
  .version(getVersionString());

// Register all commands
registerLoginCommand(program);
registerLogoutCommand(program);
registerWhoamiCommand(program);
registerTeamsCommand(program);
registerStartCommand(program);
registerStopCommand(program);
registerStatusCommand(program);
registerConfigCommand(program);
registerVersionCommand(program);

// Show help if no command is provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
