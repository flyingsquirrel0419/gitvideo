import chalk from 'chalk';

export class Logger {
  info(message: string): void {
    // Keep console output concise; CLI progress uses ora separately.
    console.log(chalk.cyan(message));
  }

  warn(message: string): void {
    console.warn(chalk.yellow(message));
  }

  error(message: string): void {
    console.error(chalk.red(message));
  }
}

export const logger = new Logger();
