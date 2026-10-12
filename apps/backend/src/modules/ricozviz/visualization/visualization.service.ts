// ============================================================
// Visualization Service
// ============================================================
// Standalone visualization CRUD, query execution against datasets,
// multi-tenant and workspace authorization, live chart-ready data mapping
// and public share links.
//
// NOTE ON THE LOCAL DATASET QUERY FOUNDATION
// -------------------------------------------
// The legacy service delegated every read to `services/dataset/query-engine.ts`.
// That module is being migrated in parallel, so this file carries a
// self-contained, behaviour-compatible implementation (row reader + filter +
// aggregate + sort + paginate + calculated-field evaluation). It is deliberately
// scoped to the in-memory/CSV execution path: there is no live SQL connector in
// the Mongoose backend, and row-level-security filters remain owned by the
// dataset module.
// ============================================================

import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  ChartModel,
  DashboardModel,
  DatasetColumnModel,
  DatasetModel,
  WorkspaceMemberModel,
  WorkspaceModel
} from '@repo/database';
import {
  DASHBOARD_STATUS,
  DASHBOARD_VISIBILITY,
  WORKSPACE_ROLE
} from '@repo/types';
import type {
  DatasetQueryFilter,
  DatasetQueryParams,
  DatasetQueryResult,
  QueryResultColumn,
  VisualizationData
} from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';

// ============================================================
// CONSTANTS & SCHEMAS
// ============================================================

export const ALLOWED_VISUALIZATION_TYPES = [
  'BAR',
  'LINE',
  'AREA',
  'PIE',
  'DONUT',
  'TABLE',
  'KPI',
  'SCATTER',
  'RADAR',
  'FUNNEL',
  'HEATMAP',
  'GAUGE',
  'BUBBLE',
  'TREEMAP'
] as const;

export type VisualizationType = (typeof ALLOWED_VISUALIZATION_TYPES)[number];

/** Aggregations understood by the in-memory dataset query engine. */
export const ALLOWED_AGGREGATIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const;

export type AggregationFunction = (typeof ALLOWED_AGGREGATIONS)[number];

export const advancedCustomizationSchema = z.object({
  colorPalette: z.string().optional(),
  customColors: z
    .array(z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Must be valid hex color'))
    .optional(),
  legend: z
    .object({
      show: z.boolean().default(true),
      position: z.enum(['top', 'bottom', 'left', 'right']).default('top')
    })
    .optional(),
  xAxisConfig: z
    .object({
      title: z.string().optional(),
      showGrid: z.boolean().default(false),
      labelRotation: z.number().int().min(-90).max(90).default(0),
      showLabels: z.boolean().default(true)
    })
    .optional(),
  yAxisConfig: z
    .object({
      title: z.string().optional(),
      showGrid: z.boolean().default(true),
      min: z.number().optional().nullable(),
      max: z.number().optional().nullable(),
      format: z.string().optional()
    })
    .optional(),
  dataLabels: z
    .object({
      show: z.boolean().default(false),
      position: z.enum(['inside', 'outside', 'top']).default('top')
    })
    .optional(),
  numberFormat: z
    .object({
      prefix: z.string().default(''),
      suffix: z.string().default(''),
      decimals: z.number().int().min(0).max(10).default(2),
      compact: z.boolean().default(false),
      formatType: z.enum(['number', 'currency', 'percentage']).default('number')
    })
    .optional(),
  chartOptions: z
    .object({
      stacked: z.boolean().default(false),
      smooth: z.boolean().default(true),
      fillOpacity: z.number().min(0).max(1).default(0.4),
      donutHoleSize: z.number().min(0).max(90).default(60),
      showTotal: z.boolean().default(false)
    })
    .optional()
});

export const visualizationConfigSchema = z
  .object({
    xAxis: z.string().optional(),
    category: z.string().optional(),
    yAxis: z.union([z.string(), z.array(z.string())]).optional(),
    value: z.union([z.string(), z.array(z.string())]).optional(),
    aggregation: z.string().optional(),
    series: z.string().optional(),
    group: z.string().optional(),
    dimensions: z.array(z.string().min(1)).max(10).optional(),
    groupBy: z.array(z.string().min(1)).max(10).optional(),
    measures: z
      .array(
        z.object({
          column: z.string().min(1),
          aggregation: z.union([z.enum(ALLOWED_AGGREGATIONS), z.string()]),
          alias: z.string().max(63).optional()
        })
      )
      .max(20)
      .optional(),
    aggregations: z
      .array(
        z.object({
          column: z.string().min(1),
          function: z.string().optional(),
          aggregation: z.string().optional(),
          alias: z.string().max(63).optional()
        })
      )
      .max(20)
      .optional(),
    columns: z.array(z.string().min(1)).max(50).optional(),
    filters: z
      .array(
        z.object({
          column: z.string().min(1),
          operator: z.string().min(1),
          value: z.unknown().optional()
        })
      )
      .max(20)
      .optional(),
    sort: z
      .object({
        column: z.string().min(1),
        direction: z.union([z.enum(['asc', 'desc', 'ASC', 'DESC']), z.string()]).default('asc')
      })
      .optional(),
    sorting: z
      .union([
        z.object({
          column: z.string().min(1),
          direction: z.union([z.enum(['asc', 'desc', 'ASC', 'DESC']), z.string()]).default('asc')
        }),
        z.array(
          z.object({
            column: z.string().min(1),
            direction: z.union([z.enum(['asc', 'desc', 'ASC', 'DESC']), z.string()]).default('asc')
          })
        )
      ])
      .optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    // Advanced Customization options
    colorPalette: z.string().optional(),
    customColors: z.array(z.string()).optional(),
    legend: z
      .object({
        show: z.boolean().default(true),
        position: z.enum(['top', 'bottom', 'left', 'right']).default('top')
      })
      .optional(),
    xAxisConfig: z
      .object({
        title: z.string().optional(),
        showGrid: z.boolean().default(false),
        labelRotation: z.number().int().min(-90).max(90).default(0),
        showLabels: z.boolean().default(true)
      })
      .optional(),
    yAxisConfig: z
      .object({
        title: z.string().optional(),
        showGrid: z.boolean().default(true),
        min: z.number().optional().nullable(),
        max: z.number().optional().nullable(),
        format: z.string().optional()
      })
      .optional(),
    dataLabels: z
      .object({
        show: z.boolean().default(false),
        position: z.enum(['inside', 'outside', 'top']).default('top')
      })
      .optional(),
    numberFormat: z
      .object({
        prefix: z.string().default(''),
        suffix: z.string().default(''),
        decimals: z.number().int().min(0).max(10).default(2),
        compact: z.boolean().default(false),
        formatType: z.enum(['number', 'currency', 'percentage']).default('number')
      })
      .optional(),
    chartOptions: z
      .object({
        stacked: z.boolean().default(false),
        smooth: z.boolean().default(true),
        fillOpacity: z.number().min(0).max(1).default(0.4),
        donutHoleSize: z.number().min(0).max(90).default(60),
        showTotal: z.boolean().default(false)
      })
      .optional(),
    options: z.record(z.unknown()).default({}).optional(),
    theme: z.string().optional(),
    advancedCustomization: advancedCustomizationSchema.optional()
  })
  .passthrough();

export const createVisualizationSchema = z.preprocess(
  (raw: unknown) => {
    if (raw && typeof raw === 'object') {
      const copy = { ...(raw as Record<string, unknown>) };
      if (!copy.chartType && copy.type) {
        copy.chartType = copy.type;
      }
      return copy;
    }
    return raw;
  },
  z.object({
    title: z.string().trim().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
    description: z
      .string()
      .trim()
      .max(500, 'Description must be 500 characters or less')
      .optional()
      .nullable(),
    chartType: z
      .string()
      .toUpperCase()
      .refine(
        (val): val is VisualizationType =>
          ALLOWED_VISUALIZATION_TYPES.includes(val as VisualizationType),
        {
          message: `Invalid chart type. Supported: ${ALLOWED_VISUALIZATION_TYPES.join(', ')}`
        }
      ),
    type: z.string().optional(),
    datasetId: z.string().min(1, 'Invalid Dataset ID').optional().nullable(),
    dashboardId: z.string().min(1, 'Invalid Dashboard ID').optional().nullable(),
    workspaceId: z.string().optional().nullable(),
    config: visualizationConfigSchema.default({}),
    position: z
      .object({
        x: z.number().int().min(0).default(0),
        y: z.number().int().min(0).default(0),
        w: z.number().int().min(1).max(24).default(6),
        h: z.number().int().min(1).max(24).default(4)
      })
      .default({ x: 0, y: 0, w: 6, h: 4 }),
    sortOrder: z.number().int().default(0).optional()
  })
);

export const updateVisualizationSchema = z.preprocess(
  (raw: unknown) => {
    if (raw && typeof raw === 'object') {
      const copy = { ...(raw as Record<string, unknown>) };
      if (!copy.chartType && copy.type) {
        copy.chartType = copy.type;
      }
      return copy;
    }
    return raw;
  },
  z.object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .max(100, 'Title must be 100 characters or less')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must be 500 characters or less')
      .optional()
      .nullable(),
    chartType: z
      .string()
      .toUpperCase()
      .refine(
        (val): val is VisualizationType =>
          ALLOWED_VISUALIZATION_TYPES.includes(val as VisualizationType),
        {
          message: `Invalid chart type. Supported: ${ALLOWED_VISUALIZATION_TYPES.join(', ')}`
        }
      )
      .optional(),
    type: z.string().optional(),
    datasetId: z.string().min(1, 'Invalid Dataset ID').optional().nullable(),
    workspaceId: z.string().optional().nullable(),
    config: visualizationConfigSchema.optional(),
    position: z
      .object({
        x: z.number().int().min(0).default(0),
        y: z.number().int().min(0).default(0),
        w: z.number().int().min(1).max(24).default(6),
        h: z.number().int().min(1).max(24).default(4)
      })
      .optional(),
    sortOrder: z.number().int().optional()
  })
);

export type CreateVisualizationInput = z.infer<typeof createVisualizationSchema>;
export type UpdateVisualizationInput = z.infer<typeof updateVisualizationSchema>;

// ============================================================
// LOCAL DATASET QUERY FOUNDATION
// ============================================================

export const QUERY_LIMITS = {
  DEFAULT_ROW_LIMIT: 100,
  MAX_ROW_LIMIT: 1000,
  MAX_OFFSET: 100000,
  MAX_FILTERS: 20,
  MAX_COLUMNS: 50,
  MAX_DIMENSIONS: 10,
  MAX_MEASURES: 20
} as const;

export const ALLOWED_FILTER_OPERATORS = [
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'contains',
  'startsWith',
  'endsWith',
  'isNull',
  'isNotNull',
  'in'
] as const;

export type FilterOperator = (typeof ALLOWED_FILTER_OPERATORS)[number];

export const FILTER_OPERATOR_ALIASES: Record<string, FilterOperator> = {
  in: 'in',
  IN: 'in',
  '=': '=',
  '==': '=',
  equals: '=',
  equal: '=',
  '!=': '!=',
  '<>': '!=',
  'not equals': '!=',
  'not equal': '!=',
  notEquals: '!=',
  '>': '>',
  'greater than': '>',
  greaterThan: '>',
  gt: '>',
  '>=': '>=',
  'greater than or equal': '>=',
  greaterThanOrEqual: '>=',
  gte: '>=',
  '<': '<',
  'less than': '<',
  lessThan: '<',
  lt: '<',
  '<=': '<=',
  'less than or equal': '<=',
  lessThanOrEqual: '<=',
  lte: '<=',
  contains: 'contains',
  startsWith: 'startsWith',
  endsWith: 'endsWith',
  isNull: 'isNull',
  'is empty': 'isNull',
  isEmpty: 'isNull',
  isNotNull: 'isNotNull',
  'is not empty': 'isNotNull',
  isNotEmpty: 'isNotNull'
};

/**
 * Validates that an identifier contains only alphanumeric characters and
 * underscores. Mirrors the legacy SQL-identifier guard.
 */
export function validateSqlIdentifier(name: string): string {
  const clean = name.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(clean)) {
    throw AppError.badRequest(
      `Invalid SQL identifier: "${name}". Identifiers must start with a letter/underscore and contain only alphanumeric characters.`
    );
  }
  return clean;
}

// ---- Safe expression engine (calculated fields & metric formulas) -----------

export type CalculatedFieldDataType = 'NUMBER' | 'STRING' | 'BOOLEAN';

export const ALLOWED_CALCULATED_FUNCTIONS = ['SUM', 'ABS', 'ROUND', 'LOWER', 'UPPER', 'TRIM'] as const;
export type CalculatedFunction = (typeof ALLOWED_CALCULATED_FUNCTIONS)[number];

type TokenType = 'NUMBER' | 'STRING' | 'IDENTIFIER' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';

interface Token {
  type: TokenType;
  value: string | number;
  pos: number;
}

export type ASTNode =
  | { type: 'Literal'; value: number | string | boolean | null; dataType: CalculatedFieldDataType }
  | { type: 'Identifier'; name: string }
  | { type: 'Binary'; operator: string; left: ASTNode; right: ASTNode }
  | { type: 'Unary'; operator: string; argument: ASTNode }
  | { type: 'FunctionCall'; name: CalculatedFunction; args: ASTNode[] };

const EXPRESSION_PROHIBITED_KEYWORDS = [
  'eval',
  'function',
  'constructor',
  'prototype',
  '__proto__',
  'window',
  'global',
  'process',
  'require',
  'import',
  'script',
  'document',
  'select',
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'table'
];

function tokenizeExpression(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  const length = input.length;

  while (pos < length) {
    const ch = input[pos];
    if (ch === undefined) break;

    if (/\s/.test(ch)) {
      pos++;
      continue;
    }

    const nextChar = input[pos + 1] || '';
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(nextChar))) {
      const start = pos;
      let hasDot = false;
      while (pos < length) {
        const current = input[pos];
        if (current === undefined) break;
        if (/[0-9]/.test(current)) {
          pos++;
        } else if (current === '.' && !hasDot) {
          hasDot = true;
          pos++;
        } else {
          break;
        }
      }
      const numStr = input.slice(start, pos);
      const value = parseFloat(numStr);
      if (isNaN(value)) {
        throw new Error(`Invalid number literal '${numStr}' at position ${start}`);
      }
      tokens.push({ type: 'NUMBER', value, pos: start });
      continue;
    }

    if (ch === "'" || ch === '"') {
      const start = pos;
      pos++;
      let str = '';
      let terminated = false;
      while (pos < length) {
        const current = input[pos];
        if (current === undefined) break;
        if (current === '\\') {
          pos++;
          if (pos < length) {
            str += input[pos++];
          }
          continue;
        }
        if (current === ch) {
          pos++;
          terminated = true;
          break;
        }
        str += current;
        pos++;
      }
      if (!terminated) {
        throw new Error(`Unterminated string starting at position ${start}`);
      }
      tokens.push({ type: 'STRING', value: str, pos: start });
      continue;
    }

    if (ch === '[') {
      const start = pos;
      pos++;
      let name = '';
      let closed = false;
      while (pos < length) {
        const current = input[pos];
        if (current === undefined) break;
        if (current === ']') {
          pos++;
          closed = true;
          break;
        }
        name += current;
        pos++;
      }
      if (!closed) {
        throw new Error(`Unterminated bracketed identifier starting at position ${start}`);
      }
      tokens.push({ type: 'IDENTIFIER', value: name.trim(), pos: start });
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: pos++ });
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: pos++ });
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', pos: pos++ });
      continue;
    }

    const twoChar = input.slice(pos, pos + 2);
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(twoChar)) {
      tokens.push({ type: 'OPERATOR', value: twoChar, pos });
      pos += 2;
      continue;
    }

    if (['+', '-', '*', '/', '%', '>', '<', '='].includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch, pos: pos++ });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const start = pos;
      while (pos < length) {
        const current = input[pos];
        if (current === undefined || !/[a-zA-Z0-9_]/.test(current)) break;
        pos++;
      }
      const value = input.slice(start, pos);
      const upper = value.toUpperCase();
      if (upper === 'AND' || upper === 'OR') {
        tokens.push({ type: 'OPERATOR', value: upper, pos: start });
      } else {
        tokens.push({ type: 'IDENTIFIER', value, pos: start });
      }
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${pos}`);
  }

  tokens.push({ type: 'EOF', value: '', pos });
  return tokens;
}

class ExpressionParser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ASTNode {
    if (this.peek().type === 'EOF') {
      throw new Error('Empty expression');
    }
    const node = this.parseLogicalOr();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token '${this.peek().value}' after valid expression`);
    }
    return node;
  }

  private parseLogicalOr(): ASTNode {
    let left = this.parseLogicalAnd();
    while (this.matchOperator('OR', '||')) {
      const right = this.parseLogicalAnd();
      left = { type: 'Binary', operator: 'OR', left, right };
    }
    return left;
  }

  private parseLogicalAnd(): ASTNode {
    let left = this.parseComparison();
    while (this.matchOperator('AND', '&&')) {
      const right = this.parseComparison();
      left = { type: 'Binary', operator: 'AND', left, right };
    }
    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdditive();
    while (this.matchOperator('==', '!=', '>=', '<=', '>', '<', '=')) {
      const rawOp = String(this.tokens[this.index - 1]?.value ?? '=');
      const op = rawOp === '=' ? '==' : rawOp;
      const right = this.parseAdditive();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();
    while (this.matchOperator('+', '-')) {
      const op = String(this.tokens[this.index - 1]?.value ?? '+');
      const right = this.parseMultiplicative();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary();
    while (this.matchOperator('*', '/', '%')) {
      const op = String(this.tokens[this.index - 1]?.value ?? '*');
      const right = this.parseUnary();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.matchOperator('-', '+')) {
      const op = String(this.tokens[this.index - 1]?.value ?? '+');
      const argument = this.parseUnary();
      return { type: 'Unary', operator: op, argument };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();

    if (token.type === 'NUMBER') {
      this.advance();
      return { type: 'Literal', value: Number(token.value), dataType: 'NUMBER' };
    }

    if (token.type === 'STRING') {
      this.advance();
      return { type: 'Literal', value: String(token.value), dataType: 'STRING' };
    }

    if (token.type === 'LPAREN') {
      this.advance();
      const expr = this.parseLogicalOr();
      if (this.peek().type !== 'RPAREN') {
        throw new Error("Missing closing parenthesis ')'");
      }
      this.advance();
      return expr;
    }

    if (token.type === 'IDENTIFIER') {
      this.advance();
      const name = String(token.value);

      if (this.peek().type === 'LPAREN') {
        const upperFn = name.toUpperCase() as CalculatedFunction;
        if (!ALLOWED_CALCULATED_FUNCTIONS.includes(upperFn)) {
          throw new Error(
            `Function '${name}' is not supported. Supported functions: ${ALLOWED_CALCULATED_FUNCTIONS.join(', ')}`
          );
        }

        this.advance();
        const args: ASTNode[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseLogicalOr());
          while (this.peek().type === 'COMMA') {
            this.advance();
            args.push(this.parseLogicalOr());
          }
        }
        if (this.peek().type !== 'RPAREN') {
          throw new Error(`Missing closing parenthesis ')' for function '${name}'`);
        }
        this.advance();
        return { type: 'FunctionCall', name: upperFn, args };
      }

      return { type: 'Identifier', name };
    }

    throw new Error(`Unexpected token '${token.value || token.type}' at position ${token.pos}`);
  }

  private matchOperator(...ops: string[]): boolean {
    const token = this.peek();
    if (token.type === 'OPERATOR' && ops.includes(String(token.value).toUpperCase())) {
      this.advance();
      return true;
    }
    return false;
  }

  private peek(): Token {
    return this.tokens[this.index] || { type: 'EOF', value: '', pos: 0 };
  }

  private advance(): Token {
    if (this.index < this.tokens.length) {
      this.index++;
    }
    return this.tokens[this.index - 1] || { type: 'EOF', value: '', pos: 0 };
  }
}

/** Safely evaluates a compiled expression against a row. Never throws. */
export function evaluateExpression(node: ASTNode, row: Record<string, unknown>): unknown {
  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Identifier': {
      if (node.name in row) {
        return row[node.name];
      }
      const lowerKey = node.name.toLowerCase();
      for (const [key, value] of Object.entries(row)) {
        if (key.toLowerCase() === lowerKey) {
          return value;
        }
      }
      return null;
    }

    case 'Unary': {
      const val = evaluateExpression(node.argument, row);
      if (val === null || val === undefined) return null;
      if (node.operator === '-') {
        const num = Number(val);
        return isNaN(num) ? null : -num;
      }
      if (node.operator === '+') {
        const num = Number(val);
        return isNaN(num) ? null : +num;
      }
      return null;
    }

    case 'Binary': {
      const leftVal = evaluateExpression(node.left, row);
      const rightVal = evaluateExpression(node.right, row);

      if (node.operator === 'OR') {
        return Boolean(leftVal) || Boolean(rightVal);
      }
      if (node.operator === 'AND') {
        return Boolean(leftVal) && Boolean(rightVal);
      }

      if (['==', '!=', '>', '<', '>=', '<='].includes(node.operator)) {
        if (leftVal === null || rightVal === null || leftVal === undefined || rightVal === undefined) {
          if (node.operator === '==') return leftVal === rightVal;
          if (node.operator === '!=') return leftVal !== rightVal;
          return false;
        }

        const leftNum = Number(leftVal);
        const rightNum = Number(rightVal);
        const isNumeric = !isNaN(leftNum) && !isNaN(rightNum);

        const compare = (a: number | string, b: number | string): boolean => {
          switch (node.operator) {
            case '==':
              return a === b;
            case '!=':
              return a !== b;
            case '>':
              return a > b;
            case '<':
              return a < b;
            case '>=':
              return a >= b;
            case '<=':
              return a <= b;
            default:
              return false;
          }
        };

        if (isNumeric) {
          return compare(leftNum, rightNum);
        }
        return compare(String(leftVal), String(rightVal));
      }

      if (leftVal === null || rightVal === null || leftVal === undefined || rightVal === undefined) {
        return null;
      }

      if (node.operator === '+' && (typeof leftVal === 'string' || typeof rightVal === 'string')) {
        return `${String(leftVal)}${String(rightVal)}`;
      }

      const lNum = Number(leftVal);
      const rNum = Number(rightVal);
      if (isNaN(lNum) || isNaN(rNum)) {
        return null;
      }

      switch (node.operator) {
        case '+':
          return lNum + rNum;
        case '-':
          return lNum - rNum;
        case '*':
          return lNum * rNum;
        case '/':
          return rNum === 0 || !isFinite(rNum) ? null : lNum / rNum;
        case '%':
          return rNum === 0 ? null : lNum % rNum;
        default:
          return null;
      }
    }

    case 'FunctionCall': {
      const evaluatedArgs = node.args.map((a) => evaluateExpression(a, row));

      switch (node.name) {
        case 'SUM': {
          let sum = 0;
          let hasNumber = false;
          for (const arg of evaluatedArgs) {
            if (arg !== null && arg !== undefined) {
              const n = Number(arg);
              if (!isNaN(n)) {
                sum += n;
                hasNumber = true;
              }
            }
          }
          return hasNumber ? sum : null;
        }
        case 'ABS': {
          const arg = evaluatedArgs[0];
          if (arg === null || arg === undefined) return null;
          const n = Number(arg);
          return isNaN(n) ? null : Math.abs(n);
        }
        case 'ROUND': {
          const val = evaluatedArgs[0];
          if (val === null || val === undefined) return null;
          const n = Number(val);
          if (isNaN(n)) return null;
          const decimals = evaluatedArgs[1] !== undefined ? Number(evaluatedArgs[1]) : 0;
          const factor = Math.pow(10, Math.max(0, Math.min(10, isNaN(decimals) ? 0 : decimals)));
          return Math.round(n * factor) / factor;
        }
        case 'LOWER': {
          const val = evaluatedArgs[0];
          if (val === null || val === undefined) return null;
          return String(val).toLowerCase();
        }
        case 'UPPER': {
          const val = evaluatedArgs[0];
          if (val === null || val === undefined) return null;
          return String(val).toUpperCase();
        }
        case 'TRIM': {
          const val = evaluatedArgs[0];
          if (val === null || val === undefined) return null;
          return String(val).trim();
        }
        default:
          return null;
      }
    }
  }
}

function extractReferencedColumns(node: ASTNode): string[] {
  const columns = new Set<string>();

  const traverse = (current: ASTNode): void => {
    if (current.type === 'Identifier') {
      columns.add(current.name);
    } else if (current.type === 'Binary') {
      traverse(current.left);
      traverse(current.right);
    } else if (current.type === 'Unary') {
      traverse(current.argument);
    } else if (current.type === 'FunctionCall') {
      for (const arg of current.args) traverse(arg);
    }
  };

  traverse(node);
  return Array.from(columns);
}

function inferExpressionType(
  node: ASTNode,
  columnTypeMap: Map<string, string>
): CalculatedFieldDataType {
  switch (node.type) {
    case 'Literal':
      return node.dataType;
    case 'Identifier': {
      const type = (
        columnTypeMap.get(node.name) ||
        columnTypeMap.get(node.name.toLowerCase()) ||
        'string'
      ).toUpperCase();
      if (type.includes('INT') || type.includes('NUM') || type.includes('FLOAT') || type.includes('DECIMAL')) {
        return 'NUMBER';
      }
      if (type.includes('BOOL')) {
        return 'BOOLEAN';
      }
      return 'STRING';
    }
    case 'Unary':
      return 'NUMBER';
    case 'Binary': {
      if (['==', '!=', '>', '<', '>=', '<=', 'AND', 'OR'].includes(node.operator)) {
        return 'BOOLEAN';
      }
      if (node.operator === '+') {
        const leftType = inferExpressionType(node.left, columnTypeMap);
        const rightType = inferExpressionType(node.right, columnTypeMap);
        if (leftType === 'STRING' || rightType === 'STRING') {
          return 'STRING';
        }
      }
      return 'NUMBER';
    }
    case 'FunctionCall':
      return ['LOWER', 'UPPER', 'TRIM'].includes(node.name) ? 'STRING' : 'NUMBER';
  }
}

export interface CompiledExpression {
  ast: ASTNode;
  referencedColumns: string[];
  dataType: CalculatedFieldDataType;
}

/** Validates and compiles a calculated-field / metric formula expression. */
export function compileCalculatedField(
  expression: string,
  knownColumns: Array<{ name: string; type: string }>
): CompiledExpression {
  if (!expression || typeof expression !== 'string' || expression.trim().length === 0) {
    throw new Error('Expression cannot be empty');
  }

  if (expression.length > 500) {
    throw new Error('Expression exceeds maximum length of 500 characters');
  }

  const lower = expression.toLowerCase();
  for (const word of EXPRESSION_PROHIBITED_KEYWORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) {
      throw new Error(`Prohibited keyword or identifier '${word}' is not allowed in expressions`);
    }
  }

  const tokens = tokenizeExpression(expression);
  const ast = new ExpressionParser(tokens).parse();
  const referencedColumns = extractReferencedColumns(ast);

  const colMap = new Map<string, string>();
  for (const column of knownColumns) {
    colMap.set(column.name, column.type);
    colMap.set(column.name.toLowerCase(), column.type);
  }

  for (const col of referencedColumns) {
    if (!colMap.has(col) && !colMap.has(col.toLowerCase())) {
      throw new Error(`Referenced column '${col}' does not exist in dataset schema`);
    }
  }

  return { ast, referencedColumns, dataType: inferExpressionType(ast, colMap) };
}

// ---- Dataset snapshot + row reader -----------------------------------------

/** Minimal projection of a dataset document required to execute a query. */
export interface DatasetSnapshot {
  id: string;
  name: string;
  organizationId: string;
  workspaceId: string | null;
  rowCount: number;
  schemaMeta: Record<string, unknown>;
  columns: Array<{ name: string; dataType: string }>;
}

interface DatasetColumnRow {
  name: string;
  dataType: string;
}

/** Load a dataset plus its ordered column definitions. */
export async function loadDatasetSnapshot(datasetId: string): Promise<DatasetSnapshot | null> {
  const datasetObjectId = toObjectIdSafe(datasetId);
  if (!datasetObjectId) return null;

  const dataset = await DatasetModel.findById(datasetObjectId).lean();
  if (!dataset) return null;

  const columns = (await DatasetColumnModel.find({ datasetId: dataset._id })
    .sort({ ordinalPosition: 1 })
    .lean()) as DatasetColumnRow[];

  return {
    id: dataset._id.toString(),
    name: dataset.name,
    organizationId: dataset.organizationId.toString(),
    workspaceId: dataset.workspaceId ? dataset.workspaceId.toString() : null,
    rowCount: dataset.rowCount ?? 0,
    schemaMeta: readSchemaMeta(dataset.schemaMeta),
    columns: columns.map((c) => ({ name: c.name, dataType: c.dataType || 'STRING' }))
  };
}

/** Read the raw rows of a dataset straight out of its `schemaMeta` payload. */
export async function getDatasetRows(datasetId: string): Promise<Record<string, unknown>[]> {
  const datasetObjectId = toObjectIdSafe(datasetId);
  if (!datasetObjectId) return [];

  const dataset = await DatasetModel.findById(datasetObjectId)
    .select('schemaMeta')
    .lean();
  if (!dataset) return [];

  return extractRawRows(readSchemaMeta(dataset.schemaMeta));
}

/** Narrow a `Mixed` dataset schema payload to a plain record. */
function readSchemaMeta(meta: unknown): Record<string, unknown> {
  return (meta || {}) as Record<string, unknown>;
}

function extractRawRows(meta: Record<string, unknown>): Record<string, unknown>[] {
  const candidate =
    (meta.sampleData as Record<string, unknown>[] | undefined) ??
    (meta.previewRows as Record<string, unknown>[] | undefined) ??
    (meta.rows as Record<string, unknown>[] | undefined) ??
    [];
  return Array.isArray(candidate) ? candidate : [];
}

function toObjectIdSafe(value: string): mongoose.Types.ObjectId | null {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function validateAndCoerceFilterValue(
  colType: string,
  operator: FilterOperator,
  value: unknown,
  colName: string
): unknown {
  if (operator === 'isNull' || operator === 'isNotNull') {
    return null;
  }

  if (value === undefined || value === null) {
    throw AppError.badRequest(
      `Filter value is required for operator "${operator}" on column "${colName}"`
    );
  }

  if (operator === 'in') {
    let items: unknown[] = [];
    if (Array.isArray(value)) {
      items = value;
    } else if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        items = Array.isArray(parsed) ? parsed : [value];
      } catch {
        items = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else {
      items = [value];
    }

    if (colType === 'number' || colType === 'integer') {
      return items.map((v) => {
        const num = Number(v);
        if (Number.isNaN(num)) {
          throw AppError.badRequest(
            `Filter value contains non-numeric element for column "${colName}"`
          );
        }
        return colType === 'integer' ? Math.round(num) : num;
      });
    }
    return items.map((v) => String(v));
  }

  if (colType === 'integer') {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      return parseInt(value.trim(), 10);
    }
    throw AppError.badRequest(`Filter value for integer column "${colName}" must be a valid integer`);
  }

  if (colType === 'number') {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string' && /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(value.trim())) {
      const parsed = parseFloat(value.trim());
      if (!Number.isNaN(parsed)) return parsed;
    }
    throw AppError.badRequest(`Filter value for numeric column "${colName}" must be a valid number`);
  }

  if (colType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    throw AppError.badRequest(`Filter value for boolean column "${colName}" must be a boolean`);
  }

  if (colType === 'date') {
    const parsed = new Date(value as string | number | Date);
    if (isNaN(parsed.getTime())) {
      throw AppError.badRequest(`Filter value for date column "${colName}" must be a valid date`);
    }
    return parsed.toISOString();
  }

  return String(value);
}

/**
 * Executes a validated, bounded query against a dataset snapshot.
 *
 * Behaviour-compatible replacement for the legacy `datasetQueryEngine`
 * (in-memory / CSV execution path).
 */
export async function executeLocalDatasetQuery(
  dataset: DatasetSnapshot,
  params: DatasetQueryParams = {}
): Promise<DatasetQueryResult> {
  const startTime = Date.now();
  const meta = readSchemaMeta(dataset.schemaMeta);

  // 1. Build the column type map (persisted columns, then schemaMeta, then calculated fields).
  const columnTypeMap = new Map<string, string>();
  for (const column of dataset.columns) {
    columnTypeMap.set(column.name, (column.dataType || 'STRING').toLowerCase());
  }
  const knownColumnsList = (meta.columns || []) as Array<{ name: string; type: string }>;
  for (const column of knownColumnsList) {
    if (!columnTypeMap.has(column.name)) {
      columnTypeMap.set(column.name, (column.type || 'string').toLowerCase());
    }
  }

  const calculatedFields = (Array.isArray(meta.calculatedFields)
    ? meta.calculatedFields
    : []) as Array<{ name: string; expression: string; dataType?: string }>;

  for (const cf of calculatedFields) {
    if (!columnTypeMap.has(cf.name)) {
      columnTypeMap.set(cf.name, (cf.dataType || 'NUMBER').toLowerCase());
    }
  }

  const knownColumnNames = Array.from(columnTypeMap.keys());

  // 2. Normalize dimensions / measures / ordering.
  const rawDimensions = (params.dimensions || params.groupBy || []).filter(Boolean);

  let rawMeasures: Array<{ column: string; aggregation: AggregationFunction; alias?: string }> = [];
  if (Array.isArray(params.measures) && params.measures.length > 0) {
    rawMeasures = params.measures;
  } else if (Array.isArray(params.aggregations) && params.aggregations.length > 0) {
    rawMeasures = params.aggregations.map((a) => {
      const rawFn = String(a.function || a.aggregation || 'COUNT').toUpperCase();
      const fn = ALLOWED_AGGREGATIONS.includes(rawFn as AggregationFunction)
        ? (rawFn as AggregationFunction)
        : ('COUNT' as AggregationFunction);
      const col = a.column ?? '*';
      return {
        column: col,
        aggregation: fn,
        alias: a.alias || (col === '*' ? `${fn.toLowerCase()}_count` : `${fn.toLowerCase()}_${col}`)
      };
    });
  }

  let rawOrderBy: DatasetQueryParams['orderBy'];
  {
    const sortSpec = params.sort as DatasetQueryParams['orderBy'] | DatasetQueryParams['sort'][] | undefined;
    const sortingSpec = params.sorting;

    if (params.orderBy) {
      const asArray = params.orderBy as unknown as DatasetQueryParams['sort'][];
      rawOrderBy = Array.isArray(asArray) ? asArray[0] : params.orderBy;
    } else if (Array.isArray(sortSpec)) {
      rawOrderBy = sortSpec[0];
    } else if (sortSpec) {
      rawOrderBy = sortSpec;
    } else if (Array.isArray(sortingSpec) && sortingSpec.length > 0) {
      rawOrderBy = sortingSpec[0];
    } else if (sortingSpec && !Array.isArray(sortingSpec)) {
      rawOrderBy = sortingSpec;
    }
  }

  // 3. Validate row limits & offset.
  const requestedLimit = params.limit ?? QUERY_LIMITS.DEFAULT_ROW_LIMIT;
  if (requestedLimit > QUERY_LIMITS.MAX_ROW_LIMIT) {
    throw AppError.badRequest(
      `Requested limit ${requestedLimit} exceeds maximum allowable limit of ${QUERY_LIMITS.MAX_ROW_LIMIT}`
    );
  }
  const limit = Math.min(Math.max(requestedLimit, 1), QUERY_LIMITS.MAX_ROW_LIMIT);

  const requestedOffset = params.offset ?? 0;
  if (requestedOffset < 0 || requestedOffset > QUERY_LIMITS.MAX_OFFSET) {
    throw AppError.badRequest(
      `Invalid offset: must be between 0 and ${QUERY_LIMITS.MAX_OFFSET}`
    );
  }
  const offset = requestedOffset;

  // 4. Query mode.
  const hasDimensions = rawDimensions.length > 0;
  const hasMeasures = rawMeasures.length > 0;
  const isAggregate = hasDimensions || hasMeasures;

  // 5. Validate dimensions / measures / columns.
  const validatedDimensions: string[] = [];
  const validatedMeasures: Array<{
    column: string;
    aggregation: AggregationFunction;
    alias: string;
    resultType: string;
  }> = [];
  let selectedColumns: string[] = [];

  if (isAggregate) {
    if (rawDimensions.length > QUERY_LIMITS.MAX_DIMENSIONS) {
      throw AppError.badRequest(
        `Dimensions count (${rawDimensions.length}) exceeds maximum allowable (${QUERY_LIMITS.MAX_DIMENSIONS})`
      );
    }
    for (const dim of rawDimensions) {
      if (!knownColumnNames.includes(dim)) {
        throw AppError.badRequest(`Dimension column "${dim}" does not exist in dataset schema`);
      }
      validateSqlIdentifier(dim);
      validatedDimensions.push(dim);
    }

    if (rawMeasures.length > QUERY_LIMITS.MAX_MEASURES) {
      throw AppError.badRequest(
        `Measures count (${rawMeasures.length}) exceeds maximum allowable (${QUERY_LIMITS.MAX_MEASURES})`
      );
    }
    for (const measure of rawMeasures) {
      if (measure.column !== '*' && !knownColumnNames.includes(measure.column)) {
        throw AppError.badRequest(
          `Measure column "${measure.column}" does not exist in dataset schema`
        );
      }
      if (measure.column !== '*') {
        validateSqlIdentifier(measure.column);
      }

      const aggregation = String(measure.aggregation).toUpperCase() as AggregationFunction;
      if (!ALLOWED_AGGREGATIONS.includes(aggregation)) {
        throw AppError.badRequest(`Unsupported aggregation function "${measure.aggregation}"`);
      }

      if (measure.column !== '*') {
        const colType = columnTypeMap.get(measure.column) || 'string';
        if ((aggregation === 'SUM' || aggregation === 'AVG') && colType !== 'number' && colType !== 'integer') {
          throw AppError.badRequest(
            `Aggregation "${aggregation}" cannot be applied to non-numeric column "${measure.column}" (type: ${colType})`
          );
        }
      }

      const defaultAlias = `${aggregation.toLowerCase()}_${measure.column === '*' ? 'count' : measure.column}`;
      const finalAlias = measure.alias ? validateSqlIdentifier(measure.alias) : defaultAlias;

      let resultType = 'number';
      if (aggregation === 'COUNT') {
        resultType = 'integer';
      } else if (aggregation === 'MIN' || aggregation === 'MAX') {
        resultType = columnTypeMap.get(measure.column) || 'string';
      }

      validatedMeasures.push({
        column: measure.column,
        aggregation,
        alias: finalAlias,
        resultType
      });
    }
  } else {
    if (params.columns && params.columns.length > 0) {
      if (params.columns.length > QUERY_LIMITS.MAX_COLUMNS) {
        throw AppError.badRequest(
          `Requested column count (${params.columns.length}) exceeds limit of ${QUERY_LIMITS.MAX_COLUMNS}`
        );
      }
      for (const col of params.columns) {
        if (!knownColumnNames.includes(col)) {
          throw AppError.badRequest(`Requested column "${col}" does not exist in dataset schema`);
        }
        validateSqlIdentifier(col);
      }
      selectedColumns = params.columns;
    } else {
      selectedColumns = knownColumnNames;
    }
  }

  // 6. Validate filters.
  const validatedFilters: DatasetQueryFilter[] = [];
  if (params.filters && params.filters.length > 0) {
    if (params.filters.length > QUERY_LIMITS.MAX_FILTERS) {
      throw AppError.badRequest(
        `Filter count (${params.filters.length}) exceeds maximum allowable (${QUERY_LIMITS.MAX_FILTERS})`
      );
    }

    for (const filter of params.filters) {
      const colName = filter.column;
      if (!knownColumnNames.includes(colName)) {
        throw AppError.badRequest(`Filter column "${colName}" does not exist in dataset schema`);
      }
      const rawOp = filter.operator;
      const alias =
        typeof rawOp === 'string'
          ? FILTER_OPERATOR_ALIASES[rawOp] || FILTER_OPERATOR_ALIASES[rawOp.toLowerCase()]
          : undefined;
      const op: FilterOperator | string = alias || rawOp;

      if (!ALLOWED_FILTER_OPERATORS.includes(op as FilterOperator)) {
        throw AppError.badRequest(`Unsupported filter operator: "${filter.operator}"`);
      }

      const colType = columnTypeMap.get(colName) || 'string';
      const validatedValue = validateAndCoerceFilterValue(
        colType,
        op as FilterOperator,
        filter.value,
        colName
      );

      validatedFilters.push({ column: colName, operator: op as FilterOperator, value: validatedValue });
    }
  }

  const filterLogic: 'AND' | 'OR' =
    (params.filterLogic || params.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';

  // 7. Validate ordering.
  let validatedOrderBy: { column: string; direction: 'asc' | 'desc' } | undefined;
  if (rawOrderBy) {
    const orderCol = rawOrderBy.column;
    const orderDir = String(rawOrderBy.direction).toLowerCase() === 'desc' ? 'desc' : 'asc';

    if (isAggregate) {
      const validOrderCols = [
        ...validatedDimensions,
        ...validatedMeasures.map((m) => m.alias),
        ...validatedMeasures.map((m) => m.column)
      ];
      if (!validOrderCols.includes(orderCol)) {
        throw AppError.badRequest(
          `Order by column "${orderCol}" must be one of the selected dimensions or measure aliases`
        );
      }
    } else if (!knownColumnNames.includes(orderCol)) {
      throw AppError.badRequest(`Order by column "${orderCol}" does not exist in dataset schema`);
    }

    validateSqlIdentifier(orderCol);
    validatedOrderBy = { column: orderCol, direction: orderDir };
  }

  // 8. Execute in memory over the stored rows.
  const rawRows = extractRawRows(meta);

  let processedSourceRows = rawRows;
  if (calculatedFields.length > 0 && rawRows.length > 0) {
    const knownCols = Array.from(columnTypeMap.entries()).map(([name, type]) => ({ name, type }));
    const compiledFields: Array<{ name: string; ast: ASTNode }> = [];
    for (const cf of calculatedFields) {
      try {
        compiledFields.push({ name: cf.name, ast: compileCalculatedField(cf.expression, knownCols).ast });
      } catch {
        // Legacy behaviour: a broken legacy expression is skipped silently.
      }
    }

    if (compiledFields.length > 0) {
      processedSourceRows = rawRows.map((row) => {
        const copy: Record<string, unknown> = { ...row };
        for (const cf of compiledFields) {
          copy[cf.name] = evaluateExpression(cf.ast, copy);
        }
        return copy;
      });
    }
  }

  const evalFilterCondition = (filter: DatasetQueryFilter, row: Record<string, unknown>): boolean => {
    const val = row[filter.column];

    if (filter.operator === 'isNull') return val === null || val === undefined;
    if (filter.operator === 'isNotNull') return val !== null && val !== undefined;
    if (val === null || val === undefined) return false;

    const colType = columnTypeMap.get(filter.column) || 'string';

    if (colType === 'number' || colType === 'integer') {
      const numVal = Number(val);
      const filterVal = Number(filter.value);
      if (filter.operator === '=') return numVal === filterVal;
      if (filter.operator === '!=') return numVal !== filterVal;
      if (filter.operator === '>') return numVal > filterVal;
      if (filter.operator === '>=') return numVal >= filterVal;
      if (filter.operator === '<') return numVal < filterVal;
      if (filter.operator === '<=') return numVal <= filterVal;
    }

    if (colType === 'date') {
      const rowTime = new Date(val as string | number | Date).getTime();
      const filterTime = new Date(filter.value as string | number | Date).getTime();
      if (filter.operator === '=') return rowTime === filterTime;
      if (filter.operator === '!=') return rowTime !== filterTime;
      if (filter.operator === '>') return rowTime > filterTime;
      if (filter.operator === '>=') return rowTime >= filterTime;
      if (filter.operator === '<') return rowTime < filterTime;
      if (filter.operator === '<=') return rowTime <= filterTime;
    }

    if (colType === 'boolean') {
      const boolVal = Boolean(val);
      const filterBool = Boolean(filter.value);
      if (filter.operator === '=') return boolVal === filterBool;
      if (filter.operator === '!=') return boolVal !== filterBool;
    }

    const strVal = String(val).toLowerCase();
    const filterStr = String(filter.value ?? '').toLowerCase();

    if (filter.operator === '=') return strVal === filterStr;
    if (filter.operator === '!=') return strVal !== filterStr;
    if (filter.operator === '>') return strVal > filterStr;
    if (filter.operator === '>=') return strVal >= filterStr;
    if (filter.operator === '<') return strVal < filterStr;
    if (filter.operator === '<=') return strVal <= filterStr;
    if (filter.operator === 'contains') return strVal.includes(filterStr);
    if (filter.operator === 'startsWith') return strVal.startsWith(filterStr);
    if (filter.operator === 'endsWith') return strVal.endsWith(filterStr);
    if (filter.operator === 'in') {
      const rawList = Array.isArray(filter.value) ? filter.value : [filter.value];
      if (colType === 'number' || colType === 'integer') {
        return rawList.map((v) => Number(v)).includes(Number(val));
      }
      return rawList.map((v) => String(v).toLowerCase()).includes(String(val).toLowerCase());
    }

    return false;
  };

  const filteredRows = processedSourceRows.filter((row) => {
    if (validatedFilters.length === 0) return true;
    if (filterLogic === 'OR') {
      return validatedFilters.some((filter) => evalFilterCondition(filter, row));
    }
    return validatedFilters.every((filter) => evalFilterCondition(filter, row));
  });

  let processedRows: Record<string, unknown>[] = [];
  const resultColumns: QueryResultColumn[] = [];

  if (isAggregate) {
    for (const dim of validatedDimensions) {
      resultColumns.push({ name: dim, type: columnTypeMap.get(dim) || 'string' });
    }
    for (const measure of validatedMeasures) {
      resultColumns.push({ name: measure.alias, type: measure.resultType });
    }

    const groups = new Map<string, { dims: Record<string, unknown>; rows: Record<string, unknown>[] }>();

    if (validatedDimensions.length === 0) {
      groups.set('all', { dims: {}, rows: filteredRows });
    } else {
      for (const row of filteredRows) {
        const dimObj: Record<string, unknown> = {};
        for (const dim of validatedDimensions) {
          dimObj[dim] = row[dim] ?? null;
        }
        const groupKey = JSON.stringify(dimObj);
        const existing = groups.get(groupKey);
        if (existing) {
          existing.rows.push(row);
        } else {
          groups.set(groupKey, { dims: dimObj, rows: [row] });
        }
      }
    }

    for (const group of groups.values()) {
      const aggregatedRow: Record<string, unknown> = { ...group.dims };

      for (const measure of validatedMeasures) {
        if (measure.aggregation === 'COUNT') {
          aggregatedRow[measure.alias] =
            measure.column === '*'
              ? group.rows.length
              : group.rows.filter(
                  (r) => r[measure.column] !== null && r[measure.column] !== undefined
                ).length;
        } else if (measure.aggregation === 'SUM') {
          const sum = group.rows.reduce<number>((acc, r) => {
            const val = Number(r[measure.column]);
            return !isNaN(val) ? acc + val : acc;
          }, 0);
          aggregatedRow[measure.alias] = Math.round(sum * 1000) / 1000;
        } else if (measure.aggregation === 'AVG') {
          const validVals = group.rows
            .map((r) => Number(r[measure.column]))
            .filter((v) => !isNaN(v));
          const avg = validVals.length > 0 ? validVals.reduce((a, b) => a + b, 0) / validVals.length : 0;
          aggregatedRow[measure.alias] = Math.round(avg * 1000) / 1000;
        } else if (measure.aggregation === 'MIN') {
          const vals = group.rows
            .map((r) => r[measure.column])
            .filter((v) => v !== null && v !== undefined);
          aggregatedRow[measure.alias] =
            vals.length > 0 ? vals.reduce((min, cur) => (cur < min ? cur : min)) : null;
        } else if (measure.aggregation === 'MAX') {
          const vals = group.rows
            .map((r) => r[measure.column])
            .filter((v) => v !== null && v !== undefined);
          aggregatedRow[measure.alias] =
            vals.length > 0 ? vals.reduce((max, cur) => (cur > max ? cur : max)) : null;
        }
      }

      processedRows.push(aggregatedRow);
    }
  } else {
    for (const col of selectedColumns) {
      resultColumns.push({ name: col, type: columnTypeMap.get(col) || 'string' });
    }

    processedRows = filteredRows.map((row) => {
      const projected: Record<string, unknown> = {};
      for (const col of selectedColumns) {
        projected[col] = row[col] ?? null;
      }
      return projected;
    });
  }

  if (validatedOrderBy) {
    const { column, direction } = validatedOrderBy;
    const factor = direction === 'desc' ? -1 : 1;
    processedRows.sort((a, b) => {
      const valA = a[column];
      const valB = b[column];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * factor;
      }
      return valA > valB ? factor : -factor;
    });
  }

  const total = processedRows.length;
  const sliced = processedRows.slice(offset, offset + limit);
  const executionTimeMs = Date.now() - startTime;

  return {
    columns: resultColumns,
    rows: sliced,
    processedColumns: resultColumns,
    processedRows: sliced,
    rowCount: sliced.length,
    total,
    limit,
    offset,
    executionTimeMs,
    metadata: {
      rowCount: sliced.length,
      total,
      limit,
      offset,
      executionTimeMs,
      queryMode: isAggregate ? 'AGGREGATE' : 'RAW'
    }
  };
}

// ============================================================
// WORKSPACE AUTHORIZATION HELPERS
// ============================================================

export type WorkspaceAction = 'READ' | 'WRITE' | 'DELETE' | 'ADMIN' | 'SHARE';

export interface UserWorkspaceContext {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  userRole: string;
  isOrgAdmin: boolean;
}

/** Resolve a workspace the caller is allowed to touch (org-scoped). */
export async function resolveWorkspaceAccess(
  workspaceId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<UserWorkspaceContext> {
  const workspaceObjectId = toObjectIdSafe(workspaceId);
  const organizationObjectId = toObjectIdSafe(organizationId);

  const workspace = workspaceObjectId
    ? await WorkspaceModel.findOne({
        _id: workspaceObjectId,
        ...(organizationObjectId ? { organizationId: organizationObjectId } : {})
      }).lean()
    : null;

  if (!workspace) {
    throw AppError.notFound('Workspace');
  }

  const isOrgAdmin = userRoleName === 'ADMIN';
  const userObjectId = toObjectIdSafe(userId);

  const membership =
    userObjectId && workspaceObjectId
      ? await WorkspaceMemberModel.findOne({
          workspaceId: workspaceObjectId,
          userId: userObjectId
        })
          .select('role')
          .lean()
      : null;

  if (!membership && !isOrgAdmin) {
    throw AppError.forbidden('Access denied: You do not have access to this workspace');
  }

  return {
    workspace: {
      id: workspace._id.toString(),
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      organizationId: workspace.organizationId.toString(),
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    },
    userRole: membership?.role ?? WORKSPACE_ROLE.ADMIN,
    isOrgAdmin
  };
}

/**
 * Enforces the tenant + workspace boundary for a resource that carries a
 * `workspaceId` / `organizationId` pair.
 */
export async function assertResourceWorkspaceAccess(
  resource: { workspaceId?: string | null; organizationId: string },
  userId: string,
  organizationId: string,
  userRoleName?: string,
  requiredAction: WorkspaceAction = 'READ'
): Promise<void> {
  if (resource.organizationId !== organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }

  if (userRoleName === 'ADMIN') {
    return;
  }

  if (!resource.workspaceId) {
    return;
  }

  const access = await resolveWorkspaceAccess(
    resource.workspaceId,
    userId,
    organizationId,
    userRoleName
  ).catch((err: unknown) => {
    if (err instanceof AppError) throw err;
    return null;
  });

  if (!access) return;
  if (access.isOrgAdmin) return;

  const userRole = access.userRole;

  if (requiredAction === 'READ') return;

  if (requiredAction === 'WRITE') {
    if (userRole === WORKSPACE_ROLE.VIEWER) {
      throw AppError.forbidden(
        'Access denied: Viewers have read-only access to this workspace'
      );
    }
    return;
  }

  if (requiredAction === 'DELETE') {
    if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN) {
      throw AppError.forbidden(
        'Access denied: Only workspace owners and admins can delete this resource'
      );
    }
    return;
  }

  if (requiredAction === 'SHARE') {
    if (userRole === WORKSPACE_ROLE.VIEWER) {
      throw AppError.forbidden('Access denied: Viewers cannot share workspace resources');
    }
    return;
  }

  if (requiredAction === 'ADMIN') {
    if (userRole !== WORKSPACE_ROLE.OWNER && userRole !== WORKSPACE_ROLE.ADMIN) {
      throw AppError.forbidden(
        'Access denied: Only workspace owners and admins have administrative permissions'
      );
    }
    return;
  }
}

/** Dashboards keep their workspace binding inside `layoutConfig`. */
export function getDashboardWorkspaceId(layoutConfig: unknown): string | undefined {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return undefined;
  }
  const workspaceId = (layoutConfig as Record<string, unknown>).workspaceId;
  return typeof workspaceId === 'string' && workspaceId.trim() ? workspaceId : undefined;
}

// ============================================================
// CHART HELPERS
// ============================================================

/** Dataset summary attached to a chart when it is loaded with `dataset`. */
export interface ChartDatasetSummary {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: string;
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId | null;
  schemaMeta?: Record<string, unknown>;
}

/** Chart document shape consumed by the visualization helpers. */
export interface VisualizationChartSource {
  _id: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId | null;
  title: string;
  description: string | null;
  chartType: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  dataset?: ChartDatasetSummary | null;
}



/** Empty result returned for visualizations that are not linked to a dataset. */
export function emptyQueryResult(): DatasetQueryResult {
  return {
    columns: [],
    rows: [],
    processedColumns: [],
    processedRows: [],
    rowCount: 0,
    total: 0,
    limit: 100,
    offset: 0,
    executionTimeMs: 0,
    metadata: {
      rowCount: 0,
      total: 0,
      limit: 100,
      offset: 0,
      executionTimeMs: 0,
      queryMode: 'RAW'
    }
  };
}

/** Project a chart document into the legacy visualization payload. */
export function buildSafeVisualization(chart: VisualizationChartSource): VisualizationData {
  return {
    id: chart._id.toString(),
    dashboardId: chart.dashboardId.toString(),
    datasetId: chart.datasetId ? chart.datasetId.toString() : null,
    datasetName: chart.dataset?.name ?? null,
    datasetType: chart.dataset?.type ?? null,
    workspaceId: chart.dataset?.workspaceId ? chart.dataset.workspaceId.toString() : null,
    title: chart.title,
    description: chart.description,
    chartType: chart.chartType as VisualizationData['chartType'],
    config: (chart.config || {}) as VisualizationData['config'],
    position: (chart.position || {}) as unknown as VisualizationData['position'],
    sortOrder: chart.sortOrder,
    createdAt: chart.createdAt.toISOString(),
    updatedAt: chart.updatedAt.toISOString()
  };
}

/**
 * Turn a chart's stored configuration into a dataset query and execute it.
 */
export async function executeVisualizationQuery(
  chart: VisualizationChartSource,
  userId: string,
  organizationId: string,
  roleName?: string
): Promise<DatasetQueryResult> {
  if (!chart.datasetId) {
    return emptyQueryResult();
  }

  // The legacy code reused the `select`-limited dataset relation, which never
  // carried `schemaMeta` (the row payload) — always load the full document.
  const snapshot = await loadDatasetSnapshot(chart.datasetId.toString());
  if (!snapshot) {
    throw AppError.notFound('Dataset linked to visualization not found');
  }

  await assertResourceWorkspaceAccess(snapshot, userId, organizationId, roleName);

  const rawConfig = (chart.config || {}) as Record<string, unknown>;
  const chartType = String(chart.chartType).toUpperCase();

  const xAxis = (rawConfig.xAxis || rawConfig.category) as string | undefined;
  const yAxis = (rawConfig.yAxis || rawConfig.value) as string | string[] | undefined;
  const series = (rawConfig.series || rawConfig.group) as string | undefined;
  const aggregation = rawConfig.aggregation as string | undefined;

  const queryParams: DatasetQueryParams = {
    limit: typeof rawConfig.limit === 'number' ? rawConfig.limit : 1000,
    filters: (rawConfig.filters as DatasetQueryFilter[]) || []
  };

  // Sorting
  if (rawConfig.sort) {
    queryParams.sort = rawConfig.sort as DatasetQueryParams['sort'];
  } else if (rawConfig.sorting) {
    queryParams.sorting = rawConfig.sorting as DatasetQueryParams['sorting'];
  } else if (rawConfig.orderBy) {
    queryParams.orderBy = rawConfig.orderBy as DatasetQueryParams['orderBy'];
  } else if (xAxis) {
    queryParams.orderBy = { column: String(xAxis), direction: 'asc' };
  }

  // Dimensions & Measures
  if (Array.isArray(rawConfig.measures) && rawConfig.measures.length > 0) {
    queryParams.measures = rawConfig.measures as DatasetQueryParams['measures'];
    queryParams.dimensions =
      (rawConfig.dimensions as string[]) || (xAxis ? [String(xAxis)] : []);
  } else if (Array.isArray(rawConfig.aggregations) && rawConfig.aggregations.length > 0) {
    queryParams.aggregations = rawConfig.aggregations as DatasetQueryParams['aggregations'];
    queryParams.dimensions =
      (rawConfig.dimensions as string[]) ||
      (rawConfig.groupBy as string[]) ||
      (xAxis ? [String(xAxis)] : []);
  } else if (chartType === 'SCATTER' && !aggregation && xAxis && yAxis) {
    queryParams.columns = [String(xAxis), String(yAxis)];
  } else if (yAxis && (aggregation || chartType === 'KPI')) {
    const agg = String(aggregation || 'SUM').toUpperCase() as AggregationFunction;
    const yCol = Array.isArray(yAxis) ? String(yAxis[0]) : String(yAxis);
    const measures: DatasetQueryParams['measures'] = [
      {
        column: yCol,
        aggregation: agg,
        alias: yCol === '*' ? `${agg.toLowerCase()}_count` : yCol
      }
    ];

    const secondaryY = (rawConfig.secondaryValueCol || rawConfig.secondary || rawConfig.yAxis2) as
      | string
      | string[]
      | undefined;
    if (secondaryY && String(secondaryY) !== yCol) {
      const second = Array.isArray(secondaryY) ? String(secondaryY[0]) : String(secondaryY);
      measures.push({
        column: second,
        aggregation: agg,
        alias: second
      });
    }

    queryParams.measures = measures;

    if (chartType !== 'KPI' && xAxis) {
      const dims = [String(xAxis)];
      const groupCol = (rawConfig.groupCol || rawConfig.group || series) as string | undefined;
      if (groupCol && groupCol !== xAxis) {
        dims.push(String(groupCol));
      }
      queryParams.dimensions = dims;
    }
  } else if (chartType === 'TABLE') {
    if (Array.isArray(rawConfig.columns) && rawConfig.columns.length > 0) {
      queryParams.columns = rawConfig.columns as string[];
    }
  } else if (xAxis && !yAxis) {
    queryParams.dimensions = [String(xAxis)];
    queryParams.measures = [{ column: '*', aggregation: 'COUNT', alias: 'count' }];
  }

  return executeLocalDatasetQuery(snapshot, queryParams);
}

// ============================================================
// SERVICE HELPERS
// ============================================================

/** Request-scoped metadata forwarded into the audit trail. */
export interface AuditRequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

/** Minimal chart row used when attaching dataset summaries. */
export interface ChartRow {
  _id: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId | null;
  title: string;
  description: string | null;
  chartType: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Chart + owning dashboard organization + dataset summary, for tenant checks. */
export interface ChartTenantContext {
  chart: VisualizationChartSource;
  dashboardOrganizationId: mongoose.Types.ObjectId | null;
}

/**
 * Load a chart together with the tenant context required by the read guards.
 * The dashboard relation is resolved separately because the legacy include
 * chain only ever read `dashboard.organizationId`.
 */
async function findChartWithTenantContext(
  chartObjectId: mongoose.Types.ObjectId
): Promise<ChartTenantContext | null> {
  const raw = await ChartModel.findById(chartObjectId).lean();
  if (!raw) return null;

  const dashboard = await DashboardModel.findById(raw.dashboardId)
    .select('organizationId')
    .lean();

  const [withDataset] = await attachDatasets([raw as unknown as ChartRow]);

  return {
    chart: withDataset as unknown as VisualizationChartSource,
    dashboardOrganizationId: dashboard?.organizationId ?? null
  };
}

/** Dataset projection attached to a chart for the safe visualization payload. */
async function loadChartDatasets(
  charts: Array<{ datasetId: mongoose.Types.ObjectId | null }>
): Promise<Map<string, ChartDatasetSummary>> {
  const ids = charts
    .map((chart) => chart.datasetId)
    .filter((id): id is mongoose.Types.ObjectId => !!id);
  if (ids.length === 0) {
    return new Map();
  }

  const datasets = await DatasetModel.find({ _id: { $in: ids } })
    .select('_id name type workspaceId organizationId')
    .lean();

  const byId = new Map<string, ChartDatasetSummary>();
  for (const dataset of datasets) {
    byId.set(dataset._id.toString(), {
      _id: dataset._id,
      name: dataset.name,
      type: dataset.type,
      organizationId: dataset.organizationId,
      workspaceId: dataset.workspaceId
    });
  }
  return byId;
}

/** Attach the dataset summary to a list of chart documents. */
async function attachDatasets<T extends { datasetId: mongoose.Types.ObjectId | null }>(
  charts: T[]
): Promise<Array<T & { dataset: ChartDatasetSummary | null }>> {
  const datasets = await loadChartDatasets(charts);
  return charts.map((chart) => ({
    ...chart,
    dataset: chart.datasetId ? datasets.get(chart.datasetId.toString()) ?? null : null
  }));
}

function assertChartOrganization(
  dashboardOrganizationId: mongoose.Types.ObjectId | null | undefined,
  organizationId: string
): void {
  if (!dashboardOrganizationId || dashboardOrganizationId.toString() !== organizationId) {
    throw AppError.forbidden('Access denied: visualization belongs to another organization');
  }
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/** POST /api/v1/visualizations */
export async function createVisualization(
  input: CreateVisualizationInput,
  principal: { userId: string; organizationId: string; roleName?: string },
  meta: AuditRequestMeta = {}
): Promise<VisualizationData> {
  const organizationId = principal.organizationId;

  // 1. Verify dataset access if provided
  if (input.datasetId) {
    const datasetObjectId = toObjectIdSafe(input.datasetId);
    if (!datasetObjectId) {
      throw AppError.badRequest('Invalid Dataset ID');
    }

    const snapshot = await loadDatasetSnapshot(datasetObjectId.toString());
    if (!snapshot) {
      throw AppError.notFound('Dataset');
    }

    await assertResourceWorkspaceAccess(
      snapshot,
      principal.userId,
      organizationId,
      principal.roleName
    );
  }

  // 2. Ensure dashboard container
  let dashboardObjectId: mongoose.Types.ObjectId;
  if (input.dashboardId) {
    const requestedDashboardId = toObjectIdSafe(input.dashboardId);
    if (!requestedDashboardId) {
      throw AppError.badRequest('Invalid Dashboard ID');
    }

    const existingDash = await DashboardModel.findById(requestedDashboardId).lean();
    if (!existingDash) {
      throw AppError.notFound('Dashboard');
    }
    if (existingDash.organizationId.toString() !== organizationId) {
      throw AppError.forbidden('Access denied: dashboard belongs to another organization');
    }
    dashboardObjectId = existingDash._id;
  } else {
    // Auto-link to the default Visualizations Studio dashboard.
    const organizationObjectId = toObjectIdSafe(organizationId);
    const existingDefault = await DashboardModel.findOne({
      ...(organizationObjectId ? { organizationId: organizationObjectId } : {}),
      name: 'Visualizations Studio'
    }).lean();

    if (existingDefault) {
      dashboardObjectId = existingDefault._id;
    } else {
      const ownerId = toObjectIdSafe(principal.userId);
      if (!ownerId) {
        throw AppError.unauthorized('Invalid user context');
      }
      const created = await DashboardModel.create({
        organizationId: organizationObjectId as mongoose.Types.ObjectId,
        ownerId,
        name: 'Visualizations Studio',
        description: 'Default canvas for standalone visualizations',
        status: DASHBOARD_STATUS.DRAFT,
        visibility: DASHBOARD_VISIBILITY.ORGANIZATION
      });
      dashboardObjectId = created._id;
    }
  }

  // 3. Create chart
  const chart = await ChartModel.create({
    dashboardId: dashboardObjectId,
    datasetId: input.datasetId ? toObjectIdSafe(input.datasetId) : null,
    title: input.title,
    description: input.description || null,
    chartType: input.chartType,
    config: input.config as Record<string, unknown>,
    position: input.position as unknown as Record<string, unknown>,
    sortOrder: input.sortOrder ?? 0
  });

  const [created] = await attachDatasets([chart.toObject() as unknown as ChartRow]);

  await logAuditEvent({
    organizationId,
    userId: principal.userId,
    action: 'CHART_CREATED',
    resourceType: 'Chart',
    resourceId: chart._id.toString(),
    metadata: {
      title: chart.title,
      chartType: chart.chartType,
      datasetId: chart.datasetId ? chart.datasetId.toString() : null
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return buildSafeVisualization(created as unknown as VisualizationChartSource);
}

/** GET /api/v1/visualizations */
export async function listVisualizations(
  params: { workspaceId?: string; includeData?: boolean },
  principal: { userId: string; organizationId: string; roleName?: string }
): Promise<VisualizationData[]> {
  const organizationObjectId = toObjectIdSafe(principal.organizationId);
  if (!organizationObjectId) {
    throw AppError.unauthorized('Invalid organization context');
  }

  const dashboardIds = (
    await DashboardModel.find({ organizationId: organizationObjectId }).select('_id').lean()
  ).map((d) => d._id);

  const filter: Record<string, unknown> = {
    dashboardId: { $in: dashboardIds }
  };

  if (params.workspaceId) {
    const workspaceDatasetIds = (
      await DatasetModel.find({ workspaceId: toObjectIdSafe(params.workspaceId) })
        .select('_id')
        .lean()
    ).map((d) => d._id);

    filter.$or = [{ datasetId: { $in: workspaceDatasetIds } }, { datasetId: null }];
  }

  const charts = await attachDatasets(
    (await ChartModel.find(filter).sort({ updatedAt: -1 }).lean()) as unknown as ChartRow[]
  );

  const typedCharts = charts as unknown as Array<VisualizationChartSource>;
  const safeCharts = typedCharts.map((chart) => buildSafeVisualization(chart));

  if (!params.includeData) {
    return safeCharts;
  }

  return Promise.all(
    charts.map(async (chart, index) => {
      const base = safeCharts[index];
      try {
        const queryResult = await executeVisualizationQuery(
          chart,
          principal.userId,
          principal.organizationId,
          principal.roleName
        );
        return {
          ...base,
          data: queryResult.rows,
          columns: queryResult.columns,
          rowCount: queryResult.rowCount,
          total: queryResult.total
        };
      } catch {
        return {
          ...base,
          data: [],
          columns: [],
          rowCount: 0,
          total: 0
        };
      }
    })
  );
}

/** GET /api/v1/visualizations/:id */
export async function getVisualization(
  chartId: string,
  params: { includeData?: boolean },
  principal: { userId: string; organizationId: string; roleName?: string }
): Promise<Record<string, unknown>> {
  const chartObjectId = toObjectIdSafe(chartId);
  if (!chartObjectId) {
    throw AppError.badRequest('Invalid visualization id');
  }

  const chart = await findChartWithTenantContext(chartObjectId);
  if (!chart) {
    throw AppError.notFound('Visualization');
  }

  assertChartOrganization(chart.dashboardOrganizationId, principal.organizationId);

  const populatedChart = chart.chart;

  if (populatedChart.dataset) {
    await assertResourceWorkspaceAccess(
      {
        workspaceId: populatedChart.dataset.workspaceId
          ? populatedChart.dataset.workspaceId.toString()
          : null,
        organizationId: populatedChart.dataset.organizationId.toString()
      },
      principal.userId,
      principal.organizationId,
      principal.roleName
    );
  }

  const safe = buildSafeVisualization(populatedChart);

  if (params.includeData) {
    const queryResult = await executeVisualizationQuery(
      populatedChart,
      principal.userId,
      principal.organizationId,
      principal.roleName
    );
    return {
      ...safe,
      data: queryResult.rows,
      processedRows: queryResult.rows,
      columns: queryResult.columns,
      processedColumns: queryResult.columns,
      rowCount: queryResult.rowCount,
      total: queryResult.total,
      metadata: queryResult.metadata
    };
  }

  return safe as unknown as Record<string, unknown>;
}

/** GET /api/v1/visualizations/:id/data */
export async function getVisualizationData(
  chartId: string,
  principal: { userId: string; organizationId: string; roleName?: string }
): Promise<Record<string, unknown>> {
  const chartObjectId = toObjectIdSafe(chartId);
  if (!chartObjectId) {
    throw AppError.badRequest('Invalid visualization id');
  }

  const chart = await findChartWithTenantContext(chartObjectId);
  if (!chart) {
    throw AppError.notFound('Visualization');
  }

  assertChartOrganization(chart.dashboardOrganizationId, principal.organizationId);

  const populatedChart = chart.chart;

  if (populatedChart.dataset) {
    await assertResourceWorkspaceAccess(
      {
        workspaceId: populatedChart.dataset.workspaceId
          ? populatedChart.dataset.workspaceId.toString()
          : null,
        organizationId: populatedChart.dataset.organizationId.toString()
      },
      principal.userId,
      principal.organizationId,
      principal.roleName
    );
  }

  const queryResult = await executeVisualizationQuery(
    populatedChart,
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  return {
    visualization: buildSafeVisualization(populatedChart),
    ...queryResult
  };
}

/** PATCH /api/v1/visualizations/:id */
export async function updateVisualization(
  chartId: string,
  input: UpdateVisualizationInput,
  principal: { userId: string; organizationId: string; roleName?: string },
  meta: AuditRequestMeta = {}
): Promise<VisualizationData> {
  const chartObjectId = toObjectIdSafe(chartId);
  if (!chartObjectId) {
    throw AppError.badRequest('Invalid visualization id');
  }

  const context = await findChartWithTenantContext(chartObjectId);
  if (!context) {
    throw AppError.notFound('Visualization');
  }

  assertChartOrganization(context.dashboardOrganizationId, principal.organizationId);

  if (input.datasetId !== undefined && input.datasetId !== null) {
    const datasetObjectId = toObjectIdSafe(input.datasetId);
    if (!datasetObjectId) {
      throw AppError.badRequest('Invalid Dataset ID');
    }

    const snapshot = await loadDatasetSnapshot(datasetObjectId.toString());
    if (!snapshot) {
      throw AppError.notFound('Dataset');
    }

    await assertResourceWorkspaceAccess(
      snapshot,
      principal.userId,
      principal.organizationId,
      principal.roleName
    );
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.chartType !== undefined) data.chartType = input.chartType;
  if (input.datasetId !== undefined) {
    data.datasetId = input.datasetId ? toObjectIdSafe(input.datasetId) : null;
  }
  if (input.config !== undefined) data.config = input.config as Record<string, unknown>;
  if (input.position !== undefined) data.position = input.position as Record<string, unknown>;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const updated = await ChartModel.findByIdAndUpdate(chartObjectId, { $set: data }, { new: true })
    .lean()
    .exec();

  if (!updated) {
    throw AppError.notFound('Visualization');
  }

  const [updatedWithDataset] = await attachDatasets([updated as unknown as ChartRow]);

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'CHART_UPDATED',
    resourceType: 'Chart',
    resourceId: chartObjectId.toString(),
    metadata: {
      title: updated.title,
      updatedFields: Object.keys(data)
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return buildSafeVisualization(updatedWithDataset as unknown as VisualizationChartSource);
}

/** DELETE /api/v1/visualizations/:id */
export async function deleteVisualization(
  chartId: string,
  principal: { userId: string; organizationId: string },
  meta: AuditRequestMeta = {}
): Promise<{ message: string }> {
  const chartObjectId = toObjectIdSafe(chartId);
  if (!chartObjectId) {
    throw AppError.badRequest('Invalid visualization id');
  }

  const context = await findChartWithTenantContext(chartObjectId);
  if (!context) {
    throw AppError.notFound('Visualization');
  }

  assertChartOrganization(context.dashboardOrganizationId, principal.organizationId);

  await ChartModel.deleteOne({ _id: chartObjectId }).exec();

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'CHART_DELETED',
    resourceType: 'Chart',
    resourceId: chartObjectId.toString(),
    metadata: { title: context.chart.title },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return { message: 'Visualization deleted successfully' };
}

// ============================================================
// SHARING
// ============================================================

/** POST /api/v1/visualizations/:id/share */
export async function createChartShareLink(
  chartId: string,
  principal: { userId: string; organizationId: string; roleName?: string }
): Promise<{
  shareToken: string | null;
  isPublic: boolean;
  shareTokenActive: boolean;
  sharedAt: string | null;
}> {
  const chartObjectId = toObjectIdSafe(chartId);
  if (!chartObjectId) {
    throw AppError.notFound(`Chart with ID "${chartId}" not found`);
  }

  const chart = await ChartModel.findById(chartObjectId)
    .populate<{
      dashboardId: { organizationId: mongoose.Types.ObjectId; layoutConfig: unknown };
    }>(
      'dashboardId',
      'organizationId layoutConfig'
    )
    .exec();

  const dashboard = chart?.dashboardId as unknown as {
    organizationId: mongoose.Types.ObjectId;
    layoutConfig: unknown;
  } | null;
  if (!chart || !dashboard || dashboard.organizationId.toString() !== principal.organizationId) {
    throw AppError.notFound(`Chart with ID "${chartId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await assertResourceWorkspaceAccess(
    { workspaceId, organizationId: principal.organizationId },
    principal.userId,
    principal.organizationId,
    principal.roleName,
    'WRITE'
  );

  const shareToken = chart.shareToken || randomBytes(24).toString('hex');
  const sharedAt = new Date();

  await ChartModel.updateOne(
    { _id: chart._id },
    {
      $set: {
        shareToken,
        shareTokenActive: true,
        isPublic: true,
        sharedAt
      }
    }
  ).exec();

  await logAuditEvent({
    userId: principal.userId,
    organizationId: principal.organizationId,
    workspaceId,
    action: 'CHART_SHARED',
    resourceType: 'CHART',
    resourceId: chart._id.toString(),
    metadata: { shareToken }
  });

  return {
    shareToken,
    isPublic: true,
    shareTokenActive: true,
    sharedAt: sharedAt.toISOString()
  };
}

/** DELETE /api/v1/visualizations/:id/share */
export async function revokeChartShareLink(
  chartId: string,
  principal: { userId: string; organizationId: string; roleName?: string }
): Promise<{ message: string }> {
  const chartObjectId = toObjectIdSafe(chartId);
  if (!chartObjectId) {
    throw AppError.notFound(`Chart with ID "${chartId}" not found`);
  }

  const chart = await ChartModel.findById(chartObjectId)
    .populate<{
      dashboardId: { organizationId: mongoose.Types.ObjectId; layoutConfig: unknown };
    }>(
      'dashboardId',
      'organizationId layoutConfig'
    )
    .exec();

  const dashboard = chart?.dashboardId as unknown as {
    organizationId: mongoose.Types.ObjectId;
    layoutConfig: unknown;
  } | null;
  if (!chart || !dashboard || dashboard.organizationId.toString() !== principal.organizationId) {
    throw AppError.notFound(`Chart with ID "${chartId}" not found`);
  }

  const workspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  await assertResourceWorkspaceAccess(
    { workspaceId, organizationId: principal.organizationId },
    principal.userId,
    principal.organizationId,
    principal.roleName,
    'WRITE'
  );

  await ChartModel.updateOne(
    { _id: chart._id },
    { $set: { shareTokenActive: false, isPublic: false } }
  ).exec();

  await logAuditEvent({
    userId: principal.userId,
    organizationId: principal.organizationId,
    workspaceId,
    action: 'CHART_SHARE_REVOKED',
    resourceType: 'CHART',
    resourceId: chart._id.toString()
  });

  return { message: 'Chart share link revoked' };
}

/** GET /api/v1/visualizations/shared/:shareToken (public) */
export async function getSharedChartByToken(shareToken: string): Promise<Record<string, unknown>> {
  const chart = await ChartModel.findOne({ shareToken, shareTokenActive: true, isPublic: true }).lean();

  if (!chart) {
    throw AppError.notFound('Shared chart not found or share link has been revoked');
  }

  let dataset: { id: string; name: string } | null = null;
  if (chart.datasetId) {
    const found = await DatasetModel.findById(chart.datasetId).select('name').lean();
    dataset = found ? { id: found._id.toString(), name: found.name } : null;
  }

  return {
    id: chart._id.toString(),
    title: chart.title,
    description: chart.description,
    chartType: chart.chartType,
    config: readSchemaMeta(chart.config),
    dataset,
    sharedAt: chart.sharedAt ? chart.sharedAt.toISOString() : null
  };
}

/** POST /api/v1/visualizations/shared/:shareToken/data (public) */
export async function getSharedChartDataByToken(shareToken: string): Promise<DatasetQueryResult> {
  const chart = await ChartModel.findOne({ shareToken, shareTokenActive: true, isPublic: true })
    .lean();

  if (!chart || !chart.datasetId) {
    throw AppError.notFound('Shared chart data not available');
  }

  const snapshot = await loadDatasetSnapshot(chart.datasetId.toString());
  if (!snapshot) {
    throw AppError.notFound('Shared chart data not available');
  }

  return executeLocalDatasetQuery(snapshot, { limit: 1000, offset: 0 });
}