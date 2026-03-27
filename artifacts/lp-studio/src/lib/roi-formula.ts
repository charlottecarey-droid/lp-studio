const ALLOWED_FUNCS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  sqrt: Math.sqrt,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};

const NUMBER_RE = /^\d+(\.\d+)?$/;

type Token =
  | { kind: "num"; val: number }
  | { kind: "id"; name: string }
  | { kind: "op"; val: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" }
  | { kind: "func"; name: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/\d/.test(ch) || (ch === "." && /\d/.test(src[i + 1] ?? ""))) {
      let num = "";
      while (i < src.length && /[\d.]/.test(src[i])) num += src[i++];
      tokens.push({ kind: "num", val: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = "";
      while (i < src.length && /[\w]/.test(src[i])) id += src[i++];
      if (ALLOWED_FUNCS[id]) {
        tokens.push({ kind: "func", name: id });
      } else {
        tokens.push({ kind: "id", name: id });
      }
      continue;
    }
    if ("+-*/%^".includes(ch)) { tokens.push({ kind: "op", val: ch }); i++; continue; }
    if (ch === "(") { tokens.push({ kind: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ kind: "rparen" }); i++; continue; }
    if (ch === ",") { tokens.push({ kind: "comma" }); i++; continue; }
    i++;
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[], private vars: Record<string, number>) {}

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }
  private expect(kind: Token["kind"]): Token {
    const t = this.consume();
    if (t.kind !== kind) throw new Error(`Expected ${kind}, got ${t.kind}`);
    return t;
  }

  parse(): number {
    const val = this.parseExpr();
    if (this.pos < this.tokens.length) throw new Error("Unexpected tokens");
    return val;
  }

  parseExpr(): number { return this.parseAddSub(); }

  parseAddSub(): number {
    let left = this.parseMulDiv();
    while (this.peek()?.kind === "op" && (this.peek()?.val === "+" || this.peek()?.val === "-")) {
      const op = (this.consume() as { kind: "op"; val: string }).val;
      const right = this.parseMulDiv();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  parseMulDiv(): number {
    let left = this.parseUnary();
    while (this.peek()?.kind === "op" && (this.peek()?.val === "*" || this.peek()?.val === "/" || this.peek()?.val === "%")) {
      const op = (this.consume() as { kind: "op"; val: string }).val;
      const right = this.parseUnary();
      if (op === "*") left = left * right;
      else if (op === "/") left = right !== 0 ? left / right : 0;
      else left = left % right;
    }
    return left;
  }

  parseUnary(): number {
    if (this.peek()?.kind === "op" && this.peek()?.val === "-") {
      this.consume();
      return -this.parsePrimary();
    }
    return this.parsePrimary();
  }

  parsePrimary(): number {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of expression");

    if (t.kind === "num") {
      this.consume();
      return t.val;
    }
    if (t.kind === "id") {
      this.consume();
      const val = this.vars[t.name];
      if (val === undefined) throw new Error(`Unknown variable: ${t.name}`);
      return val;
    }
    if (t.kind === "func") {
      this.consume();
      this.expect("lparen");
      const args: number[] = [this.parseExpr()];
      while (this.peek()?.kind === "comma") {
        this.consume();
        args.push(this.parseExpr());
      }
      this.expect("rparen");
      const fn = ALLOWED_FUNCS[t.name];
      return fn(...args);
    }
    if (t.kind === "lparen") {
      this.consume();
      const val = this.parseExpr();
      this.expect("rparen");
      return val;
    }
    throw new Error(`Unexpected token: ${t.kind}`);
  }
}

export function evalFormula(formula: string, vars: Record<string, number>): number {
  try {
    const tokens = tokenize(formula);
    const parser = new Parser(tokens, vars);
    const result = parser.parse();
    return isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

export function toVarName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "_$1");
}
