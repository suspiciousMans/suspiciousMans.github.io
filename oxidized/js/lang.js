// Oxidized language runtime: lexer, parser, and tree-walking interpreter.
// Toy language, deliberately small — enough to write fib/fizzbuzz/loops and
// see them actually execute in the browser, nothing more.
(function (global) {
    "use strict";

    class OxError extends Error {}

    const KEYWORDS = new Set(["let", "print", "if", "else", "while", "for", "in", "fn", "return", "true", "false"]);

    function lex(src) {
        const tokens = [];
        let i = 0;
        let line = 1;
        const n = src.length;

        function peek(o = 0) {
            return src[i + o];
        }

        while (i < n) {
            const c = src[i];

            if (c === "\n") {
                line++;
                i++;
                continue;
            }
            if (c === " " || c === "\t" || c === "\r") {
                i++;
                continue;
            }
            if (c === "/" && peek(1) === "/") {
                while (i < n && src[i] !== "\n") i++;
                continue;
            }

            if (c === '"') {
                let start = ++i;
                let value = "";
                while (i < n && src[i] !== '"') {
                    if (src[i] === "\\" && i + 1 < n) {
                        const esc = src[i + 1];
                        if (esc === "n") value += "\n";
                        else if (esc === "t") value += "\t";
                        else if (esc === '"') value += '"';
                        else if (esc === "\\") value += "\\";
                        else value += esc;
                        i += 2;
                    } else {
                        value += src[i];
                        i++;
                    }
                }
                if (i >= n) throw new OxError(`line ${line}: unterminated string`);
                i++; // closing quote
                tokens.push({ type: "STRING", value, line });
                continue;
            }

            if (/[0-9]/.test(c)) {
                let start = i;
                while (i < n && /[0-9]/.test(src[i])) i++;
                if (src[i] === "." && /[0-9]/.test(src[i + 1] || "")) {
                    i++;
                    while (i < n && /[0-9]/.test(src[i])) i++;
                }
                tokens.push({ type: "NUMBER", value: parseFloat(src.slice(start, i)), line });
                continue;
            }

            if (/[A-Za-z_]/.test(c)) {
                let start = i;
                while (i < n && /[A-Za-z0-9_]/.test(src[i])) i++;
                const word = src.slice(start, i);
                if (KEYWORDS.has(word)) tokens.push({ type: word.toUpperCase(), value: word, line });
                else tokens.push({ type: "IDENT", value: word, line });
                continue;
            }

            // Two-char operators before their one-char prefixes.
            const two = src.slice(i, i + 2);
            if (["==", "!=", "<=", ">=", "&&", "||", ".."].includes(two)) {
                tokens.push({ type: two, value: two, line });
                i += 2;
                continue;
            }

            if ("+-*/%=<>!(){};,".includes(c)) {
                tokens.push({ type: c, value: c, line });
                i++;
                continue;
            }

            throw new OxError(`line ${line}: unexpected character '${c}'`);
        }

        tokens.push({ type: "EOF", value: null, line });
        return tokens;
    }

    class Parser {
        constructor(tokens) {
            this.tokens = tokens;
            this.pos = 0;
        }

        peek(o = 0) {
            return this.tokens[this.pos + o];
        }

        at(type) {
            return this.peek().type === type;
        }

        advance() {
            return this.tokens[this.pos++];
        }

        expect(type) {
            if (!this.at(type)) {
                const t = this.peek();
                throw new OxError(`line ${t.line}: expected '${type}' but found '${t.value ?? t.type}'`);
            }
            return this.advance();
        }

        parseProgram() {
            const stmts = [];
            while (!this.at("EOF")) stmts.push(this.parseStmt());
            return stmts;
        }

        parseBlock() {
            this.expect("{");
            const stmts = [];
            while (!this.at("}")) stmts.push(this.parseStmt());
            this.expect("}");
            return stmts;
        }

        parseStmt() {
            if (this.at("LET")) return this.parseLet();
            if (this.at("PRINT")) return this.parsePrint();
            if (this.at("IF")) return this.parseIf();
            if (this.at("WHILE")) return this.parseWhile();
            if (this.at("FOR")) return this.parseFor();
            if (this.at("FN")) return this.parseFn();
            if (this.at("RETURN")) return this.parseReturn();

            if (this.at("IDENT") && this.peek(1).type === "=") {
                const name = this.advance().value;
                this.advance(); // '='
                const value = this.parseExpr();
                this.expect(";");
                return { type: "Assign", name, value };
            }

            const expr = this.parseExpr();
            this.expect(";");
            return { type: "ExprStmt", expr };
        }

        parseLet() {
            this.advance();
            const name = this.expect("IDENT").value;
            this.expect("=");
            const value = this.parseExpr();
            this.expect(";");
            return { type: "Let", name, value };
        }

        parsePrint() {
            this.advance();
            this.expect("(");
            const expr = this.parseExpr();
            this.expect(")");
            this.expect(";");
            return { type: "Print", expr };
        }

        parseIf() {
            this.advance();
            this.expect("(");
            const cond = this.parseExpr();
            this.expect(")");
            const then = this.parseBlock();
            let els = null;
            if (this.at("ELSE")) {
                this.advance();
                els = this.at("IF") ? [this.parseIf()] : this.parseBlock();
            }
            return { type: "If", cond, then, els };
        }

        parseWhile() {
            this.advance();
            this.expect("(");
            const cond = this.parseExpr();
            this.expect(")");
            const body = this.parseBlock();
            return { type: "While", cond, body };
        }

        parseFor() {
            this.advance();
            const name = this.expect("IDENT").value;
            this.expect("IN");
            const from = this.parseExpr();
            this.expect("..");
            const to = this.parseExpr();
            const body = this.parseBlock();
            return { type: "For", name, from, to, body };
        }

        parseFn() {
            this.advance();
            const name = this.expect("IDENT").value;
            this.expect("(");
            const params = [];
            if (!this.at(")")) {
                params.push(this.expect("IDENT").value);
                while (this.at(",")) {
                    this.advance();
                    params.push(this.expect("IDENT").value);
                }
            }
            this.expect(")");
            const body = this.parseBlock();
            return { type: "Fn", name, params, body };
        }

        parseReturn() {
            this.advance();
            let value = null;
            if (!this.at(";")) value = this.parseExpr();
            this.expect(";");
            return { type: "Return", value };
        }

        parseExpr() {
            return this.parseOr();
        }

        parseOr() {
            let left = this.parseAnd();
            while (this.at("||")) {
                this.advance();
                left = { type: "Logical", op: "||", left, right: this.parseAnd() };
            }
            return left;
        }

        parseAnd() {
            let left = this.parseEquality();
            while (this.at("&&")) {
                this.advance();
                left = { type: "Logical", op: "&&", left, right: this.parseEquality() };
            }
            return left;
        }

        parseEquality() {
            let left = this.parseRelational();
            while (this.at("==") || this.at("!=")) {
                const op = this.advance().type;
                left = { type: "Binary", op, left, right: this.parseRelational() };
            }
            return left;
        }

        parseRelational() {
            let left = this.parseAdditive();
            while (this.at("<") || this.at(">") || this.at("<=") || this.at(">=")) {
                const op = this.advance().type;
                left = { type: "Binary", op, left, right: this.parseAdditive() };
            }
            return left;
        }

        parseAdditive() {
            let left = this.parseMultiplicative();
            while (this.at("+") || this.at("-")) {
                const op = this.advance().type;
                left = { type: "Binary", op, left, right: this.parseMultiplicative() };
            }
            return left;
        }

        parseMultiplicative() {
            let left = this.parseUnary();
            while (this.at("*") || this.at("/") || this.at("%")) {
                const op = this.advance().type;
                left = { type: "Binary", op, left, right: this.parseUnary() };
            }
            return left;
        }

        parseUnary() {
            if (this.at("!") || this.at("-")) {
                const op = this.advance().type;
                return { type: "Unary", op, value: this.parseUnary() };
            }
            return this.parseCall();
        }

        parseCall() {
            let expr = this.parsePrimary();
            while (this.at("(")) {
                this.advance();
                const args = [];
                if (!this.at(")")) {
                    args.push(this.parseExpr());
                    while (this.at(",")) {
                        this.advance();
                        args.push(this.parseExpr());
                    }
                }
                this.expect(")");
                expr = { type: "Call", callee: expr, args };
            }
            return expr;
        }

        parsePrimary() {
            const t = this.peek();
            if (t.type === "NUMBER") {
                this.advance();
                return { type: "Number", value: t.value };
            }
            if (t.type === "STRING") {
                this.advance();
                return { type: "String", value: t.value };
            }
            if (t.type === "TRUE" || t.type === "FALSE") {
                this.advance();
                return { type: "Bool", value: t.type === "TRUE" };
            }
            if (t.type === "IDENT") {
                this.advance();
                return { type: "Var", name: t.value };
            }
            if (t.type === "(") {
                this.advance();
                const e = this.parseExpr();
                this.expect(")");
                return e;
            }
            throw new OxError(`line ${t.line}: unexpected token '${t.value ?? t.type}'`);
        }
    }

    class Env {
        constructor(parent = null) {
            this.vars = new Map();
            this.parent = parent;
        }
        define(name, value) {
            this.vars.set(name, value);
        }
        get(name) {
            if (this.vars.has(name)) return this.vars.get(name);
            if (this.parent) return this.parent.get(name);
            throw new OxError(`undefined variable '${name}'`);
        }
        set(name, value) {
            if (this.vars.has(name)) {
                this.vars.set(name, value);
                return;
            }
            if (this.parent) {
                this.parent.set(name, value);
                return;
            }
            throw new OxError(`cannot assign to undefined variable '${name}'`);
        }
    }

    class ReturnSignal {
        constructor(value) {
            this.value = value;
        }
    }

    const MAX_STEPS = 300000;

    function truthy(v) {
        return v !== false && v !== 0 && v !== "" && v !== null;
    }

    function formatValue(v) {
        if (v === null) return "nil";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "function" || (v && v.type === "function")) return `<fn ${v.name || "anonymous"}>`;
        return String(v);
    }

    class Interpreter {
        constructor(onPrint) {
            this.onPrint = onPrint;
            this.global = new Env();
            this.steps = 0;
        }

        tick() {
            this.steps++;
            if (this.steps > MAX_STEPS) {
                throw new OxError("execution limit exceeded — likely an infinite loop or unbounded recursion");
            }
        }

        run(program) {
            this.execBlock(program, this.global);
        }

        execBlock(stmts, env) {
            for (const stmt of stmts) this.execStmt(stmt, env);
        }

        execStmt(stmt, env) {
            this.tick();
            switch (stmt.type) {
                case "Let":
                    env.define(stmt.name, this.evalExpr(stmt.value, env));
                    return;
                case "Assign":
                    env.set(stmt.name, this.evalExpr(stmt.value, env));
                    return;
                case "Print":
                    this.onPrint(formatValue(this.evalExpr(stmt.expr, env)));
                    return;
                case "ExprStmt":
                    this.evalExpr(stmt.expr, env);
                    return;
                case "If":
                    if (truthy(this.evalExpr(stmt.cond, env))) {
                        this.execBlock(stmt.then, new Env(env));
                    } else if (stmt.els) {
                        this.execBlock(stmt.els, new Env(env));
                    }
                    return;
                case "While":
                    while (truthy(this.evalExpr(stmt.cond, env))) {
                        this.tick();
                        this.execBlock(stmt.body, new Env(env));
                    }
                    return;
                case "For": {
                    const from = Math.trunc(this.evalExpr(stmt.from, env));
                    const to = Math.trunc(this.evalExpr(stmt.to, env));
                    for (let i = from; i < to; i++) {
                        this.tick();
                        const loopEnv = new Env(env);
                        loopEnv.define(stmt.name, i);
                        this.execBlock(stmt.body, loopEnv);
                    }
                    return;
                }
                case "Fn":
                    env.define(stmt.name, { type: "function", name: stmt.name, params: stmt.params, body: stmt.body, closure: env });
                    return;
                case "Return":
                    throw new ReturnSignal(stmt.value ? this.evalExpr(stmt.value, env) : null);
                default:
                    throw new OxError(`unknown statement '${stmt.type}'`);
            }
        }

        evalExpr(expr, env) {
            this.tick();
            switch (expr.type) {
                case "Number":
                case "String":
                case "Bool":
                    return expr.value;
                case "Var":
                    return env.get(expr.name);
                case "Logical": {
                    const left = this.evalExpr(expr.left, env);
                    if (expr.op === "&&") return truthy(left) ? this.evalExpr(expr.right, env) : left;
                    return truthy(left) ? left : this.evalExpr(expr.right, env);
                }
                case "Unary": {
                    const value = this.evalExpr(expr.value, env);
                    if (expr.op === "!") return !truthy(value);
                    if (expr.op === "-") {
                        if (typeof value !== "number") throw new OxError(`cannot negate ${formatValue(value)}`);
                        return -value;
                    }
                    break;
                }
                case "Binary":
                    return this.evalBinary(expr, env);
                case "Call":
                    return this.evalCall(expr, env);
                default:
                    throw new OxError(`unknown expression '${expr.type}'`);
            }
        }

        evalBinary(expr, env) {
            const l = this.evalExpr(expr.left, env);
            const r = this.evalExpr(expr.right, env);
            switch (expr.op) {
                case "+":
                    if (typeof l === "string" || typeof r === "string") return formatValue(l) + formatValue(r);
                    if (typeof l === "number" && typeof r === "number") return l + r;
                    throw new OxError(`cannot add ${formatValue(l)} and ${formatValue(r)}`);
                case "-":
                case "*":
                case "/":
                case "%":
                    if (typeof l !== "number" || typeof r !== "number") {
                        throw new OxError(`'${expr.op}' requires numbers, got ${formatValue(l)} and ${formatValue(r)}`);
                    }
                    if (expr.op === "-") return l - r;
                    if (expr.op === "*") return l * r;
                    if (expr.op === "/") {
                        if (r === 0) throw new OxError("division by zero");
                        return l / r;
                    }
                    if (r === 0) throw new OxError("modulo by zero");
                    return l % r;
                case "<":
                case ">":
                case "<=":
                case ">=":
                    if (typeof l !== "number" || typeof r !== "number") {
                        throw new OxError(`'${expr.op}' requires numbers, got ${formatValue(l)} and ${formatValue(r)}`);
                    }
                    if (expr.op === "<") return l < r;
                    if (expr.op === ">") return l > r;
                    if (expr.op === "<=") return l <= r;
                    return l >= r;
                case "==":
                    return l === r;
                case "!=":
                    return l !== r;
                default:
                    throw new OxError(`unknown operator '${expr.op}'`);
            }
        }

        evalCall(expr, env) {
            if (expr.callee.type !== "Var") throw new OxError("only named functions can be called");
            const fn = env.get(expr.callee.name);
            if (!fn || fn.type !== "function") throw new OxError(`'${expr.callee.name}' is not a function`);
            const args = expr.args.map((a) => this.evalExpr(a, env));
            if (args.length !== fn.params.length) {
                throw new OxError(`'${fn.name}' expects ${fn.params.length} argument(s), got ${args.length}`);
            }
            const callEnv = new Env(fn.closure);
            fn.params.forEach((p, idx) => callEnv.define(p, args[idx]));
            try {
                this.execBlock(fn.body, callEnv);
            } catch (signal) {
                if (signal instanceof ReturnSignal) return signal.value;
                throw signal;
            }
            return null;
        }
    }

    function runOxidized(source, onPrint) {
        const tokens = lex(source);
        const parser = new Parser(tokens);
        const program = parser.parseProgram();
        const interpreter = new Interpreter(onPrint);
        interpreter.run(program);
    }

    global.Oxidized = { runOxidized, OxError };
})(window);
