#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('chronos')
  .description('Chronos CLI - Distributed Job Scheduler')
  .version('0.1.0');

program
  .command('job list')
  .description('List jobs')
  .action(() => {
    console.log(chalk.gray('Not implemented yet'));
  });

program
  .command('job show <id>')
  .description('Show job details')
  .action(() => {
    console.log(chalk.gray('Not implemented yet'));
  });

program
  .command('schedule list')
  .description('List schedules')
  .action(() => {
    console.log(chalk.gray('Not implemented yet'));
  });

program.parse();