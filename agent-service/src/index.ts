#!/usr/bin/env node

import { Terminal } from './cli/terminal';
import chalk from 'chalk';

/**
 * Main entry point for the ReAct Agent Service
 */
async function main() {
  try {
    console.log(chalk.cyan('\nInitializing ReAct Agent...\n'));
    console.log(chalk.green('✓ ReAct agent ready (weather tool enabled)\n'));

    // Start terminal interface
    const terminal = new Terminal();
    await terminal.start();

  } catch (error: any) {
    console.error(chalk.red(`\n❌ Fatal error: ${error.message}\n`));
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Uncaught exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('\n❌ Unhandled rejection:'), reason);
  process.exit(1);
});

// Start the application
main();

