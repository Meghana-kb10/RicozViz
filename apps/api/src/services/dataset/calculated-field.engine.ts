// ========================================
// Safe Expression Parser & Evaluator for Calculated Fields
// ========================================
// Evaluates mathematical, string, and logical expressions safely.
// Strictly enforces an allowlist of operators and functions.
// ZERO arbitrary code execution (NO eval, NO Function constructor).
// Safe division by zero (returns null, never crashes).
// ========================================

export type CalculatedFieldDataType = "NUMBER" | "STRING" | "BOOLEAN";

export const ALLOWED_CALCULATED_FUNCTIONS = [
  "SUM",
  "ABS",
  "ROUND",
  "LOWER",
  "UPPER",
  "TRIM",
] as const;

export type CalculatedFunction = (typeof ALLOWED_CALCULATED_FUNCTIONS)[number];

export const ALLOWED_OPERATORS = [
  "+",
  "-",
  "*",
  "/",
  "%",
  ">",
  "<",
  ">=",
  "<=",
  "==",
  "!=",
  "=",
  "AND",
  "OR",
  "&&",
  "||",
] as const;

// ============================================================
// TOKEN DEFINITIONS
// ============================================================

export type TokenType =
  | "NUMBER"
  | "STRING"
  | "IDENTIFIER"
  | "OPERATOR"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string | number;
  pos: number;
}

// ============================================================
// AST NODE DEFINITIONS
// ============================================================

export type ASTNode =
  | LiteralNode
  | IdentifierNode
  | BinaryNode
  | UnaryNode
  | FunctionCallNode;

export interface LiteralNode {
  type: "Literal";
  value: number | string | boolean | null;
  dataType: CalculatedFieldDataType;
}

export interface IdentifierNode {
  type: "Identifier";
  name: string;
}

export interface BinaryNode {
  type: "Binary";
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryNode {
  type: "Unary";
  operator: string;
  argument: ASTNode;
}

export interface FunctionCallNode {
  type: "FunctionCall";
  name: CalculatedFunction;
  args: ASTNode[];
}

// ============================================================
// TOKENIZER / LEXER
// ============================================================

export class Tokenizer {
  private pos = 0;
  private length: number;

  constructor(private input: string) {
    this.length = input.length;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.length) {
      const ch = this.input[this.pos];
      if (!ch) break;

      // Skip whitespace
      if (/\s/.test(ch)) {
        this.pos++;
        continue;
      }

      // Numbers (e.g. 123, 45.67)
      const nextChar = this.input[this.pos + 1] || "";
      if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(nextChar))) {
        tokens.push(this.readNumber());
        continue;
      }

      // Strings ('single' or "double" quotes)
      if (ch === "'" || ch === '"') {
        tokens.push(this.readString(ch));
        continue;
      }

      // Bracketed identifier [Column Name]
      if (ch === "[") {
        tokens.push(this.readBracketedIdentifier());
        continue;
      }

      // Parentheses & Comma
      if (ch === "(") {
        tokens.push({ type: "LPAREN", value: "(", pos: this.pos++ });
        continue;
      }
      if (ch === ")") {
        tokens.push({ type: "RPAREN", value: ")", pos: this.pos++ });
        continue;
      }
      if (ch === ",") {
        tokens.push({ type: "COMMA", value: ",", pos: this.pos++ });
        continue;
      }

      // Multi-character and single-character operators
      const twoChar = this.input.slice(this.pos, this.pos + 2);
      if (["==", "!=", ">=", "<=", "&&", "||"].includes(twoChar)) {
        tokens.push({ type: "OPERATOR", value: twoChar, pos: this.pos });
        this.pos += 2;
        continue;
      }

      if (["+", "-", "*", "/", "%", ">", "<", "="].includes(ch)) {
        tokens.push({ type: "OPERATOR", value: ch, pos: this.pos++ });
        continue;
      }

      // Identifiers & Word Operators (e.g. revenue, AND, OR, UPPER)
      if (/[a-zA-Z_]/.test(ch)) {
        const token = this.readIdentifier();
        const upper = String(token.value).toUpperCase();
        if (upper === "AND" || upper === "OR") {
          tokens.push({ type: "OPERATOR", value: upper, pos: token.pos });
        } else {
          tokens.push(token);
        }
        continue;
      }

      throw new Error(`Unexpected character '${ch}' at position ${this.pos}`);
    }

    tokens.push({ type: "EOF", value: "", pos: this.pos });
    return tokens;
  }

  private readNumber(): Token {
    const start = this.pos;
    let hasDot = false;

    while (this.pos < this.length) {
      const ch = this.input[this.pos];
      if (!ch) break;
      if (/[0-9]/.test(ch)) {
        this.pos++;
      } else if (ch === "." && !hasDot) {
        hasDot = true;
        this.pos++;
      } else {
        break;
      }
    }

    const numStr = this.input.slice(start, this.pos);
    const value = parseFloat(numStr);
    if (isNaN(value)) {
      throw new Error(`Invalid number literal '${numStr}' at position ${start}`);
    }
    return { type: "NUMBER", value, pos: start };
  }

  private readString(quote: string): Token {
    const start = this.pos;
    this.pos++; // skip opening quote
    let str = "";

    while (this.pos < this.length) {
      const ch = this.input[this.pos];
      if (!ch) break;
      if (ch === "\\") {
        this.pos++;
        if (this.pos < this.length) {
          str += this.input[this.pos++];
        }
        continue;
      }
      if (ch === quote) {
        this.pos++; // skip closing quote
        return { type: "STRING", value: str, pos: start };
      }
      str += ch;
      this.pos++;
    }

    throw new Error(`Unterminated string starting at position ${start}`);
  }

  private readBracketedIdentifier(): Token {
    const start = this.pos;
    this.pos++; // skip '['
    let name = "";

    while (this.pos < this.length) {
      const ch = this.input[this.pos];
      if (!ch) break;
      if (ch === "]") {
        this.pos++;
        return { type: "IDENTIFIER", value: name.trim(), pos: start };
      }
      name += ch;
      this.pos++;
    }

    throw new Error(`Unterminated bracketed identifier starting at position ${start}`);
  }

  private readIdentifier(): Token {
    const start = this.pos;
    while (this.pos < this.length) {
      const ch = this.input[this.pos];
      if (!ch || !/[a-zA-Z0-9_]/.test(ch)) break;
      this.pos++;
    }
    const val = this.input.slice(start, this.pos);
    return { type: "IDENTIFIER", value: val, pos: start };
  }
}

// ============================================================
// RECURSIVE DESCENT PARSER
// ============================================================

export class ExpressionParser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ASTNode {
    if (this.peek().type === "EOF") {
      throw new Error("Empty expression");
    }
    const node = this.parseLogicalOr();
    if (this.peek().type !== "EOF") {
      throw new Error(`Unexpected token '${this.peek().value}' after valid expression`);
    }
    return node;
  }

  private parseLogicalOr(): ASTNode {
    let left = this.parseLogicalAnd();

    while (this.matchOperator("OR", "||")) {
      const op = "OR";
      const right = this.parseLogicalAnd();
      left = { type: "Binary", operator: op, left, right };
    }

    return left;
  }

  private parseLogicalAnd(): ASTNode {
    let left = this.parseComparison();

    while (this.matchOperator("AND", "&&")) {
      const op = "AND";
      const right = this.parseComparison();
      left = { type: "Binary", operator: op, left, right };
    }

    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdditive();

    while (this.matchOperator("==", "!=", ">=", "<=", ">", "<", "=")) {
      let op = String(this.previous().value);
      if (op === "=") op = "==";
      const right = this.parseAdditive();
      left = { type: "Binary", operator: op, left, right };
    }

    return left;
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();

    while (this.matchOperator("+", "-")) {
      const op = String(this.previous().value);
      const right = this.parseMultiplicative();
      left = { type: "Binary", operator: op, left, right };
    }

    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary();

    while (this.matchOperator("*", "/", "%")) {
      const op = String(this.previous().value);
      const right = this.parseUnary();
      left = { type: "Binary", operator: op, left, right };
    }

    return left;
  }

  private parseUnary(): ASTNode {
    if (this.matchOperator("-", "+")) {
      const op = String(this.previous().value);
      const argument = this.parseUnary();
      return { type: "Unary", operator: op, argument };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();

    // Numeric literal
    if (token.type === "NUMBER") {
      this.advance();
      return { type: "Literal", value: Number(token.value), dataType: "NUMBER" };
    }

    // String literal
    if (token.type === "STRING") {
      this.advance();
      return { type: "Literal", value: String(token.value), dataType: "STRING" };
    }

    // Grouping: '(' expression ')'
    if (token.type === "LPAREN") {
      this.advance();
      const expr = this.parseLogicalOr();
      if (this.peek().type !== "RPAREN") {
        throw new Error("Missing closing parenthesis ')'");
      }
      this.advance();
      return expr;
    }

    // Identifier or Function call
    if (token.type === "IDENTIFIER") {
      this.advance();
      const name = String(token.value);

      // Check if followed by '(' -> Function call
      if (this.peek().type === "LPAREN") {
        const upperFn = name.toUpperCase() as CalculatedFunction;
        if (!ALLOWED_CALCULATED_FUNCTIONS.includes(upperFn)) {
          throw new Error(
            `Function '${name}' is not supported. Supported functions: ${ALLOWED_CALCULATED_FUNCTIONS.join(", ")}`
          );
        }

        this.advance(); // consume '('
        const args: ASTNode[] = [];

        if (this.peek().type !== "RPAREN") {
          args.push(this.parseLogicalOr());
          while (this.peek().type === "COMMA") {
            this.advance(); // consume ','
            args.push(this.parseLogicalOr());
          }
        }

        if (this.peek().type !== "RPAREN") {
          throw new Error(`Missing closing parenthesis ')' for function '${name}'`);
        }
        this.advance(); // consume ')'

        return { type: "FunctionCall", name: upperFn, args };
      }

      // Plain column identifier
      return { type: "Identifier", name };
    }

    throw new Error(`Unexpected token '${token.value || token.type}' at position ${token.pos}`);
  }

  private matchOperator(...ops: string[]): boolean {
    const token = this.peek();
    if (token.type === "OPERATOR" && ops.includes(String(token.value).toUpperCase())) {
      this.advance();
      return true;
    }
    return false;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: "EOF", value: "", pos: 0 };
  }

  private previous(): Token {
    return this.tokens[this.current - 1] || { type: "EOF", value: "", pos: 0 };
  }

  private advance(): Token {
    if (this.current < this.tokens.length) {
      this.current++;
    }
    return this.previous();
  }
}

// ============================================================
// SAFE EXPRESSION EVALUATOR
// ============================================================

export function evaluateExpression(node: ASTNode, row: Record<string, unknown>): unknown {
  switch (node.type) {
    case "Literal":
      return node.value;

    case "Identifier": {
      // Look up column case-insensitively if exact match isn't present
      if (node.name in row) {
        return row[node.name];
      }
      const lowerKey = node.name.toLowerCase();
      for (const [k, v] of Object.entries(row)) {
        if (k.toLowerCase() === lowerKey) {
          return v;
        }
      }
      return null;
    }

    case "Unary": {
      const val = evaluateExpression(node.argument, row);
      if (val === null || val === undefined) return null;
      if (node.operator === "-") {
        const num = Number(val);
        return isNaN(num) ? null : -num;
      }
      if (node.operator === "+") {
        const num = Number(val);
        return isNaN(num) ? null : +num;
      }
      return null;
    }

    case "Binary": {
      const leftVal = evaluateExpression(node.left, row);
      const rightVal = evaluateExpression(node.right, row);

      // Logical OR: short-circuiting
      if (node.operator === "OR") {
        return Boolean(leftVal) || Boolean(rightVal);
      }
      // Logical AND
      if (node.operator === "AND") {
        return Boolean(leftVal) && Boolean(rightVal);
      }

      // Comparison operators
      if (["==", "!=", ">", "<", ">=", "<="].includes(node.operator)) {
        if (leftVal === null || rightVal === null || leftVal === undefined || rightVal === undefined) {
          if (node.operator === "==") return leftVal === rightVal;
          if (node.operator === "!=") return leftVal !== rightVal;
          return false;
        }

        const leftNum = Number(leftVal);
        const rightNum = Number(rightVal);
        const isNumeric = !isNaN(leftNum) && !isNaN(rightNum);

        if (isNumeric) {
          switch (node.operator) {
            case "==": return leftNum === rightNum;
            case "!=": return leftNum !== rightNum;
            case ">": return leftNum > rightNum;
            case "<": return leftNum < rightNum;
            case ">=": return leftNum >= rightNum;
            case "<=": return leftNum <= rightNum;
          }
        } else {
          const lStr = String(leftVal);
          const rStr = String(rightVal);
          switch (node.operator) {
            case "==": return lStr === rStr;
            case "!=": return lStr !== rStr;
            case ">": return lStr > rStr;
            case "<": return lStr < rStr;
            case ">=": return lStr >= rStr;
            case "<=": return lStr <= rStr;
          }
        }
        return false;
      }

      // Arithmetic: if either side is null/undefined -> return null
      if (leftVal === null || rightVal === null || leftVal === undefined || rightVal === undefined) {
        return null;
      }

      // String concatenation with '+'
      if (node.operator === "+") {
        if (typeof leftVal === "string" || typeof rightVal === "string") {
          return `${String(leftVal)}${String(rightVal)}`;
        }
      }

      const lNum = Number(leftVal);
      const rNum = Number(rightVal);
      if (isNaN(lNum) || isNaN(rNum)) {
        return null;
      }

      switch (node.operator) {
        case "+":
          return lNum + rNum;
        case "-":
          return lNum - rNum;
        case "*":
          return lNum * rNum;
        case "/":
          // SAFE DIVISION BY ZERO: Return null, NEVER throw!
          if (rNum === 0 || !isFinite(rNum)) return null;
          return lNum / rNum;
        case "%":
          if (rNum === 0) return null;
          return lNum % rNum;
        default:
          return null;
      }
    }

    case "FunctionCall": {
      const evaluatedArgs = node.args.map((a) => evaluateExpression(a, row));

      switch (node.name) {
        case "SUM": {
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

        case "ABS": {
          const arg = evaluatedArgs[0];
          if (arg === null || arg === undefined) return null;
          const n = Number(arg);
          return isNaN(n) ? null : Math.abs(n);
        }

        case "ROUND": {
          const val = evaluatedArgs[0];
          if (val === null || val === undefined) return null;
          const n = Number(val);
          if (isNaN(n)) return null;
          const decimals = evaluatedArgs[1] !== undefined ? Number(evaluatedArgs[1]) : 0;
          const factor = Math.pow(10, Math.max(0, Math.min(10, isNaN(decimals) ? 0 : decimals)));
          return Math.round(n * factor) / factor;
        }

        case "LOWER": {
          const val = evaluatedArgs[0];
          if (val === null || val === undefined) return null;
          return String(val).toLowerCase();
        }

        case "UPPER": {
          const val = evaluatedArgs[0];
          if (val === null || val === undefined) return null;
          return String(val).toUpperCase();
        }

        case "TRIM": {
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

// ============================================================
// AST ANALYSIS & VALIDATION UTILITIES
// ============================================================

export function extractReferencedColumns(node: ASTNode): string[] {
  const columns = new Set<string>();

  function traverse(n: ASTNode) {
    if (n.type === "Identifier") {
      columns.add(n.name);
    } else if (n.type === "Binary") {
      traverse(n.left);
      traverse(n.right);
    } else if (n.type === "Unary") {
      traverse(n.argument);
    } else if (n.type === "FunctionCall") {
      for (const a of n.args) {
        traverse(a);
      }
    }
  }

  traverse(node);
  return Array.from(columns);
}

export function inferExpressionType(
  node: ASTNode,
  columnTypeMap: Map<string, string>
): CalculatedFieldDataType {
  switch (node.type) {
    case "Literal":
      return node.dataType;

    case "Identifier": {
      const type = (columnTypeMap.get(node.name) || columnTypeMap.get(node.name.toLowerCase()) || "string").toUpperCase();
      if (type.includes("INT") || type.includes("NUM") || type.includes("FLOAT") || type.includes("DECIMAL")) {
        return "NUMBER";
      }
      if (type.includes("BOOL")) {
        return "BOOLEAN";
      }
      return "STRING";
    }

    case "Unary":
      return "NUMBER";

    case "Binary": {
      if (["==", "!=", ">", "<", ">=", "<=", "AND", "OR"].includes(node.operator)) {
        return "BOOLEAN";
      }
      const leftType = inferExpressionType(node.left, columnTypeMap);
      const rightType = inferExpressionType(node.right, columnTypeMap);
      if (node.operator === "+") {
        if (leftType === "STRING" || rightType === "STRING") {
          return "STRING";
        }
      }
      return "NUMBER";
    }

    case "FunctionCall": {
      if (["LOWER", "UPPER", "TRIM"].includes(node.name)) {
        return "STRING";
      }
      return "NUMBER";
    }
  }
}

/**
 * Validates and compiles a calculated field expression.
 * Returns the parsed AST, list of referenced columns, and inferred data type.
 */
export function compileCalculatedField(
  expression: string,
  knownColumns: Array<{ name: string; type: string }>
): {
  ast: ASTNode;
  referencedColumns: string[];
  dataType: CalculatedFieldDataType;
} {
  if (!expression || typeof expression !== "string" || expression.trim().length === 0) {
    throw new Error("Expression cannot be empty");
  }

  if (expression.length > 500) {
    throw new Error("Expression exceeds maximum length of 500 characters");
  }

  // Check for prohibited dangerous keywords
  const lower = expression.toLowerCase();
  const prohibited = [
    "eval",
    "function",
    "constructor",
    "prototype",
    "__proto__",
    "window",
    "global",
    "process",
    "require",
    "import",
    "script",
    "document",
    "select",
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "table",
  ];
  for (const word of prohibited) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(lower)) {
      throw new Error(`Prohibited keyword or identifier '${word}' is not allowed in expressions`);
    }
  }

  const tokenizer = new Tokenizer(expression);
  const tokens = tokenizer.tokenize();
  const parser = new ExpressionParser(tokens);
  const ast = parser.parse();

  const referencedColumns = extractReferencedColumns(ast);
  const colMap = new Map<string, string>();
  for (const c of knownColumns) {
    colMap.set(c.name, c.type);
    colMap.set(c.name.toLowerCase(), c.type);
  }

  // Validate that all referenced columns exist
  for (const col of referencedColumns) {
    if (!colMap.has(col) && !colMap.has(col.toLowerCase())) {
      throw new Error(`Referenced column '${col}' does not exist in dataset schema`);
    }
  }

  const dataType = inferExpressionType(ast, colMap);

  return {
    ast,
    referencedColumns,
    dataType,
  };
}
