import Table from 'cli-table3';
import chalk from 'chalk';

export interface TableOptions {
  head: string[];
  colWidths?: number[];
  style?: 'compact' | 'full';
}

/**
 * Create a formatted CLI table with consistent styling
 */
export class TableFormatter {
  static createTable(options: TableOptions): Table.Table {
    return new Table({
      head: options.head.map(h => chalk.cyan.bold(h)),
      colWidths: options.colWidths,
      style: {
        head: [],
        border: ['grey'],
        'padding-left': 1,
        'padding-right': 1
      },
      chars: options.style === 'compact' ? {
        'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
        'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
        'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
        'right': '│', 'right-mid': '┤', 'middle': '│'
      } : undefined
    }) as Table.Table;
  }

  /**
   * Create a simple two-column table for key-value pairs
   */
  static createKeyValueTable(): Table.Table {
    return new Table({
      style: {
        head: [],
        border: ['grey'],
        'padding-left': 1,
        'padding-right': 1
      },
      colWidths: [30, 50]
    }) as Table.Table;
  }

  /**
   * Format a boolean value with checkmark or empty space
   */
  static formatBoolean(value: boolean): string {
    return value ? chalk.green('✓') : '';
  }

  /**
   * Format a date for table display
   */
  static formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  /**
   * Truncate text to fit in table columns
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
