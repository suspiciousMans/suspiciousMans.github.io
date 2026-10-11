// Oxidized in the browser: lexer, parser and tree-walking interpreter for the
// language at github.com/suspiciousMans/oxidized.
//
// The real compiler transpiles .ox to Rust and builds it with rustc; this is
// a JavaScript port of the same grammar and of the generated runtime's
// behavior (DynamicValue, the builtins, closures, structs, enums, traits,
// tuples, pattern matching, `?`), so programs print what `oxidized run`
// prints. Checks the real checker does before rustc runs are done here as the
// program runs instead. `import` and `fn native` aren't available (there are
// no files to import and no Rust host), files live in an in-memory folder
// that starts empty on every run, and `http_get` can't reach the network.
(function (global) {
    "use strict";

    class OxError extends Error {}
    // Runtime failures: the generated Rust would panic.
    class OxPanic extends Error {}

    const KEYWORDS = new Set([
        "let", "fn", "if", "else", "while", "for", "in", "break", "continue", "struct", "impl",
        "enum", "match", "as", "trait", "const", "import", "return", "native", "print", "assert",
        "true", "false", "None",
    ]);

    // ---------- lexer ----------

    function lex(src) {
        const tokens = [];
        let i = 0;
        let line = 1;
        const n = src.length;
        const isDigit = (c) => c >= "0" && c <= "9";
        const isIdentStart = (c) => /[A-Za-z_]/.test(c);
        const isIdent = (c) => /[A-Za-z0-9_]/.test(c);
        const push = (type, value) => tokens.push({ type, value, line });
        // A dot glued to the end of an identifier, `)` or `]` is a field or
        // tuple-position dot (`t.0`), never the start of a float.
        const afterOperand = (at) => at > 0 && /[A-Za-z0-9_)\]]/.test(src[at - 1]);

        function exponent() {
            if (src[i] !== "e" && src[i] !== "E") return false;
            let j = i + 1;
            if (src[j] === "+" || src[j] === "-") j++;
            if (!isDigit(src[j] || "")) return false;
            i = j;
            while (i < n && isDigit(src[i])) i++;
            return true;
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
            if (c === "#" || (c === "/" && src[i + 1] === "/")) {
                while (i < n && src[i] !== "\n") i++;
                continue;
            }
            if (c === '"') {
                const startLine = line;
                i++;
                let s = "";
                while (i < n && src[i] !== '"') {
                    if (src[i] === "\\") {
                        i++;
                        const e = src[i];
                        if (e === undefined) throw new OxError(`unterminated string escape (line ${line})`);
                        const map = { '"': '"', "\\": "\\", n: "\n", t: "\t", r: "\r" };
                        if (!(e in map)) throw new OxError(`bad string escape '\\${e}' (line ${line})`);
                        s += map[e];
                        i++;
                    } else if (src[i] === "{" && src[i + 1] !== "{") {
                        // An interpolation `{expr}`: copied through verbatim,
                        // nested string literals included, for the parser to
                        // lex as an expression. Braces nest.
                        let depth = 0;
                        while (i < n) {
                            const ch = src[i++];
                            s += ch;
                            if (ch === "\n") line++;
                            if (ch === "{") depth++;
                            else if (ch === "}") {
                                if (--depth === 0) break;
                            } else if (ch === '"') {
                                while (i < n && src[i] !== '"') {
                                    if (src[i] === "\\" && i + 1 < n) s += src[i++];
                                    s += src[i++];
                                }
                                if (i < n) s += src[i++];
                            }
                        }
                        if (depth > 0) throw new OxError(`unclosed \`{\` in string interpolation (write \`{{\` for a literal brace) (line ${startLine})`);
                    } else if (src[i] === "{") {
                        s += "{{";
                        i += 2;
                    } else {
                        if (src[i] === "\n") line++;
                        s += src[i++];
                    }
                }
                if (i >= n) throw new OxError(`unterminated string (line ${startLine})`);
                i++;
                tokens.push({ type: "Str", value: s, line: startLine });
                continue;
            }
            if (isDigit(c) || (c === "." && isDigit(src[i + 1] || "") && !afterOperand(i))) {
                const start = i;
                // `t.0.1`: a number straight after a field dot is a tuple
                // position, so it never takes a fractional part.
                const tuplePosition = start >= 2 && src[start - 1] === "." && afterOperand(start - 1);
                let isFloat = false;
                while (i < n && isDigit(src[i])) i++;
                if (!tuplePosition && src[i] === "." && isDigit(src[i + 1] || "")) {
                    isFloat = true;
                    i++;
                    while (i < n && isDigit(src[i])) i++;
                }
                isFloat = exponent() || isFloat;
                const text = src.slice(start, i);
                if (isFloat) push("Float", parseFloat(text));
                else {
                    const v = BigInt(text);
                    if (v > I64_MAX) throw new OxError(`bad int '${text}': number too large (line ${line})`);
                    push("Int", v);
                }
                continue;
            }
            if (isIdentStart(c)) {
                const start = i;
                while (i < n && isIdent(src[i])) i++;
                const word = src.slice(start, i);
                if (KEYWORDS.has(word)) push(word, word);
                else push("Ident", word);
                continue;
            }
            const two = src.slice(i, i + 2);
            if (["->", "=>", "==", "!=", "<=", ">=", "&&", "||", "::", "..", "+=", "-=", "*=", "/=", "%="].includes(two)) {
                push(two, two);
                i += 2;
                continue;
            }
            if ("+-*/%=!<>:,(){}[];.?".includes(c)) {
                push(c, c);
                i++;
                continue;
            }
            if (c === "&" || c === "|") throw new OxError(`expected '${c}${c}' (line ${line})`);
            throw new OxError(`unexpected character '${c}' (line ${line})`);
        }
        push("Eof", null);
        return tokens;
    }

    // ---------- parser ----------

    const COMPOUND = { "+=": "+", "-=": "-", "*=": "*", "/=": "/", "%=": "%" };

    class Parser {
        constructor(tokens) {
            this.tokens = tokens;
            this.pos = 0;
            this.loops = 0;
            this.fnCtx = 0; // 0: top level, 1: named function, 2: closure
        }
        peek(o = 0) {
            return this.tokens[Math.min(this.pos + o, this.tokens.length - 1)];
        }
        at(type) {
            return this.peek().type === type;
        }
        bump() {
            const t = this.peek();
            if (this.pos < this.tokens.length - 1) this.pos++;
            return t;
        }
        fail(msg, tok = this.peek()) {
            throw new OxError(`${msg} (line ${tok.line})`);
        }
        describe(tok) {
            if (tok.type === "Eof") return "end of file";
            if (tok.type === "Str") return `"${tok.value}"`;
            return `'${tok.value}'`;
        }
        expect(type) {
            const t = this.peek();
            if (t.type !== type) this.fail(`expected '${type}', found ${this.describe(t)}`);
            return this.bump();
        }
        ident(what) {
            const t = this.peek();
            if (t.type !== "Ident") this.fail(`expected ${what}, found ${this.describe(t)}`);
            return this.bump().value;
        }
        skipSemis() {
            while (this.at(";")) this.bump();
        }
        // `item, item, ...` up to and including `close`, trailing comma allowed.
        list(close, item) {
            const out = [];
            while (!this.at(close)) {
                out.push(item());
                if (this.at(",")) this.bump();
                else break;
            }
            this.expect(close);
            return out;
        }

        parseProgram() {
            const decls = [];
            this.skipSemis();
            while (!this.at("Eof")) {
                const t = this.peek();
                if (!["fn", "const", "struct", "enum", "impl", "trait", "import"].includes(t.type)) {
                    this.fail("only `fn`, `struct`, `enum`, `trait`, `impl` and `import` can appear at the top level — put statements inside `fn main()`");
                }
                decls.push(this.parseStmt());
                this.skipSemis();
            }
            return decls;
        }

        parseStmt() {
            this.skipSemis();
            const line = this.peek().line;
            const s = this.parseStmtKind();
            s.line = line;
            return s;
        }

        parseStmtKind() {
            const t = this.peek();
            switch (t.type) {
                case "let": return this.parseLet();
                case "fn": return { kind: "Fn", def: this.parseFn() };
                case "const": {
                    this.bump();
                    if (!this.at("fn")) this.fail("expected `fn` after `const`");
                    return { kind: "Fn", def: this.parseFn() };
                }
                case "return": return this.parseReturn();
                case "if": return this.parseIf();
                case "while": {
                    this.bump();
                    const cond = this.parseExpr();
                    const body = this.loopBody();
                    return { kind: "While", cond, body };
                }
                case "for": {
                    this.bump();
                    const name = this.ident("identifier after `for`");
                    this.expect("in");
                    const iter = this.parseExpr();
                    const body = this.loopBody();
                    return { kind: "For", name, iter, body };
                }
                case "struct": return this.parseStruct();
                case "enum": return this.parseEnum();
                case "impl": return this.parseImpl();
                case "trait": return this.parseTrait();
                case "import": {
                    this.bump();
                    if (!this.at("Str")) this.fail("expected a string path after `import`");
                    const path = this.bump().value;
                    if (this.at("as")) {
                        this.bump();
                        this.ident("an alias name after `as`");
                    }
                    return { kind: "Import", path };
                }
                case "break":
                case "continue":
                    if (!this.loops) this.fail(`\`${t.type}\` outside of a loop`);
                    this.bump();
                    return { kind: t.type === "break" ? "Break" : "Continue" };
                case "Ident": {
                    const next = this.peek(1).type;
                    if (next === "=" || next in COMPOUND) {
                        const line = t.line;
                        const name = this.bump().value;
                        const op = COMPOUND[this.bump().type] || null;
                        return { kind: "Assign", target: { kind: "Var", name, line }, op, value: this.parseExpr() };
                    }
                    return this.parseExprStmt();
                }
                case "print": case "assert": case "(": case "[": case "Int": case "Float": case "Str":
                case "true": case "false": case "None": case "-": case "!": case "match":
                    return this.parseExprStmt();
                case "Eof":
                    return this.fail("unexpected end of file");
                default:
                    return this.fail(`unexpected ${this.describe(t)} in statement position`);
            }
        }

        loopBody() {
            this.loops++;
            try {
                return this.parseBlock();
            } finally {
                this.loops--;
            }
        }

        // A type annotation: a name (`Int`, `Point`, `alias::Shape`), a
        // tuple type `(Int, String)`, or `Box<T>`.
        parseType() {
            if (this.at("(")) {
                this.bump();
                return { tuple: this.list(")", () => this.parseType()) };
            }
            let name = this.ident("a type name");
            if (this.at("::")) {
                this.bump();
                name += "::" + this.ident("a type name after `::`");
            }
            if (name === "Box") {
                this.expect("<");
                const inner = this.parseType();
                this.expect(">");
                return inner;
            }
            return name;
        }

        parseLet() {
            this.bump();
            if (this.at("(")) {
                const pattern = this.parsePattern();
                if (this.at(":")) {
                    this.bump();
                    this.parseType();
                }
                this.expect("=");
                return { kind: "LetPattern", pattern, value: this.parseExpr() };
            }
            const name = this.ident("identifier after `let`");
            let ty = null;
            if (this.at(":")) {
                this.bump();
                ty = this.parseType();
            }
            this.expect("=");
            return { kind: "Let", name, ty, value: this.parseExpr() };
        }

        // `<T, U: Trait + Other>` — the names; bounds are checked by the
        // real compiler and only parsed here.
        typeParams() {
            if (!this.at("<")) return [];
            this.bump();
            const params = this.list(">", () => {
                const name = this.ident("type parameter name");
                if (this.at(":")) {
                    this.bump();
                    for (;;) {
                        this.parseType();
                        if (this.at("+")) this.bump();
                        else break;
                    }
                }
                return name;
            });
            return params;
        }

        qualifiedName(what) {
            let name = this.ident(what);
            if (this.at("::")) {
                this.bump();
                name += "::" + this.ident(`a name after \`${name}::\``);
            }
            return name;
        }

        parseFn(signatureOnly = false) {
            const line = this.bump().line;
            let native = false;
            if (this.at("native")) {
                this.bump();
                native = true;
            }
            const name = this.ident("function name after `fn`");
            const typeParams = this.typeParams();
            this.expect("(");
            const params = this.list(")", () => {
                const pname = this.ident("parameter name");
                let ty = null;
                if (this.at(":")) {
                    this.bump();
                    ty = this.parseType();
                }
                return { name: pname, ty };
            });
            let ret = null;
            if (this.at("->")) {
                this.bump();
                ret = this.parseType();
            }
            if (native) {
                if (!this.at(";")) this.fail(`\`fn native ${name}\` is implemented by the host and can't have a body — end the signature with \`;\``);
                this.bump();
                return { name, typeParams, params, ret, body: [], native: true, line };
            }
            if (signatureOnly && !this.at("{")) return { name, typeParams, params, ret, body: null, line };
            const body = this.fnBody(1);
            return { name, typeParams, params, ret, body, line };
        }

        fnBody(ctx) {
            const outerLoops = this.loops;
            const outerCtx = this.fnCtx;
            this.loops = 0;
            this.fnCtx = ctx;
            try {
                return this.parseBlock();
            } finally {
                this.loops = outerLoops;
                this.fnCtx = outerCtx;
            }
        }

        parseReturn() {
            const ret = this.bump();
            const t = this.peek();
            const ends = ["}", "Eof", "let", "while", "return", "else", "for", "break", "continue", "struct", "import", ";"];
            const bare =
                ends.includes(t.type) ||
                (t.type === "fn" && this.peek(1).type !== "(") ||
                // `return if c { a } else { b }` returns a value when the `if`
                // shares the `return`'s line; on the next line it's a statement.
                (t.type === "if" && t.line !== ret.line);
            return { kind: "Return", value: bare ? null : this.parseExpr() };
        }

        parseIf() {
            this.bump();
            const cond = this.parseExpr();
            const then = this.parseBlock();
            let otherwise = null;
            if (this.at("else")) {
                this.bump();
                if (this.at("if")) {
                    const line = this.peek().line;
                    const inner = this.parseIf();
                    inner.line = line;
                    otherwise = [inner];
                } else {
                    otherwise = this.parseBlock();
                }
            }
            return { kind: "If", cond, then, otherwise };
        }

        // `if` used as a value: the `else` is required, and each branch is a
        // block whose last line is its value.
        parseIfExpr(line) {
            const cond = this.parseExpr();
            const then = this.parseBlock();
            if (!then.length) this.fail("an `if` used as a value needs a value in its `then` block, but it is empty");
            if (!this.at("else")) this.fail("an `if` used as a value needs an `else` branch");
            this.bump();
            let otherwise;
            if (this.at("if")) {
                const l = this.bump().line;
                otherwise = { kind: "Expr", expr: this.parseIfExpr(l) };
                otherwise = [otherwise];
            } else {
                otherwise = this.parseBlock();
                if (!otherwise.length) this.fail("an `if` used as a value needs a value in its `else` block, but it is empty");
            }
            return { kind: "IfExpr", cond, then, otherwise, line };
        }

        parseStruct() {
            this.bump();
            const name = this.ident("struct name after `struct`");
            const typeParams = this.typeParams();
            this.expect("{");
            const fields = this.list("}", () => {
                const fname = this.ident("field name");
                let ty = null;
                if (this.at(":")) {
                    this.bump();
                    ty = this.parseType();
                }
                return { name: fname, ty };
            });
            return { kind: "Struct", name, typeParams, fields };
        }

        parseEnum() {
            this.bump();
            const name = this.ident("enum name after `enum`");
            this.expect("{");
            const variants = this.list("}", () => {
                const vname = this.ident("variant name");
                let payload = [];
                let fields = null;
                if (this.at("(")) {
                    this.bump();
                    payload = this.list(")", () => this.parseType());
                } else if (this.at("{")) {
                    // Struct-style variant: `Click { x: Int, y: Int }`.
                    this.bump();
                    fields = [];
                    this.list("}", () => {
                        const fname = this.ident(`a field name in variant \`${vname}\``);
                        if (fields.includes(fname)) this.fail(`variant \`${vname}\` declares field \`${fname}\` twice`);
                        this.expect(":");
                        payload.push(this.parseType());
                        fields.push(fname);
                    });
                    if (!fields.length) this.fail(`struct-style variant \`${vname}\` needs at least one field; write it without braces`);
                }
                return { name: vname, payload, fields };
            });
            return { kind: "Enum", name, variants };
        }

        parseImpl() {
            this.bump();
            const first = this.qualifiedName("struct or trait name after `impl`");
            let traitName = null;
            let name = first;
            if (this.at("for")) {
                this.bump();
                traitName = first;
                name = this.qualifiedName("struct name after `for`");
            }
            this.typeParams();
            this.expect("{");
            if (this.at("const")) this.fail("a method can't be `const` — compile-time evaluation applies to top-level `const fn` declarations only");
            const methods = [];
            while (this.at("fn")) methods.push(this.parseFn());
            this.expect("}");
            return { kind: "Impl", name, traitName, methods };
        }

        parseTrait() {
            this.bump();
            const name = this.ident("trait name after `trait`");
            this.expect("{");
            const methods = [];
            while (this.at("fn")) {
                methods.push(this.parseFn(true));
                this.skipSemis();
            }
            this.expect("}");
            return { kind: "Trait", name, methods };
        }

        parseExprStmt() {
            const line = this.peek().line;
            const expr = this.parseExpr();
            const t = this.peek().type;
            if (t === "=" || t in COMPOUND) {
                if (expr.kind !== "Field" && expr.kind !== "Index") {
                    this.fail("cannot assign to this expression — only a variable (`x = ...`), a struct field (`x.field = ...`) or a list element (`xs[i] = ...`) can be assigned to");
                }
                if (!placeRoot(expr)) this.fail("assignment reaches into a list or struct through a path rooted at a variable, with no calls in it (`x.f = ...`, `xs[i] = ...`)");
                this.bump();
                return { kind: "Assign", target: expr, op: COMPOUND[t] || null, value: this.parseExpr(), line };
            }
            return { kind: "Expr", expr };
        }

        parseBlock() {
            this.expect("{");
            const stmts = [];
            this.skipSemis();
            while (!this.at("}")) {
                if (this.at("Eof")) this.fail("expected '}', found end of file");
                stmts.push(this.parseStmt());
                this.skipSemis();
            }
            this.expect("}");
            return stmts;
        }

        parseExpr() {
            return this.binary(0);
        }

        binary(level) {
            const LEVELS = [["||"], ["&&"], ["==", "!=", "<", ">", "<=", ">="], [".."], ["+", "-"], ["*", "/", "%"]];
            if (level === LEVELS.length) return this.parseUnary();
            let lhs = this.binary(level + 1);
            while (LEVELS[level].includes(this.peek().type)) {
                const op = this.bump().type;
                const line = this.peek().line;
                const rhs = this.binary(level + 1);
                if (op === "..") {
                    if (this.at("..")) this.fail("ranges can't be chained (`a..b..c`) — a range has exactly two bounds");
                    lhs = { kind: "Call", name: "range", args: [lhs, rhs], line };
                } else {
                    lhs = { kind: "Binary", op, lhs, rhs, line };
                }
            }
            return lhs;
        }

        parseUnary() {
            if (this.at("-") || this.at("!")) {
                const op = this.bump().type;
                return { kind: "Unary", op, expr: this.parseUnary() };
            }
            return this.parsePostfix();
        }

        parsePostfix() {
            let expr = this.parsePrimary();
            for (;;) {
                const line = this.peek().line;
                if (this.at("[")) {
                    this.bump();
                    const index = this.parseExpr();
                    this.expect("]");
                    expr = { kind: "Index", target: expr, index, line };
                } else if (this.at(".")) {
                    this.bump();
                    if (this.at("Int")) {
                        // `t.0` — positional tuple access, the same as `t[0]`.
                        expr = { kind: "Index", target: expr, index: { kind: "Lit", value: this.bump().value }, line };
                        continue;
                    }
                    const field = this.ident("field name after `.`");
                    if (this.at("(")) {
                        this.bump();
                        expr = { kind: "MethodCall", receiver: expr, method: field, args: this.callArgs(), line };
                    } else {
                        expr = { kind: "Field", target: expr, field, line };
                    }
                } else if (this.at("?")) {
                    this.bump();
                    if (this.fnCtx === 0) this.fail("`?` can only be used inside a function body");
                    if (this.fnCtx === 2) this.fail("`?` can't be used inside a closure: its `return` would only leave the closure — `match` on the Result there instead");
                    expr = { kind: "Try", expr, line };
                } else if (this.at("as")) {
                    this.bump();
                    expr = { kind: "Cast", value: expr, ty: this.parseType(), line };
                } else {
                    return expr;
                }
            }
        }

        callArgs() {
            return this.list(")", () => this.parseExpr());
        }

        isFieldList() {
            return this.at("Ident") && this.peek(1).type === ":";
        }

        fieldInits() {
            return this.list(")", () => {
                const name = this.ident("field name");
                this.expect(":");
                return { name, value: this.parseExpr() };
            });
        }

        parsePattern() {
            const t = this.bump();
            switch (t.type) {
                case "Int": case "Float":
                    return { kind: "Literal", value: t.value };
                case "Str": {
                    const lit = this.interpolate(t.value, t.line);
                    if (lit.kind !== "Lit") this.fail("a string pattern can't contain `{expr}` interpolation (write `{{` for a literal brace)", t);
                    return { kind: "Literal", value: lit.value };
                }
                case "true": return { kind: "Literal", value: true };
                case "false": return { kind: "Literal", value: false };
                case "-": {
                    const num = this.bump();
                    if (num.type !== "Int" && num.type !== "Float") this.fail("expected a number after '-' in pattern", num);
                    return { kind: "Literal", value: -num.value };
                }
                case "(":
                    return { kind: "Tuple", items: this.list(")", () => this.parsePattern()) };
                case "Ident": {
                    if (t.value === "_") return { kind: "Wildcard" };
                    let name = t.value;
                    let enumName = null;
                    if (this.at("::")) {
                        this.bump();
                        enumName = name;
                        name = this.ident("variant name after `::` in pattern");
                    }
                    if (this.at("(")) {
                        this.bump();
                        return { kind: "Variant", enumName, name, subs: this.list(")", () => this.parsePattern()), line: t.line };
                    }
                    if (this.at("{")) {
                        this.bump();
                        const fields = [];
                        let rest = false;
                        while (!this.at("}")) {
                            if (this.at("..")) {
                                this.bump();
                                rest = true;
                                break;
                            }
                            const fname = this.ident("a field name in struct pattern");
                            if (fields.some(([f]) => f === fname)) this.fail(`field \`${fname}\` appears twice in one pattern`);
                            let pat = { kind: "Binding", name: fname };
                            if (this.at(":")) {
                                this.bump();
                                pat = this.parsePattern();
                            }
                            fields.push([fname, pat]);
                            if (this.at(",")) this.bump();
                            else break;
                        }
                        this.expect("}");
                        return { kind: "Fields", enumName, name, fields, rest, line: t.line };
                    }
                    if (enumName) return { kind: "Variant", enumName, name, subs: [], line: t.line };
                    return { kind: "Binding", name };
                }
                default:
                    return this.fail(`unexpected ${this.describe(t)} in pattern`, t);
            }
        }

        // A string literal with `{expr}` segments: `"a{x}b"` is
        // `"a" + (x as String) + "b"`. `{{`/`}}` are literal braces and an
        // empty `{}` is left as written.
        interpolate(s, line) {
            if (!s.includes("{") && !s.includes("}")) return { kind: "Lit", value: s };
            const parts = [];
            let text = "";
            let i = 0;
            while (i < s.length) {
                const c = s[i];
                if (c === "{" && s[i + 1] === "{") {
                    text += "{";
                    i += 2;
                } else if (c === "}" && s[i + 1] === "}") {
                    text += "}";
                    i += 2;
                } else if (c === "{") {
                    let depth = 1;
                    let j = i + 1;
                    while (j < s.length && depth > 0) {
                        if (s[j] === "{") depth++;
                        else if (s[j] === "}") depth--;
                        j++;
                    }
                    if (depth > 0) throw new OxError(`unclosed \`{\` in string interpolation (write \`{{\` for a literal brace) (line ${line})`);
                    const inner = s.slice(i + 1, j - 1).trim();
                    if (!inner) text += "{}";
                    else {
                        if (text) parts.push({ kind: "Lit", value: text });
                        text = "";
                        parts.push({ kind: "Cast", value: this.subExpr(inner, line), ty: "String", line });
                    }
                    i = j;
                } else {
                    text += c;
                    i++;
                }
            }
            if (text || !parts.length) parts.push({ kind: "Lit", value: text });
            let acc = parts[0];
            if (acc.kind !== "Lit") acc = { kind: "Binary", op: "+", lhs: { kind: "Lit", value: "" }, rhs: acc, line };
            for (const p of parts.slice(1)) acc = { kind: "Binary", op: "+", lhs: acc, rhs: p, line };
            return acc;
        }

        subExpr(src, line) {
            const fail = (why) => new OxError(`bad string interpolation \`{${src}}\`: ${why} (line ${line})`);
            let tokens;
            try {
                tokens = lex(src).map((t) => ({ ...t, line }));
            } catch (e) {
                throw fail(e.message.replace(/ \(line \d+\)$/, ""));
            }
            const sub = new Parser(tokens);
            sub.fnCtx = this.fnCtx;
            let expr;
            try {
                expr = sub.parseExpr();
            } catch (e) {
                throw fail(e.message.replace(/ \(line \d+\)$/, ""));
            }
            if (!sub.at("Eof")) throw fail("expected a single expression");
            return expr;
        }

        parsePrimary() {
            const t = this.bump();
            const line = t.line;
            switch (t.type) {
                case "Int": case "Float":
                    return { kind: "Lit", value: t.value };
                case "Str":
                    return this.interpolate(t.value, line);
                case "true": return { kind: "Lit", value: true };
                case "false": return { kind: "Lit", value: false };
                case "None": return { kind: "Lit", value: null };
                case "fn": {
                    this.expect("(");
                    const params = this.list(")", () => {
                        const name = this.ident("parameter name");
                        if (this.at(":")) this.fail("lambda parameters cannot have type annotations");
                        return name;
                    });
                    if (this.at("->")) this.fail("lambda cannot have a return type annotation");
                    return { kind: "Lambda", params, body: this.fnBody(2), line };
                }
                case "if":
                    return this.parseIfExpr(line);
                case "match": {
                    const scrutinee = this.parseExpr();
                    this.expect("{");
                    const arms = this.list("}", () => {
                        const pattern = this.parsePattern();
                        let guard = null;
                        if (this.at("if")) {
                            this.bump();
                            guard = this.parseExpr();
                        }
                        this.expect("=>");
                        const body = this.at("{") ? { kind: "Block", stmts: this.parseBlock() } : this.parseExpr();
                        return { pattern, guard, body };
                    });
                    return { kind: "Match", scrutinee, arms, line };
                }
                case "print":
                case "assert":
                    if (!this.at("(")) this.fail(`expected '(' after ${t.type}`);
                    this.bump();
                    return { kind: "Call", name: t.type, args: this.callArgs(), line };
                case "Ident": {
                    const name = t.value;
                    if (this.at("::")) {
                        this.bump();
                        const member = this.ident("a name after `::`");
                        if (!this.at("(")) {
                            this.fail(`\`${name}::${member}\` must be followed by \`(\` — enum variants are always constructed with parentheses, even with no payload (\`${name}::${member}()\`)`);
                        }
                        this.bump();
                        if (this.isFieldList()) return { kind: "StructInit", name: `${name}::${member}`, fields: this.fieldInits(), line };
                        return { kind: "EnumInit", enumName: name, variant: member, args: this.callArgs(), line };
                    }
                    if (this.at("(")) {
                        this.bump();
                        if (this.isFieldList()) return { kind: "StructInit", name, fields: this.fieldInits(), line };
                        return { kind: "Call", name, args: this.callArgs(), line };
                    }
                    return { kind: "Var", name, line };
                }
                case "(": {
                    if (this.at(")")) this.fail("expected an expression inside `()`");
                    const first = this.parseExpr();
                    if (!this.at(",")) {
                        this.expect(")");
                        // `(fn(x) { ... })(5)` — an immediately-invoked lambda.
                        if (first.kind === "Lambda" && this.at("(")) {
                            this.bump();
                            return { kind: "Call", callee: first, args: this.callArgs(), line };
                        }
                        return first;
                    }
                    // `(a, b)` — a tuple; `(a,)` is a one-element tuple.
                    const items = [first];
                    while (this.at(",")) {
                        this.bump();
                        if (this.at(")")) break;
                        items.push(this.parseExpr());
                    }
                    this.expect(")");
                    return { kind: "Tuple", items };
                }
                case "[":
                    return { kind: "List", items: this.list("]", () => this.parseExpr()) };
                default:
                    return this.fail(`unexpected ${this.describe(t)} in expression`, t);
            }
        }
    }

    // The variable a place expression (`xs[i].f`) is rooted at, or null when
    // the path contains anything but fields and indexes.
    function placeRoot(e) {
        while (e.kind === "Field" || e.kind === "Index") e = e.target;
        return e.kind === "Var" ? e : null;
    }

    const FLOAT_TYPES = new Set(["Float", "f64", "f32"]);
    const staticFloat = (e) => (e.kind === "Lit" && typeof e.value === "number") || (e.kind === "Cast" && FLOAT_TYPES.has(e.ty));
    const ARITH = new Set(["+", "-", "*", "/", "%"]);

    // ---------- values ----------
    //
    // Int → BigInt (checked against i64), Float → number, Str → string,
    // Bool → boolean, None → null, List → array, Tuple → OxTuple. Values are
    // never mutated in place: `p.x = 1` builds a new struct and rebinds the
    // variable, which gives the language's copy-on-pass semantics for free.

    const I64_MAX = (1n << 63n) - 1n;
    const I64_MIN = -(1n << 63n);
    const I32_MAX = (1n << 31n) - 1n;
    const I32_MIN = -(1n << 31n);

    class OxStruct {
        constructor(name, fields) {
            this.name = name;
            this.fields = fields; // [[name, value], ...] in declaration order
        }
        has(field) {
            return this.fields.some(([k]) => k === field);
        }
        get(field) {
            const f = this.fields.find(([k]) => k === field);
            if (!f) throw new OxPanic(`no field \`${field}\` on struct \`${this.name}\``);
            return f[1];
        }
        with(field, value) {
            if (!this.has(field)) throw new OxPanic(`no field \`${field}\` on struct \`${this.name}\``);
            return new OxStruct(this.name, this.fields.map(([k, v]) => [k, k === field ? value : v]));
        }
    }

    class OxTuple {
        constructor(items) {
            this.items = items;
        }
    }

    class OxEnum {
        constructor(type, variant, payload) {
            this.type = type;
            this.variant = variant;
            this.payload = payload;
        }
    }

    // A hash-indexed, insertion-ordered map. Keys are compared by a
    // canonical form (see mapKey), not by `==`.
    class OxMap {
        constructor(entries = [], index = null) {
            this.entries = entries; // [[key, value], ...]
            this.index = index || new Map(entries.map(([k], i) => [mapKey(k), i]));
        }
        lookup(k) {
            const i = this.index.get(mapKey(k));
            return i === undefined ? undefined : this.entries[i];
        }
        set(k, v) {
            const key = mapKey(k);
            const i = this.index.get(key);
            const entries = this.entries.slice();
            const index = new Map(this.index);
            if (i === undefined) {
                index.set(key, entries.length);
                entries.push([k, v]);
            } else {
                entries[i] = [entries[i][0], v];
            }
            return new OxMap(entries, index);
        }
        remove(k) {
            const key = mapKey(k);
            if (!this.index.has(key)) return this;
            return new OxMap(this.entries.filter(([e]) => mapKey(e) !== key));
        }
    }

    class OxFunc {
        constructor(def, capture) {
            this.def = def; // { name, params: [{name, ty}], ret, body }
            this.capture = capture; // Scope for lambdas, null for named functions
        }
    }

    const isInt = (v) => typeof v === "bigint";
    const isFloat = (v) => typeof v === "number";

    function mapKey(k) {
        if (k === null) return "N";
        if (isInt(k)) return "I" + k;
        if (isFloat(k)) {
            if (Number.isNaN(k)) throw new OxPanic("a NaN Float can't be a map key");
            if (Number.isInteger(k) && Math.abs(k) < 9.2e18) return "I" + BigInt(k);
            return "F" + k;
        }
        if (typeof k === "string") return "S" + JSON.stringify(k);
        if (typeof k === "boolean") return k ? "B1" : "B0";
        if (Array.isArray(k)) return "L[" + k.map(mapKey).join(",") + "]";
        if (k instanceof OxTuple) return "T[" + k.items.map(mapKey).join(",") + "]";
        if (k instanceof OxStruct) return "R" + k.name + "{" + k.fields.map(([f, v]) => f + "=" + mapKey(v)).join(",") + "}";
        if (k instanceof OxEnum) return "E" + k.type + "::" + k.variant + "(" + k.payload.map(mapKey).join(",") + ")";
        throw new OxPanic(`a ${typeName(k)} can't be a map key`);
    }

    function checkInt(v, what) {
        if (v > I64_MAX || v < I64_MIN) throw new OxPanic(`attempt to ${what} with overflow`);
        return v;
    }

    function formatFloat(n) {
        if (Number.isNaN(n)) return "NaN";
        if (n === Infinity) return "inf";
        if (n === -Infinity) return "-inf";
        if (Math.abs(n - Math.round(n)) < 1e-9) {
            // Rust's `{:.1}`
            if (Math.abs(n) >= 1e21) return BigInt(Math.round(n)).toString() + ".0";
            return (Object.is(n, -0) ? "-" : "") + n.toFixed(1);
        }
        return plainDecimal(String(n));
    }

    // JS's exponent notation spelled out, as Rust's `{}` prints floats.
    function plainDecimal(s) {
        const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
        if (!m) return s;
        const [, sign, lead, frac = "", expText] = m;
        const exp = Number(expText);
        const digits = lead + frac;
        if (exp < 0) return sign + "0." + "0".repeat(-exp - 1) + digits;
        return sign + digits.padEnd(exp + 1, "0");
    }

    // Rust's `{:?}` for f64 (JSON output uses it).
    function debugFloat(n) {
        if (Number.isInteger(n) && Math.abs(n) < 1e16) return n.toFixed(1);
        const s = String(n);
        const m = /^(-?\d(?:\.\d+)?)e([+-])(\d+)$/.exec(s);
        if (m) return m[1] + "e" + (m[2] === "-" ? "-" : "") + m[3];
        return s;
    }

    function show(v) {
        if (v === null) return "None";
        if (isInt(v)) return v.toString();
        if (isFloat(v)) return formatFloat(v);
        if (typeof v === "string") return v;
        if (typeof v === "boolean") return v ? "true" : "false";
        if (Array.isArray(v)) return "[" + v.map(show).join(", ") + "]";
        if (v instanceof OxTuple) return v.items.length === 1 ? `(${show(v.items[0])},)` : "(" + v.items.map(show).join(", ") + ")";
        if (v instanceof OxStruct) return `${v.name} { ${v.fields.map(([k, x]) => `${k}: ${show(x)}`).join(", ")} }`;
        if (v instanceof OxEnum) return v.payload.length ? `${v.variant}(${v.payload.map(show).join(", ")})` : v.variant;
        if (v instanceof OxMap) return "{" + v.entries.map(([k, x]) => `${show(k)}: ${show(x)}`).join(", ") + "}";
        if (v instanceof OxFunc) return "<function>";
        return String(v);
    }

    // Rust's `{:?}` for DynamicValue, used in panic messages.
    function debug(v) {
        if (v === null) return "None";
        if (isInt(v)) return `Int(${v})`;
        if (isFloat(v)) return `Float(${debugFloat(v)})`;
        if (typeof v === "string") return `Str(${JSON.stringify(v)})`;
        if (typeof v === "boolean") return `Bool(${v})`;
        if (Array.isArray(v)) return `List([${v.map(debug).join(", ")}])`;
        if (v instanceof OxTuple) return `Tuple([${v.items.map(debug).join(", ")}])`;
        if (v instanceof OxStruct) return `Struct(${JSON.stringify(v.name)}, [${v.fields.map(([k, x]) => `(${JSON.stringify(k)}, ${debug(x)})`).join(", ")}])`;
        if (v instanceof OxEnum) return `Enum(${JSON.stringify(v.type)}, ${JSON.stringify(v.variant)}, [${v.payload.map(debug).join(", ")}])`;
        if (v instanceof OxMap) return `Map({${v.entries.map(([k, x]) => `${debug(k)}: ${debug(x)}`).join(", ")}})`;
        return "Function(<function>)";
    }

    function typeName(v) {
        if (v === null) return "None";
        if (isInt(v)) return "Int";
        if (isFloat(v)) return "Float";
        if (typeof v === "string") return "String";
        if (typeof v === "boolean") return "Bool";
        if (Array.isArray(v)) return "List";
        if (v instanceof OxTuple) return "Tuple";
        if (v instanceof OxStruct) return v.name;
        if (v instanceof OxEnum) return v.type;
        if (v instanceof OxMap) return "Map";
        return "Function";
    }

    // The running interpreter, so `==` and `<` on structs can call a
    // user-defined `__eq__`/`__lt__` wherever values are compared.
    let INTERP = null;

    function eq(a, b) {
        if (isInt(a) && isInt(b)) return a === b;
        if ((isFloat(a) || isInt(a)) && (isFloat(b) || isInt(b))) return Math.abs(Number(a) - Number(b)) < 1e-9;
        if (typeof a === "string" || typeof a === "boolean" || a === null) return a === b;
        if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => eq(x, b[i]));
        if (a instanceof OxTuple && b instanceof OxTuple) return eq(a.items, b.items);
        if (a instanceof OxStruct && b instanceof OxStruct) {
            if (a.name === b.name && INTERP) {
                const r = INTERP.dispatchOp("__eq__", a, [b]);
                if (r !== undefined) return truthy(r);
            }
            return a.name === b.name && a.fields.length === b.fields.length && a.fields.every(([k, x], i) => k === b.fields[i][0] && eq(x, b.fields[i][1]));
        }
        if (a instanceof OxEnum && b instanceof OxEnum) {
            return a.type === b.type && a.variant === b.variant && eq(a.payload, b.payload);
        }
        if (a instanceof OxMap && b instanceof OxMap) {
            return a.entries.length === b.entries.length && a.entries.every(([k, x], i) => eq(k, b.entries[i][0]) && eq(x, b.entries[i][1]));
        }
        return false;
    }

    // Derived PartialOrd: same kind compares contents, different kinds
    // compare by declaration order. null when unordered (NaN, functions).
    const RANK = ["Int", "Float", "Str", "Bool", "List", "Tuple", "Struct", "Enum", "Map", "Function", "None"];
    function rank(v) {
        if (v === null) return 10;
        if (isInt(v)) return 0;
        if (isFloat(v)) return 1;
        if (typeof v === "string") return 2;
        if (typeof v === "boolean") return 3;
        if (Array.isArray(v)) return 4;
        if (v instanceof OxTuple) return 5;
        if (v instanceof OxStruct) return 6;
        if (v instanceof OxEnum) return 7;
        if (v instanceof OxMap) return 8;
        return 9;
    }
    function cmpPrim(a, b) {
        if (Number.isNaN(a) || Number.isNaN(b)) return null;
        return a < b ? -1 : a > b ? 1 : 0;
    }
    function cmpSeq(a, b, each) {
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            const c = each(a[i], b[i]);
            if (c !== 0) return c;
        }
        return cmpPrim(a.length, b.length);
    }
    function cmp(a, b) {
        // Int and Float compare by value, as `==` does.
        if ((isInt(a) && isFloat(b)) || (isFloat(a) && isInt(b))) return cmpPrim(Number(a), Number(b));
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return cmpPrim(ra, rb);
        switch (RANK[ra]) {
            case "Int": case "Float": case "Str": return cmpPrim(a, b);
            case "Bool": return cmpPrim(Number(a), Number(b));
            case "List": return cmpSeq(a, b, cmp);
            case "Tuple": return cmpSeq(a.items, b.items, cmp);
            case "Struct": {
                if (a.name === b.name && INTERP) {
                    const less = INTERP.dispatchOp("__lt__", a, [b]);
                    if (less !== undefined) {
                        if (truthy(less)) return -1;
                        return truthy(INTERP.dispatchOp("__lt__", b, [a])) ? 1 : 0;
                    }
                }
                return cmpPrim(a.name, b.name) || cmpSeq(a.fields, b.fields, (x, y) => cmpPrim(x[0], y[0]) || cmp(x[1], y[1]));
            }
            case "Enum": return cmpPrim(a.type, b.type) || cmpPrim(a.variant, b.variant) || cmpSeq(a.payload, b.payload, cmp);
            case "Map": return cmpSeq(a.entries, b.entries, (x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]));
            case "None": return 0;
            default: return null;
        }
    }

    const truthy = (v) => (typeof v === "boolean" ? v : v !== null);

    // Type annotations: the primitives pin a value, anything else (a struct,
    // an enum, a tuple type, a type parameter) is dynamic.
    function primitive(ty) {
        switch (ty) {
            case "Int": case "i64": return "i64";
            case "i32": return "i32";
            case "Float": case "f64": case "f32": return "f64";
            case "String": case "string": return "String";
            case "bool": return "bool";
            case "List": return "List";
            default: return null;
        }
    }

    const typeText = (ty) => (ty && ty.tuple ? "(" + ty.tuple.map(typeText).join(", ") + ")" : String(ty));

    // Converts a value crossing into a typed slot (let, parameter, return,
    // struct field), the way the generated Rust converts between its static
    // and dynamic halves.
    function coerce(v, ty, what) {
        const p = primitive(ty);
        if (!p) return v;
        const bad = () => {
            const hint = isFloat(v) && (p === "i64" || p === "i32") ? ` — going from Float to ${ty} needs an explicit \`as ${ty}\`` : "";
            throw new OxError(`type mismatch: ${what} is ${ty}, but got ${typeName(v)} ${show(v)}${hint}`);
        };
        switch (p) {
            case "i64":
                if (!isInt(v)) bad();
                return v;
            case "i32":
                if (!isInt(v)) bad();
                if (v > I32_MAX || v < I32_MIN) throw new OxPanic(`value ${v} doesn't fit in i32 (${what})`);
                return v;
            case "f64":
                if (isInt(v)) return Number(v);
                if (!isFloat(v)) bad();
                return v;
            case "String":
                if (typeof v !== "string") bad();
                return v;
            case "bool":
                if (typeof v !== "boolean") bad();
                return v;
            case "List":
                if (!Array.isArray(v)) bad();
                return v;
        }
        return v;
    }

    function cast(v, ty) {
        const p = primitive(ty);
        const fail = () => {
            throw new OxPanic(`cannot cast ${show(v)} to ${p}`);
        };
        switch (p) {
            case "i64":
            case "i32": {
                let out;
                if (isInt(v)) out = v;
                else if (isFloat(v)) out = toI64(v);
                else if (typeof v === "boolean") out = v ? 1n : 0n;
                else if (typeof v === "string") {
                    const s = v.trim();
                    if (!/^[+-]?\d+$/.test(s)) fail();
                    out = BigInt(s);
                    if (out > I64_MAX || out < I64_MIN) fail();
                } else fail();
                return out;
            }
            case "f64": {
                if (isInt(v)) return Number(v);
                if (isFloat(v)) return v;
                if (typeof v === "boolean") return v ? 1 : 0;
                if (typeof v === "string") return parseFloatStrict(v.trim()) ?? fail();
                return fail();
            }
            case "String":
                return show(v);
            case "bool":
                if (typeof v === "boolean") return v;
                if (isInt(v)) return v !== 0n;
                if (isFloat(v)) return v !== 0;
                if (v === "true") return true;
                if (v === "false") return false;
                return fail();
            case "List":
                if (!Array.isArray(v)) fail();
                return v;
            default:
                return v;
        }
    }

    function parseFloatStrict(s) {
        if (/^[+-]?(inf|infinity)$/i.test(s)) return s.startsWith("-") ? -Infinity : Infinity;
        if (/^[+-]?nan$/i.test(s)) return NaN;
        if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
        return null;
    }

    const OP_METHODS = { "+": "__add__", "-": "__sub__", "*": "__mul__", "/": "__div__" };

    function arith(op, a, b) {
        if (op === "+" && typeof a === "string" && typeof b === "string") return a + b;
        if (isInt(a) && isInt(b)) {
            switch (op) {
                case "+": return checkInt(a + b, "add");
                case "-": return checkInt(a - b, "subtract");
                case "*": return checkInt(a * b, "multiply");
                case "/":
                    if (b === 0n) throw new OxPanic("attempt to divide by zero");
                    return checkInt(a / b, "divide");
                case "%":
                    if (b === 0n) throw new OxPanic("attempt to calculate the remainder with a divisor of zero");
                    return a % b;
            }
        }
        if (isFloat(a) && isFloat(b)) {
            switch (op) {
                case "+": return a + b;
                case "-": return a - b;
                case "*": return a * b;
                case "/": return a / b;
                case "%": return a % b;
            }
        }
        if (a instanceof OxStruct && OP_METHODS[op] && INTERP) {
            const r = INTERP.dispatchOp(OP_METHODS[op], a, [b]);
            if (r !== undefined) return r;
        }
        const kind = (v) => (isInt(v) ? "Int" : isFloat(v) ? "Float" : typeof v === "string" ? "Str" : null);
        if (kind(a) && kind(b) && kind(a) !== kind(b)) {
            throw new OxError(`type mismatch in arithmetic expression: ${kind(a)} vs ${kind(b)}${kind(a) !== "Str" && kind(b) !== "Str" ? " — convert one side with `as`" : ""}`);
        }
        throw new OxPanic(`type error in ${op}: cannot apply it to ${typeName(a)} and ${typeName(b)}`);
    }

    // ---------- interpreter ----------

    class Cell {
        constructor(value, ty, captured = false) {
            this.value = value;
            this.ty = ty;
            this.captured = captured;
        }
    }

    class Scope {
        constructor(parent, boundary = false) {
            this.parent = parent;
            this.boundary = boundary; // `let` reassigns names found up to here
            this.vars = new Map();
            this.fns = null; // nested `fn` declarations
        }
        find(name) {
            for (let s = this; s; s = s.parent) if (s.vars.has(name)) return s.vars.get(name);
            return null;
        }
        findLocal(name) {
            for (let s = this; s; s = s.parent) {
                if (s.vars.has(name)) return s.vars.get(name);
                if (s.boundary) break;
            }
            return null;
        }
        // The declared return type of the function this scope is inside.
        fnRet() {
            for (let s = this; s; s = s.parent) if (s.ret !== undefined) return s.ret;
            return null;
        }
        findFn(name) {
            for (let s = this; s; s = s.parent) if (s.fns && s.fns.has(name)) return s.fns.get(name);
            return null;
        }
    }

    const BREAK = { signal: "break" };
    const CONTINUE = { signal: "continue" };
    class Return {
        constructor(value) {
            this.value = value;
        }
    }
    class Exit {
        constructor(code) {
            this.code = code;
        }
    }

    const STEP_LIMIT = 20_000_000;
    const DEPTH_LIMIT = 3000;
    const DECLS = new Set(["Struct", "Enum", "Impl", "Trait", "Import"]);

    class Interpreter {
        constructor(onPrint) {
            this.onPrint = onPrint;
            this.fns = new Map();
            this.structs = new Map();
            this.enums = new Map([["Result", { name: "Result", variants: [{ name: "Ok", payload: [null] }, { name: "Err", payload: ["String"] }] }]]);
            this.traits = new Map();
            this.impls = [];
            this.methods = new Map();
            this.files = new Map(); // the in-memory folder behind read_file & co.
            this.steps = 0;
            this.depth = 0;
        }

        // Declarations anywhere — including structs, enums and impls written
        // inside a function — are registered up front, as the compiler hoists
        // them to the top level.
        declare(stmts) {
            for (const d of stmts) {
                const where = d.line ? ` (line ${d.line})` : "";
                switch (d.kind) {
                    case "Struct":
                        if (this.structs.has(d.name)) throw new OxError(`duplicate struct \`${d.name}\`${where}`);
                        this.structs.set(d.name, d);
                        break;
                    case "Enum":
                        this.enums.set(d.name, d);
                        break;
                    case "Trait":
                        this.traits.set(d.name, d);
                        break;
                    case "Impl":
                        this.impls.push(d);
                        for (const m of d.methods) this.declare(m.body);
                        break;
                    case "Fn":
                        this.declare(d.def.body);
                        break;
                    case "Import":
                        throw new OxError(`\`import "${d.path}"\` needs files next to this one, so it only works with the real \`oxidized\` CLI, not in the playground${where}`);
                    default:
                        for (const key of ["then", "otherwise", "body"]) if (Array.isArray(d[key])) this.declare(d[key]);
                }
            }
        }

        run(program) {
            for (const d of program) {
                if (d.kind === "Fn") {
                    if (this.fns.has(d.def.name)) throw new OxError(`duplicate function \`${d.def.name}\` (line ${d.line})`);
                    this.fns.set(d.def.name, new OxFunc(d.def, null));
                }
            }
            this.declare(program);
            for (const impl of this.impls) {
                if (impl.name.includes("::") || (impl.traitName && impl.traitName.includes("::"))) {
                    throw new OxError(`\`impl ${impl.traitName ? impl.traitName + " for " : ""}${impl.name}\` refers to an imported module, and imports aren't available in the playground`);
                }
                if (!this.structs.has(impl.name)) throw new OxError(`\`impl ${impl.name}\` for a struct that doesn't exist`);
                if (!this.methods.has(impl.name)) this.methods.set(impl.name, new Map());
                const table = this.methods.get(impl.name);
                for (const m of impl.methods) {
                    if (table.has(m.name)) throw new OxError(`struct \`${impl.name}\` defines method \`${m.name}\` twice`);
                    table.set(m.name, new OxFunc(m, null));
                }
                if (impl.traitName) {
                    const tr = this.traits.get(impl.traitName);
                    if (!tr) throw new OxError(`unknown trait \`${impl.traitName}\` in \`impl ${impl.traitName} for ${impl.name}\``);
                    for (const sig of tr.methods) {
                        if (impl.methods.some((m) => m.name === sig.name)) continue;
                        if (!sig.body) throw new OxError(`\`impl ${tr.name} for ${impl.name}\` is missing method \`${sig.name}\``);
                        if (table.has(sig.name)) throw new OxError(`struct \`${impl.name}\` defines method \`${sig.name}\` twice`);
                        table.set(sig.name, new OxFunc(sig, null));
                    }
                }
            }
            const main = this.fns.get("main");
            if (!main) throw new OxError("no `fn main()` — execution starts there");
            const out = this.callFunction(main, [], "main");
            if (out instanceof OxEnum && out.type === "Result" && out.variant === "Err") return "error: " + show(out.payload[0]);
            return null;
        }

        tick() {
            if (++this.steps > STEP_LIMIT) throw new OxPanic("execution step limit reached — infinite loop?");
        }

        // Runs a block's statements; nested `fn`s are visible throughout it.
        // Errors get the line of the innermost statement that raised them.
        execBlock(stmts, scope) {
            if (stmts.hasFns === undefined) stmts.hasFns = stmts.some((s) => s.kind === "Fn");
            if (stmts.hasFns) {
                if (!scope.fns) scope.fns = new Map();
                for (const s of stmts) if (s.kind === "Fn") scope.fns.set(s.def.name, new OxFunc(s.def, null));
            }
            let last;
            for (const s of stmts) {
                try {
                    last = this.exec(s, scope);
                } catch (err) {
                    if ((err instanceof OxPanic || err instanceof OxError) && !err.lined) {
                        err.lined = true;
                        if (s.line && !/\(line \d+\)/.test(err.message)) err.message += ` (line ${s.line})`;
                    }
                    throw err;
                }
            }
            return last;
        }

        // Executes a statement. Returns the value an expression statement or
        // an `if ... else ...` produced, which is what a block evaluates to.
        exec(s, scope) {
            this.tick();
            switch (s.kind) {
                case "Let": {
                    let value = FLOAT_TYPES.has(s.ty) ? this.evalFloat(s.value, scope) : this.eval(s.value, scope);
                    if (isInt(value) && primitive(s.ty) === "f64" && s.value.kind === "Lit") {
                        throw new OxError(`type mismatch: \`${s.name}\` is annotated ${s.ty} but assigned an Int — write a float literal or use \`as ${s.ty}\``);
                    }
                    this.bind(scope, s.name, value, s.ty);
                    return undefined;
                }
                case "LetPattern": {
                    const value = this.eval(s.value, scope);
                    const binds = [];
                    if (!this.matchPattern(s.pattern, value, binds, true)) throw new OxPanic(`pattern doesn't match ${show(value)}`);
                    for (const [name, v] of binds) this.bind(scope, name, v, null);
                    return undefined;
                }
                case "Assign":
                    this.assign(s, scope);
                    return undefined;
                case "Fn":
                    return undefined;
                case "Return": {
                    const fnRet = scope.fnRet();
                    throw new Return(!s.value ? null : FLOAT_TYPES.has(fnRet) ? this.evalFloat(s.value, scope) : this.eval(s.value, scope));
                }
                case "If": {
                    let r;
                    if (truthy(this.eval(s.cond, scope))) r = this.execBlock(s.then, new Scope(scope));
                    else if (s.otherwise) r = this.execBlock(s.otherwise, new Scope(scope));
                    return s.otherwise ? r : undefined;
                }
                case "While": {
                    while (truthy(this.eval(s.cond, scope))) {
                        this.tick();
                        try {
                            this.execBlock(s.body, new Scope(scope));
                        } catch (sig) {
                            if (sig === BREAK) break;
                            if (sig === CONTINUE) continue;
                            throw sig;
                        }
                    }
                    return undefined;
                }
                case "For": {
                    const list = this.eval(s.iter, scope);
                    if (!Array.isArray(list)) throw new OxPanic(`type error: expected List, got ${debug(list)}`);
                    for (const item of list) {
                        this.tick();
                        const inner = new Scope(scope);
                        inner.vars.set(s.name, new Cell(item, null));
                        try {
                            this.execBlock(s.body, inner);
                        } catch (sig) {
                            if (sig === BREAK) break;
                            if (sig === CONTINUE) continue;
                            throw sig;
                        }
                    }
                    return undefined;
                }
                case "Break":
                    throw BREAK;
                case "Continue":
                    throw CONTINUE;
                case "Expr":
                    return this.eval(s.expr, scope);
                default:
                    if (DECLS.has(s.kind)) return undefined;
                    throw new OxError(`can't run ${s.kind}`);
            }
        }

        // `let`: re-`let`-ing a name in the same function reassigns it.
        bind(scope, name, value, ty) {
            const existing = scope.findLocal(name);
            if (existing) {
                const t = ty || existing.ty;
                existing.value = t ? coerce(value, t, `\`${name}\``) : value;
                if (ty) existing.ty = ty;
            } else {
                scope.vars.set(name, new Cell(ty ? coerce(value, ty, `\`${name}\``) : value, ty));
            }
        }

        // `x = v`, `x += v`, `xs[i].f = v`, `m[k] += 1`: the value and every
        // index are evaluated first, then the path rooted at the variable is
        // rebuilt with the new value.
        assign(s, scope) {
            const root = placeRoot(s.target);
            const cell = scope.find(root.name);
            if (!cell) throw new OxError(`assignment to undeclared variable \`${root.name}\` — declare it with \`let\` first`);
            let value = this.eval(s.value, scope);
            const path = [];
            for (let e = s.target; e !== root; e = e.target) {
                path.unshift(e.kind === "Field" ? { field: e.field } : { key: this.eval(e.index, scope) });
            }
            if (path.length && cell.ty && primitive(cell.ty) && primitive(cell.ty) !== "List") {
                throw new OxError(`\`${root.name}\` is a ${typeText(cell.ty)}, so there's nothing to assign into`);
            }
            if (s.op) value = arith(s.op, this.getIn(cell.value, path), value);
            cell.value = this.setIn(cell.value, path, value, root.name);
            if (!path.length && cell.ty) cell.value = coerce(cell.value, cell.ty, `\`${root.name}\``);
            if (cell.isSelf) cell.dirty = true;
        }

        getIn(v, path) {
            for (const step of path) v = step.field !== undefined ? this.field(v, step.field) : this.index(v, step.key);
            return v;
        }

        setIn(v, path, value, what) {
            if (!path.length) return value;
            const [step, ...rest] = path;
            if (step.field !== undefined) {
                if (!(v instanceof OxStruct)) throw new OxPanic(`type error: cannot set field \`${step.field}\` on ${debug(v)}`);
                const def = this.structs.get(v.name);
                const f = def && def.fields.find((d) => d.name === step.field);
                if (!f) throw new OxError(`struct \`${v.name}\` has no field \`${step.field}\``);
                const inner = this.setIn(v.get(step.field), rest, value, what);
                const typeParams = new Set(def.typeParams);
                return v.with(step.field, typeParams.has(f.ty) ? inner : coerce(inner, f.ty, `field \`${v.name}.${step.field}\``));
            }
            const k = step.key;
            if (v instanceof OxMap) {
                const hit = v.lookup(k);
                if (rest.length && !hit) throw new OxPanic(`no entry for key ${debug(k)}`);
                return v.set(k, this.setIn(hit ? hit[1] : null, rest, value, what));
            }
            if (Array.isArray(v)) {
                if (!isInt(k)) throw new OxPanic(`type error: list indexes are Ints, got ${debug(k)}`);
                if (k < 0n || k >= BigInt(v.length)) throw new OxPanic(`index ${k} out of bounds (len ${v.length})`);
                const out = v.slice();
                out[Number(k)] = this.setIn(v[Number(k)], rest, value, what);
                return out;
            }
            if (v instanceof OxTuple || typeof v === "string") throw new OxError(`${typeName(v)}s can't be assigned into (\`${what}[...] = ...\`)`);
            throw new OxPanic(`type error: cannot index into ${debug(v)}`);
        }

        field(target, name) {
            if (!(target instanceof OxStruct)) throw new OxPanic(`type error: cannot access field \`${name}\` on ${debug(target)}`);
            return target.get(name);
        }

        index(target, key) {
            if (target instanceof OxMap) {
                const hit = target.lookup(key);
                if (!hit) throw new OxPanic(`no entry for key ${debug(key)}`);
                return hit[1];
            }
            if (!isInt(key)) throw new OxPanic(`type error: expected Int, got ${debug(key)}`);
            const items = Array.isArray(target) ? target : target instanceof OxTuple ? target.items : typeof target === "string" ? Array.from(target) : null;
            if (!items) throw new OxPanic(`type error: cannot index into ${debug(target)}`);
            if (key < 0n || key >= BigInt(items.length)) throw new OxPanic(`index ${key} out of bounds (len ${items.length})`);
            return items[Number(key)];
        }

        // An expression whose value lands in a Float slot (a `-> Float`
        // return, a `let x: Float`): the compiler evaluates its arithmetic in
        // f64, so Int operands are converted first.
        evalFloat(e, scope) {
            if (e.kind === "Binary" && ARITH.has(e.op)) {
                const num = (v) => (isInt(v) ? Number(v) : v);
                return arith(e.op, num(this.evalFloat(e.lhs, scope)), num(this.evalFloat(e.rhs, scope)));
            }
            return this.eval(e, scope);
        }

        evalBody(body, scope) {
            if (body.kind !== "Block") return this.eval(body, scope);
            const r = this.execBlock(body.stmts, new Scope(scope));
            return r === undefined ? null : r;
        }

        eval(e, scope) {
            switch (e.kind) {
                case "Lit":
                    return e.value;
                case "List":
                    return e.items.map((x) => this.eval(x, scope));
                case "Tuple":
                    return new OxTuple(e.items.map((x) => this.eval(x, scope)));
                case "Var": {
                    const cell = scope.find(e.name);
                    if (cell) return cell.value;
                    const fn = scope.findFn(e.name) || this.fns.get(e.name);
                    if (fn) {
                        if (fn.def.ret || fn.def.params.some((p) => p.ty)) {
                            throw new OxError(`\`${e.name}\` has type annotations, so it can't be used as a value — only fully untyped functions can be passed around`);
                        }
                        return fn;
                    }
                    throw new OxError(`undefined variable \`${e.name}\` (line ${e.line})`);
                }
                case "Unary": {
                    const v = this.eval(e.expr, scope);
                    if (e.op === "!") return !truthy(v);
                    if (isInt(v)) return checkInt(-v, "negate");
                    if (isFloat(v)) return -v;
                    if (v instanceof OxStruct) {
                        const r = this.dispatchOp("__neg__", v, []);
                        if (r !== undefined) return r;
                    }
                    throw new OxPanic("type error in unary -");
                }
                case "Binary": {
                    if (e.op === "&&") return truthy(this.eval(e.lhs, scope)) && truthy(this.eval(e.rhs, scope));
                    if (e.op === "||") return truthy(this.eval(e.lhs, scope)) || truthy(this.eval(e.rhs, scope));
                    let a = this.eval(e.lhs, scope);
                    let b = this.eval(e.rhs, scope);
                    // A statically Float operand (a float literal or an `as
                    // Float` cast) makes the compiler do the arithmetic in f64.
                    if (isInt(a) && isFloat(b) && staticFloat(e.rhs)) a = Number(a);
                    else if (isFloat(a) && isInt(b) && staticFloat(e.lhs)) b = Number(b);
                    switch (e.op) {
                        case "==": return eq(a, b);
                        case "!=": return !eq(a, b);
                        case "<": return cmp(a, b) === -1;
                        case ">": return cmp(a, b) === 1;
                        case "<=": { const c = cmp(a, b); return c === -1 || c === 0; }
                        case ">=": { const c = cmp(a, b); return c === 1 || c === 0; }
                        default: return arith(e.op, a, b);
                    }
                }
                case "Index":
                    return this.index(this.eval(e.target, scope), this.eval(e.index, scope));
                case "Field":
                    return this.field(this.eval(e.target, scope), e.field);
                case "Cast": {
                    const v = this.eval(e.value, scope);
                    if (typeof e.ty === "string" && !primitive(e.ty) && !this.structs.has(e.ty) && !this.enums.has(e.ty) && !/^[A-Z]/.test(e.ty)) {
                        throw new OxError(`\`${e.ty}\` isn't a type (line ${e.line})`);
                    }
                    return cast(v, e.ty);
                }
                case "Lambda":
                    return new OxFunc({ name: "<lambda>", params: e.params.map((name) => ({ name, ty: null })), ret: null, body: e.body, lambda: true }, this.captureFrom(scope));
                case "StructInit":
                    return this.construct(e, scope);
                case "EnumInit":
                    return this.enumInit(e, scope);
                case "IfExpr": {
                    const branch = truthy(this.eval(e.cond, scope)) ? e.then : e.otherwise;
                    const r = this.execBlock(branch, new Scope(scope));
                    return r === undefined ? null : r;
                }
                case "Block":
                    return this.evalBody(e, scope);
                case "Match":
                    return this.match(e, scope);
                case "Try": {
                    const r = this.eval(e.expr, scope);
                    if (!(r instanceof OxEnum) || r.type !== "Result") throw new OxPanic(`type error: \`?\` expects a Result, got ${debug(r)}`);
                    if (r.variant === "Ok") return r.payload[0];
                    throw new Return(r);
                }
                case "Call":
                    if (e.callee) {
                        const fn = this.eval(e.callee, scope);
                        return this.callFunction(fn, e.args.map((a) => this.eval(a, scope)), "<lambda>");
                    }
                    return this.call(e, scope);
                case "MethodCall":
                    return this.methodCall(e, scope);
            }
            throw new OxError(`can't evaluate ${e.kind}`);
        }

        // Every variable a lambda can see is copied into its own cells when
        // the lambda is created. Cells that already belong to an enclosing
        // lambda are shared rather than copied, so nested lambdas see the
        // same persistent state as the lambda they're nested in.
        captureFrom(scope) {
            const cap = new Scope(null, true);
            for (let s = scope; s; s = s.parent) {
                for (const [name, cell] of s.vars) {
                    if (cap.vars.has(name)) continue;
                    cap.vars.set(name, cell.captured ? cell : new Cell(cell.value, cell.ty, true));
                }
                if (s.fns) {
                    if (!cap.fns) cap.fns = new Map();
                    for (const [name, fn] of s.fns) if (!cap.fns.has(name)) cap.fns.set(name, fn);
                }
            }
            return cap;
        }

        // Named fields, given in any order, each exactly once.
        namedFields(names, given, label, line) {
            const byName = new Map();
            for (const f of given) {
                if (!names.includes(f.name)) throw new OxError(`${label} has no field \`${f.name}\` (line ${line})`);
                if (byName.has(f.name)) throw new OxError(`field \`${f.name}\` given twice (line ${line})`);
                byName.set(f.name, f.value);
            }
            const missing = names.filter((n) => !byName.has(n));
            if (missing.length) throw new OxError(`${label} is missing field(s): ${missing.join(", ")} (line ${line})`);
            return byName;
        }

        construct(e, scope) {
            if (e.name.includes("::")) {
                const [enumName, variant] = e.name.split("::");
                const en = this.enums.get(enumName);
                const v = en && en.variants.find((x) => x.name === variant);
                if (!v) throw new OxError(`\`${e.name}\` refers to an imported module, and imports aren't available in the playground (line ${e.line})`);
                if (!v.fields) throw new OxError(`\`${e.name}\` is a tuple-style variant — construct it with positional values (line ${e.line})`);
                const given = this.namedFields(v.fields, e.fields, `variant \`${e.name}\``, e.line);
                return new OxEnum(enumName, variant, v.fields.map((f, i) => coerce(this.eval(given.get(f), scope), v.payload[i], `\`${e.name}\`'s field \`${f}\``)));
            }
            const def = this.structs.get(e.name);
            if (!def) throw new OxError(`unknown struct \`${e.name}\` (line ${e.line})`);
            const given = this.namedFields(def.fields.map((d) => d.name), e.fields, `struct \`${e.name}\``, e.line);
            const typeParams = new Set(def.typeParams);
            return new OxStruct(
                e.name,
                def.fields.map((d) => {
                    const v = this.eval(given.get(d.name), scope);
                    return [d.name, typeParams.has(d.ty) ? v : coerce(v, d.ty, `field \`${e.name}.${d.name}\``)];
                })
            );
        }

        enumInit(e, scope) {
            const en = this.enums.get(e.enumName);
            if (!en) throw new OxError(`unknown enum \`${e.enumName}\` in \`${e.enumName}::${e.variant}(...)\` — if that's an imported module, imports aren't available in the playground (line ${e.line})`);
            const variant = en.variants.find((v) => v.name === e.variant);
            if (!variant) throw new OxError(`enum \`${e.enumName}\` has no variant \`${e.variant}\` (line ${e.line})`);
            if (variant.fields) throw new OxError(`\`${e.enumName}::${e.variant}\` has named fields — construct it as \`${e.enumName}::${e.variant}(${variant.fields.map((f) => f + ": ...").join(", ")})\` (line ${e.line})`);
            if (variant.payload.length !== e.args.length) {
                throw new OxError(`\`${e.enumName}::${e.variant}\` takes ${variant.payload.length} value(s), got ${e.args.length} (line ${e.line})`);
            }
            const payload = e.args.map((a, i) => coerce(this.eval(a, scope), variant.payload[i], `\`${e.enumName}::${e.variant}\`'s payload`));
            return new OxEnum(e.enumName, e.variant, payload);
        }

        // `Name(...)`/`Name {...}` in a pattern is a struct when `Name` is a
        // struct and no enum declares a variant of that name.
        isStructPattern(p) {
            if (p.enumName || !this.structs.has(p.name)) return false;
            for (const en of this.enums.values()) if (en.variants.some((v) => v.name === p.name)) return false;
            return true;
        }

        variantDef(type, name) {
            const en = this.enums.get(type);
            return en && en.variants.find((v) => v.name === name);
        }

        // Matches `v` against `p`, pushing [name, value] bindings.
        matchPattern(p, v, binds, destructuring = false) {
            switch (p.kind) {
                case "Wildcard":
                    return true;
                case "Binding":
                    if (binds.some(([n]) => n === p.name)) throw new OxError(`\`${p.name}\` is bound twice in one pattern`);
                    binds.push([p.name, v]);
                    return true;
                case "Literal":
                    return eq(v, p.value);
                case "Tuple": {
                    if (!(v instanceof OxTuple)) {
                        if (destructuring) throw new OxPanic(`type error: expected a tuple of ${p.items.length} element(s), got ${debug(v)}`);
                        return false;
                    }
                    if (v.items.length !== p.items.length) {
                        if (destructuring) throw new OxPanic(`type error: expected a tuple of ${p.items.length} element(s), got one with ${v.items.length}`);
                        return false;
                    }
                    return p.items.every((sub, i) => this.matchPattern(sub, v.items[i], binds, destructuring));
                }
                case "Variant":
                case "Fields": {
                    if (this.isStructPattern(p)) {
                        if (!(v instanceof OxStruct) || v.name !== p.name) return false;
                        const def = this.structs.get(p.name);
                        if (p.kind === "Variant") {
                            if (p.subs.length !== def.fields.length) throw new OxError(`pattern \`${p.name}(...)\` has ${p.subs.length} field(s), but \`${p.name}\` declares ${def.fields.length} (line ${p.line})`);
                            return p.subs.every((sub, i) => this.matchPattern(sub, v.fields[i][1], binds));
                        }
                        return this.matchFields(p, def.fields.map((f) => f.name), (f) => v.get(f), binds);
                    }
                    if (v === null) return false; // None matches no variant
                    if (!(v instanceof OxEnum)) throw new OxPanic(`type error: expected an enum value, got ${debug(v)}`);
                    if (p.enumName && p.enumName !== v.type && this.enums.has(p.enumName)) return false;
                    if (v.variant !== p.name) return false;
                    const def = this.variantDef(v.type, v.variant);
                    if (p.kind === "Variant") {
                        if (p.subs.length !== v.payload.length) {
                            throw new OxError(`pattern \`${p.name}(...)\` binds ${p.subs.length} value(s), but \`${p.name}\` carries ${v.payload.length} (line ${p.line})`);
                        }
                        return p.subs.every((sub, i) => this.matchPattern(sub, v.payload[i], binds));
                    }
                    if (!def || !def.fields) throw new OxError(`\`${p.name}\` isn't a struct-style variant, so it can't be matched with \`{ ... }\` (line ${p.line})`);
                    return this.matchFields(p, def.fields, (f) => v.payload[def.fields.indexOf(f)], binds);
                }
            }
            return false;
        }

        matchFields(p, names, get, binds) {
            for (const [f] of p.fields) if (!names.includes(f)) throw new OxError(`\`${p.name}\` has no field \`${f}\` (line ${p.line})`);
            if (!p.rest && p.fields.length !== names.length) {
                const missing = names.filter((n) => !p.fields.some(([f]) => f === n));
                throw new OxError(`pattern \`${p.name} { ... }\` doesn't mention ${missing.join(", ")} — list every field or end with \`..\` (line ${p.line})`);
            }
            return p.fields.every(([f, sub]) => this.matchPattern(sub, get(f), binds));
        }

        match(e, scope) {
            const v = this.eval(e.scrutinee, scope);
            if (v instanceof OxEnum) this.checkExhaustive(v, e);
            for (const arm of e.arms) {
                const binds = [];
                if (!this.matchPattern(arm.pattern, v, binds)) continue;
                const bound = new Scope(scope);
                for (const [name, x] of binds) bound.vars.set(name, new Cell(x, null));
                if (arm.guard && !truthy(this.eval(arm.guard, bound))) continue;
                return this.evalBody(arm.body, bound);
            }
            throw new OxPanic(`no match arm matched ${show(v)} (line ${e.line})`);
        }

        // Top-level coverage: every variant needs an unguarded arm unless an
        // unguarded catch-all exists. (The real checker also looks inside
        // nested patterns.)
        checkExhaustive(v, e) {
            const en = this.enums.get(v.type);
            if (!en) return;
            const arms = e.arms.filter((a) => !a.guard);
            if (arms.some((a) => a.pattern.kind === "Wildcard" || a.pattern.kind === "Binding")) return;
            const covered = new Set(arms.filter((a) => a.pattern.kind === "Variant" || a.pattern.kind === "Fields").map((a) => a.pattern.name));
            const missing = en.variants.map((x) => x.name).filter((n) => !covered.has(n));
            if (missing.length) {
                throw new OxError(`non-exhaustive match on \`${en.name}\`: not covered: ${missing.map((m) => en.name + "::" + m).join(", ")} — add those arms or a \`_\` arm (line ${e.line})`);
            }
        }

        call(e, scope) {
            const cell = scope.find(e.name);
            if (cell) {
                if (!(cell.value instanceof OxFunc)) throw new OxPanic(`type error: expected a function, got ${debug(cell.value)}`);
                return this.callFunction(cell.value, e.args.map((a) => this.eval(a, scope)), e.name);
            }
            const fn = scope.findFn(e.name) || this.fns.get(e.name);
            if (fn) return this.callFunction(fn, e.args.map((a) => this.eval(a, scope)), e.name);
            if (this.structs.has(e.name) && !e.args.length) return this.construct({ name: e.name, fields: [], line: e.line }, scope);
            if (["len", "push", "slice"].includes(e.name) && e.args.length) {
                const recv = this.eval(e.args[0], scope);
                if (recv instanceof OxStruct && this.methods.get(recv.name)?.has(e.name)) {
                    return this.invokeMethod(recv, e.name, e.args.slice(1).map((a) => this.eval(a, scope)), e.args[0], scope, e.line);
                }
                return this.builtin(e.name, [recv, ...e.args.slice(1).map((a) => this.eval(a, scope))], e.line);
            }
            if (!Object.prototype.hasOwnProperty.call(BUILTINS, e.name)) throw new OxError(`undefined function \`${e.name}\` (line ${e.line})`);
            return this.builtin(e.name, e.args.map((a) => this.eval(a, scope)), e.line);
        }

        builtin(name, args, line) {
            if (name === "print") {
                const text = args.map(show).join(" ");
                for (const l of text.split("\n")) this.onPrint(l);
                return null;
            }
            if (name === "assert") {
                if (args.length < 1 || args.length > 2) throw new OxError(`assert() takes 1 or 2 arguments, got ${args.length} (line ${line})`);
                if (typeof args[0] !== "boolean") throw new OxPanic(`type error: expected Bool, got ${debug(args[0])}`);
                if (!args[0]) throw new OxPanic(args.length > 1 ? show(args[1]) : "assertion failed");
                return null;
            }
            const [arity, impl] = BUILTINS[name];
            if (args.length !== arity) throw new OxError(`\`${name}\` takes ${arity} argument(s), got ${args.length} (line ${line})`);
            return impl.apply(this, args);
        }

        methodCall(e, scope) {
            const recv = this.eval(e.receiver, scope);
            const args = e.args.map((a) => this.eval(a, scope));
            if (!(recv instanceof OxStruct)) throw new OxError(`can't call method \`${e.method}\` on ${typeName(recv)} ${show(recv)} — methods only exist on structs (line ${e.line})`);
            return this.invokeMethod(recv, e.method, args, e.receiver, scope, e.line);
        }

        // Runs a method with `self` bound; if the method assigned to self's
        // fields and the receiver is a place rooted at a variable, that
        // variable sees the change. Dispatch is on the value's struct.
        invokeMethod(recv, method, args, receiverExpr, scope, line) {
            const fn = this.methods.get(recv.name)?.get(method);
            if (!fn) throw new OxPanic(`struct \`${recv.name}\` has no method \`${method}\` (line ${line})`);
            const [first, ...rest] = fn.def.params;
            if (!first || first.name !== "self") throw new OxError(`\`${recv.name}::${method}\` doesn't take \`self\`, so it can't be called as a method (line ${line})`);
            const selfCell = new Cell(recv, null);
            selfCell.isSelf = true;
            const result = this.callFunction(new OxFunc({ ...fn.def, params: rest }, null), args, `${recv.name}.${method}`, selfCell);
            const root = receiverExpr && placeRoot(receiverExpr);
            if (selfCell.dirty && root) {
                const target = scope.find(root.name);
                if (target) {
                    const path = [];
                    for (let x = receiverExpr; x !== root; x = x.target) path.unshift(x.kind === "Field" ? { field: x.field } : { key: this.eval(x.index, scope) });
                    target.value = this.setIn(target.value, path, selfCell.value, root.name);
                    if (target.isSelf) target.dirty = true;
                }
            }
            return result;
        }

        // `a + b` on a struct calls `a.__add__(b)`, `a == b` its `__eq__`, ...
        // undefined when the struct doesn't define the method.
        dispatchOp(method, recv, args) {
            const fn = this.methods.get(recv.name)?.get(method);
            if (!fn) return undefined;
            return this.invokeMethod(recv, method, args, null, null, null);
        }

        callFunction(fn, args, name, selfCell = null) {
            if (!(fn instanceof OxFunc)) throw new OxPanic(`type error: expected a function, got ${debug(fn)}`);
            const def = fn.def;
            if (def.native) throw new OxError(`\`${def.name}\` is a \`fn native\`, implemented by the Rust host program, so it can't run in the playground`);
            if (args.length !== def.params.length) throw new OxError(`\`${name}\` expects ${def.params.length} argument(s), got ${args.length}`);
            if (++this.depth > DEPTH_LIMIT) throw new OxPanic("recursion limit exceeded — the playground allows a few thousand nested calls; the real compiler runs main on a 1 GiB stack");
            const typeParams = new Set(def.typeParams || []);
            const frame = new Scope(fn.capture, !def.lambda);
            frame.ret = def.ret || null;
            if (selfCell) frame.vars.set("self", selfCell);
            def.params.forEach((p, i) => {
                const ty = typeParams.has(p.ty) ? null : p.ty;
                frame.vars.set(p.name, new Cell(ty ? coerce(args[i], ty, `\`${name}\`'s parameter \`${p.name}\``) : args[i], ty));
            });
            const typedRet = def.ret && name !== "main" && !typeParams.has(def.ret);
            try {
                this.execBlock(def.body, frame);
            } catch (sig) {
                if (sig instanceof Return) {
                    if (typedRet) return coerce(sig.value, def.ret, `\`${name}\`'s return value`);
                    return sig.value;
                }
                throw sig;
            } finally {
                this.depth--;
            }
            if (typedRet && def.ret !== "()") throw new OxError(`\`${name}\` is declared \`-> ${typeText(def.ret)}\` but can reach its end without returning a value`);
            return null;
        }
    }

    // ---------- builtins ----------

    const result = (variant, value) => new OxEnum("Result", variant, [value]);
    const ok = (v) => result("Ok", v);
    const err = (msg) => result("Err", msg);
    const asInt = (v) => {
        if (!isInt(v)) throw new OxPanic(`type error: expected Int, got ${debug(v)}`);
        return v;
    };
    const asF64 = (v) => {
        if (isFloat(v)) return v;
        if (isInt(v)) return Number(v);
        throw new OxPanic(`type error: expected Float, got ${debug(v)}`);
    };
    const asStr = (v) => {
        if (typeof v !== "string") throw new OxPanic(`type error: expected Str, got ${debug(v)}`);
        return v;
    };
    const strArg = (v, fn) => {
        if (typeof v !== "string") throw new OxPanic(`type error: ${fn}() expects a String, got ${debug(v)}`);
        return v;
    };
    const asList = (v, fn) => {
        if (!Array.isArray(v)) throw new OxPanic(`type error: ${fn}() expects a List, got ${debug(v)}`);
        return v;
    };
    const asMap = (m, fn) => {
        if (!(m instanceof OxMap)) throw new OxPanic(`type error: ${fn}() expects a Map, got ${debug(m)}`);
        return m;
    };
    const asResult = (r, fn) => {
        if (!(r instanceof OxEnum) || r.type !== "Result") throw new OxPanic(`type error: ${fn}() expects a Result, got ${debug(r)}`);
        return r;
    };
    const asFn = (f, fn) => {
        if (!(f instanceof OxFunc)) throw new OxPanic(`type error: ${fn}() expects a function, got ${debug(f)}`);
        return f;
    };
    function toI64(x) {
        if (Number.isNaN(x)) return 0n;
        if (x >= 9.223372036854776e18) return I64_MAX;
        if (x <= -9.223372036854776e18) return I64_MIN;
        return BigInt(Math.trunc(x));
    }
    const roundHalfAway = (x) => Math.sign(x) * Math.round(Math.abs(x));
    const wrap64 = (v) => BigInt.asIntN(64, v);
    const codePoint = (s, fn) => {
        const chars = Array.from(asStr(s));
        if (chars.length !== 1) return null;
        return BigInt(chars[0].codePointAt(0));
    };
    const fromCodePoint = (n) => {
        n = asInt(n);
        if (n < 0n || n > 0x10ffffn || (n >= 0xd800n && n <= 0xdfffn)) return null;
        return String.fromCodePoint(Number(n));
    };
    const checked = (v, op) => (v > I64_MAX || v < I64_MIN ? err(`integer overflow in ${op}`) : ok(v));
    const NO_NET = "http_get isn't available in the browser playground — run it with the real `oxidized` CLI";

    // Strict JSON (RFC 8259): objects become Maps, integers Ints, other
    // numbers Floats, null None.
    function jsonParse(text) {
        let i = 0;
        const fail = (msg) => {
            const before = text.slice(0, i);
            const line = before.split("\n").length;
            const col = i - before.lastIndexOf("\n");
            throw new Error(`invalid JSON: ${msg} at line ${line} column ${col}`);
        };
        const ws = () => {
            while (i < text.length && " \t\n\r".includes(text[i])) i++;
        };
        function value(depth) {
            if (depth > 200) fail("nesting is too deep");
            ws();
            if (i >= text.length) fail("unexpected end of input");
            const c = text[i];
            if (c === "{") {
                i++;
                let m = new OxMap();
                ws();
                if (text[i] === "}") {
                    i++;
                    return m;
                }
                for (;;) {
                    ws();
                    if (text[i] !== '"') fail("expected a string key");
                    const k = string();
                    ws();
                    if (text[i] !== ":") fail("expected ':'");
                    i++;
                    m = m.set(k, value(depth + 1));
                    ws();
                    if (text[i] === ",") i++;
                    else if (text[i] === "}") {
                        i++;
                        return m;
                    } else fail("expected ',' or '}'");
                }
            }
            if (c === "[") {
                i++;
                const out = [];
                ws();
                if (text[i] === "]") {
                    i++;
                    return out;
                }
                for (;;) {
                    out.push(value(depth + 1));
                    ws();
                    if (text[i] === ",") i++;
                    else if (text[i] === "]") {
                        i++;
                        return out;
                    } else fail("expected ',' or ']'");
                }
            }
            if (c === '"') return string();
            for (const [word, v] of [["true", true], ["false", false], ["null", null]]) {
                if (text.startsWith(word, i)) {
                    i += word.length;
                    return v;
                }
            }
            const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
            if (!m || !m[0] || m[0] === "-") fail(i >= text.length ? "unexpected end of input" : "unexpected character");
            i += m[0].length;
            if (!m[2] && !m[3]) {
                const n = BigInt(m[0]);
                if (n <= I64_MAX && n >= I64_MIN) return n;
            }
            return parseFloat(m[0]);
        }
        function string() {
            i++;
            let s = "";
            for (;;) {
                if (i >= text.length) fail("unterminated string");
                const c = text[i++];
                if (c === '"') return s;
                if (c === "\\") {
                    const e = text[i++];
                    const map = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
                    if (e in map) s += map[e];
                    else if (e === "u") {
                        const hex = text.slice(i, i + 4);
                        if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("bad \\u escape");
                        i += 4;
                        s += String.fromCharCode(parseInt(hex, 16));
                    } else fail("bad escape");
                } else if (c < " ") fail("control character in string");
                else s += c;
            }
        }
        const v = value(0);
        ws();
        if (i < text.length) fail("unexpected trailing characters");
        return v;
    }

    function jsonWrite(v, pretty, level) {
        const pad = (l) => (pretty ? "\n" + "  ".repeat(l) : "");
        const sep = pretty ? ": " : ":";
        if (v === null) return "null";
        if (typeof v === "boolean") return String(v);
        if (isInt(v)) return v.toString();
        if (isFloat(v)) {
            if (!Number.isFinite(v)) throw new Error("cannot serialize a non-finite Float (NaN or infinity) as JSON");
            return debugFloat(v);
        }
        if (typeof v === "string") return JSON.stringify(v);
        const items = Array.isArray(v) ? v : v instanceof OxTuple ? v.items : null;
        if (items) return items.length ? "[" + items.map((x) => pad(level + 1) + jsonWrite(x, pretty, level + 1)).join(",") + pad(level) + "]" : "[]";
        let pairs = null;
        if (v instanceof OxMap) {
            pairs = v.entries.map(([k, x]) => {
                if (typeof k !== "string") throw new Error(`JSON object keys must be Strings, got ${debug(k)}`);
                return [k, x];
            });
        } else if (v instanceof OxStruct) pairs = v.fields;
        if (pairs) return pairs.length ? "{" + pairs.map(([k, x]) => pad(level + 1) + JSON.stringify(k) + sep + jsonWrite(x, pretty, level + 1)).join(",") + pad(level) + "}" : "{}";
        if (v instanceof OxEnum) throw new Error(`cannot serialize the enum value ${v.type}::${v.variant} as JSON`);
        throw new Error("cannot serialize a function as JSON");
    }

    const jsonEmit = (v, pretty) => {
        try {
            return ok(jsonWrite(v, pretty, 0));
        } catch (e) {
            return err(e.message);
        }
    };

    const t0 = Date.now();

    // Each entry: [arity, implementation]; `this` is the interpreter.
    const BUILTINS = {
        print: [0, null],
        assert: [0, null],
        range: [2, (a, b) => {
            const out = [];
            for (let i = asInt(a); i < asInt(b); i++) {
                if (out.length > 1_000_000) throw new OxPanic("range too large for the playground");
                out.push(i);
            }
            return out;
        }],
        len: [1, (v) => {
            if (Array.isArray(v)) return BigInt(v.length);
            if (v instanceof OxTuple) return BigInt(v.items.length);
            if (typeof v === "string") return BigInt(Array.from(v).length);
            if (v instanceof OxMap) return BigInt(v.entries.length);
            throw new OxPanic(`type error: len() expects a List, String, or Map, got ${debug(v)}`);
        }],
        push: [2, (list, v) => [...asList(list, "push"), v]],
        slice: [3, (v, start, end) => {
            const s = asInt(start) < 0n ? 0 : Number(start);
            let e = asInt(end) < 0n ? 0 : Number(end);
            e = Math.max(e, s);
            if (typeof v === "string") {
                const chars = Array.from(v);
                const ee = Math.min(e, chars.length);
                return chars.slice(Math.min(s, ee), ee).join("");
            }
            if (Array.isArray(v)) {
                const ee = Math.min(e, v.length);
                return v.slice(Math.min(s, ee), ee);
            }
            throw new OxPanic(`type error: slice() expects a List or String, got ${debug(v)}`);
        }],
        args: [0, () => ["playground.ox"]],
        read_line: [0, () => null],
        int: [1, (v) => cast(v, "Int")],
        float: [1, (v) => cast(v, "Float")],
        str: [1, (v) => show(v)],
        bool: [1, (v) => {
            if (typeof v === "boolean") return v;
            if (isInt(v)) return v !== 0n;
            if (isFloat(v)) return v !== 0;
            if (typeof v === "string") return v !== "";
            throw new OxPanic(`type error: bool() expects Int, Float, String, or Bool, got ${debug(v)}`);
        }],
        map_new: [0, () => new OxMap()],
        map_set: [3, (m, k, v) => asMap(m, "map_set").set(k, v)],
        map_get: [2, (m, k) => {
            const hit = asMap(m, "map_get").lookup(k);
            if (!hit) throw new OxPanic(`map_get(): no entry for key ${debug(k)}`);
            return hit[1];
        }],
        map_has: [2, (m, k) => asMap(m, "map_has").lookup(k) !== undefined],
        map_remove: [2, (m, k) => asMap(m, "map_remove").remove(k)],
        map_keys: [1, (m) => asMap(m, "map_keys").entries.map(([k]) => k)],
        map_values: [1, (m) => asMap(m, "map_values").entries.map(([, v]) => v)],
        abs: [1, (x) => {
            if (isInt(x)) return checkInt(x < 0n ? -x : x, "negate");
            if (isFloat(x)) return Math.abs(x);
            throw new OxPanic(`type error: abs() expects an Int or Float, got ${debug(x)}`);
        }],
        min: [2, (a, b) => {
            if (isInt(a) && isInt(b)) return a < b ? a : b;
            if (isFloat(a) || isFloat(b)) return Math.min(asF64(a), asF64(b));
            throw new OxPanic(`type error: min() expects two Ints/Floats, got ${debug(a)} and ${debug(b)}`);
        }],
        max: [2, (a, b) => {
            if (isInt(a) && isInt(b)) return a > b ? a : b;
            if (isFloat(a) || isFloat(b)) return Math.max(asF64(a), asF64(b));
            throw new OxPanic(`type error: max() expects two Ints/Floats, got ${debug(a)} and ${debug(b)}`);
        }],
        sqrt: [1, (x) => Math.sqrt(asF64(x))],
        pow: [2, (b, e) => Math.pow(asF64(b), asF64(e))],
        floor: [1, (x) => toI64(Math.floor(asF64(x)))],
        ceil: [1, (x) => toI64(Math.ceil(asF64(x)))],
        round: [1, (x) => toI64(roundHalfAway(asF64(x)))],
        upper: [1, (s) => asStr(s).toUpperCase()],
        lower: [1, (s) => asStr(s).toLowerCase()],
        trim: [1, (s) => asStr(s).trim()],
        split: [2, (s, sep) => (asStr(sep) === "" ? Array.from(asStr(s)) : asStr(s).split(sep))],
        join: [2, (list, sep) => {
            asStr(sep);
            return asList(list, "join").map(show).join(sep);
        }],
        contains: [2, (h, n) => {
            if (typeof h === "string") return h.includes(asStr(n));
            if (Array.isArray(h)) return h.some((x) => eq(x, n));
            throw new OxPanic(`type error: contains() expects a List or String, got ${debug(h)}`);
        }],
        starts_with: [2, (s, p) => asStr(s).startsWith(asStr(p))],
        ends_with: [2, (s, p) => asStr(s).endsWith(asStr(p))],
        replace: [3, (s, a, b) => asStr(s).split(asStr(a)).join(asStr(b))],
        sort: [1, (list) => {
            const order = (a, b) => {
                const nums = (isInt(a) || isFloat(a)) && (isInt(b) || isFloat(b));
                const same = typeName(a) === typeName(b) && ["String", "Bool"].includes(typeName(a));
                const structs = a instanceof OxStruct && b instanceof OxStruct && a.name === b.name;
                if (!nums && !same && !structs) throw new OxPanic(`sort(): can't order ${debug(a)} against ${debug(b)}`);
                return cmp(a, b) || 0;
            };
            return stableSort(asList(list, "sort"), order);
        }],
        sort_by: [2, function (list, f) {
            asFn(f, "sort_by");
            return stableSort(asList(list, "sort_by"), (a, b) => {
                const c = asInt(this.callFunction(f, [a, b], "<lambda>"));
                return c < 0n ? -1 : c > 0n ? 1 : 0;
            });
        }],
        reverse: [1, (v) => {
            if (Array.isArray(v)) return v.slice().reverse();
            if (typeof v === "string") return Array.from(v).reverse().join("");
            throw new OxPanic(`type error: reverse() expects a List or String, got ${debug(v)}`);
        }],
        sum: [1, (list) => {
            const items = asList(list, "sum");
            if (!items.length) return 0n;
            return items.slice(1).reduce((acc, x) => arith("+", acc, x), items[0]);
        }],
        chars: [1, (s) => Array.from(asStr(s))],
        ord: [1, (s) => {
            const c = codePoint(s);
            if (c === null) throw new OxPanic(`ord() expects a one-character String, got ${JSON.stringify(s)}`);
            return c;
        }],
        chr: [1, (n) => {
            const c = fromCodePoint(n);
            if (c === null) throw new OxPanic(`chr(): ${n} is not a valid code point`);
            return c;
        }],
        index_of: [2, (h, needle) => {
            if (Array.isArray(h)) return BigInt(h.findIndex((x) => eq(x, needle)));
            if (typeof h === "string") {
                const b = h.indexOf(asStr(needle));
                return b < 0 ? -1n : BigInt(Array.from(h.slice(0, b)).length);
            }
            throw new OxPanic(`type error: index_of() expects a List or String, got ${debug(h)}`);
        }],
        bit_and: [2, (a, b) => asInt(a) & asInt(b)],
        bit_or: [2, (a, b) => asInt(a) | asInt(b)],
        bit_xor: [2, (a, b) => asInt(a) ^ asInt(b)],
        bit_not: [1, (a) => ~asInt(a)],
        shl: [2, (a, n) => {
            if (asInt(n) < 0n || n > 63n) throw new OxPanic(`shl(): shift amount ${n} is out of range 0..63`);
            return wrap64(asInt(a) << n);
        }],
        shr: [2, (a, n) => {
            if (asInt(n) < 0n || n > 63n) throw new OxPanic(`shr(): shift amount ${n} is out of range 0..63`);
            return asInt(a) >> n;
        }],
        parse_int: [1, (s) => {
            const t = asStr(s).trim();
            if (/^[+-]?\d+$/.test(t)) {
                const n = BigInt(t);
                if (n <= I64_MAX && n >= I64_MIN) return ok(n);
            }
            return err(`cannot parse "${s}" as an Int`);
        }],
        parse_float: [1, (s) => {
            const n = parseFloatStrict(asStr(s).trim());
            return n === null ? err(`cannot parse "${s}" as a Float`) : ok(n);
        }],
        checked_div: [2, (a, b) => {
            if (b === 0n || b === 0) return err("division by zero");
            return ok(arith("/", a, b));
        }],
        checked_add: [2, (a, b) => checked(asInt(a) + asInt(b), "+")],
        checked_sub: [2, (a, b) => checked(asInt(a) - asInt(b), "-")],
        checked_mul: [2, (a, b) => checked(asInt(a) * asInt(b), "*")],
        map_try_get: [2, (m, k) => {
            const hit = asMap(m, "map_try_get").lookup(k);
            return hit ? ok(hit[1]) : err(`no entry for key ${show(k)}`);
        }],
        try_index: [2, (t, i) => {
            asInt(i);
            const items = Array.isArray(t) ? t : t instanceof OxTuple ? t.items : typeof t === "string" ? Array.from(t) : null;
            if (!items) throw new OxPanic(`type error: try_index() expects a List, Tuple or String, got ${debug(t)}`);
            if (i < 0n || i >= BigInt(items.length)) return err(`index ${i} out of bounds (len ${items.length})`);
            return ok(items[Number(i)]);
        }],
        try_slice: [3, (v, a, b) => {
            asInt(a);
            asInt(b);
            const len = Array.isArray(v) ? v.length : typeof v === "string" ? Array.from(v).length : null;
            if (len === null) throw new OxPanic(`type error: try_slice() expects a List or String, got ${debug(v)}`);
            if (a < 0n || b < a || b > BigInt(len)) return err(`slice ${a}..${b} out of range (len ${len})`);
            return ok(BUILTINS.slice[1](v, a, b));
        }],
        try_ord: [1, (s) => {
            const c = codePoint(s);
            return c === null ? err(`ord() expects a one-character String, got "${s}"`) : ok(c);
        }],
        try_chr: [1, (n) => {
            const c = fromCodePoint(n);
            return c === null ? err(`${n} is not a valid code point`) : ok(c);
        }],
        is_ok: [1, (r) => asResult(r, "is_ok").variant === "Ok"],
        is_err: [1, (r) => asResult(r, "is_err").variant === "Err"],
        unwrap: [1, (r) => {
            asResult(r, "unwrap");
            if (r.variant === "Ok") return r.payload[0];
            throw new OxPanic(`called unwrap() on an Err: ${show(r.payload[0])}`);
        }],
        unwrap_or: [2, (r, d) => (asResult(r, "unwrap_or").variant === "Ok" ? r.payload[0] : d)],
        map_err: [2, function (r, f) {
            asResult(r, "map_err");
            asFn(f, "map_err");
            if (r.variant !== "Err") return r;
            const e = this.callFunction(f, [r.payload[0]], "<lambda>");
            return err(typeof e === "string" ? e : show(e));
        }],
        ok_or: [2, (v, msg) => (v === null ? err(show(msg)) : ok(v))],
        unwrap_or_else: [2, function (r, f) {
            asResult(r, "unwrap_or_else");
            if (r.variant === "Ok") return r.payload[0];
            return this.callFunction(asFn(f, "unwrap_or_else"), [r.payload[0]], "<lambda>");
        }],
        // Files live in an in-memory folder that starts empty on each run.
        read_file: [1, function (p) {
            p = strArg(p, "read_file");
            return this.files.has(p) ? ok(this.files.get(p)) : err(`${p}: No such file or directory (os error 2)`);
        }],
        write_file: [2, function (p, t) {
            this.files.set(strArg(p, "write_file"), strArg(t, "write_file"));
            return ok(null);
        }],
        append_file: [2, function (p, t) {
            p = strArg(p, "append_file");
            this.files.set(p, (this.files.get(p) || "") + strArg(t, "append_file"));
            return ok(null);
        }],
        file_exists: [1, function (p) {
            p = strArg(p, "file_exists").replace(/\/+$/, "");
            return this.files.has(p) || [...this.files.keys()].some((f) => f.startsWith(p + "/"));
        }],
        list_dir: [1, function (p) {
            p = strArg(p, "list_dir").replace(/\/+$/, "");
            const names = new Set();
            for (const f of this.files.keys()) if (f.startsWith(p + "/")) names.add(f.slice(p.length + 1).split("/")[0]);
            return ok([...names].sort());
        }],
        remove_file: [1, function (p) {
            p = strArg(p, "remove_file");
            if (!this.files.delete(p)) return err(`${p}: No such file or directory (os error 2)`);
            return ok(null);
        }],
        make_dir: [1, (p) => {
            strArg(p, "make_dir");
            return ok(null);
        }],
        env: [1, (n) => err(`environment variable \`${strArg(n, "env")}\` is not set`)],
        exit: [1, (code) => {
            throw new Exit(asInt(code));
        }],
        now_ms: [0, () => BigInt(Date.now())],
        mono_ms: [0, () => BigInt(Date.now() - t0)],
        sleep_ms: [1, (n) => {
            asInt(n);
            return null;
        }],
        split_lines: [1, (s) => {
            s = strArg(s, "split_lines");
            if (s === "") return [];
            const lines = s.split("\n").map((l) => l.replace(/\r$/, ""));
            if (s.endsWith("\n")) lines.pop();
            return lines;
        }],
        pad_left: [3, (s, w, p) => pad(s, w, p, true)],
        pad_right: [3, (s, w, p) => pad(s, w, p, false)],
        repeat: [2, (s, n) => strArg(s, "repeat").repeat(Math.max(0, Number(asInt(n))))],
        format_float: [2, (x, d) => asF64(x).toFixed(Math.min(100, Math.max(0, Number(asInt(d)))))],
        trim_start: [1, (s) => strArg(s, "trim_start").trimStart()],
        trim_end: [1, (s) => strArg(s, "trim_end").trimEnd()],
        json_parse: [1, (t) => {
            try {
                return ok(jsonParse(strArg(t, "json_parse")));
            } catch (e) {
                if (e instanceof OxPanic || e instanceof OxError) throw e;
                return err(e.message);
            }
        }],
        json_stringify: [1, (v) => jsonEmit(v, false)],
        json_pretty: [1, (v) => jsonEmit(v, true)],
        http_get: [1, (url) => {
            strArg(url, "http_get");
            return err(NO_NET);
        }],
    };

    function pad(s, width, padStr, left) {
        const who = left ? "pad_left" : "pad_right";
        s = strArg(s, who);
        const fill = Array.from(strArg(padStr, who));
        const have = Array.from(s).length;
        const want = Math.max(0, Number(asInt(width)));
        if (have >= want || !fill.length) return s;
        let extra = "";
        for (let i = 0; i < want - have; i++) extra += fill[i % fill.length];
        return left ? extra + s : s + extra;
    }

    function stableSort(items, order) {
        return items
            .map((v, i) => [v, i])
            .sort((a, b) => order(a[0], b[0]) || a[1] - b[1])
            .map(([v]) => v);
    }

    // Runs a program. `onPrint(line)` gets each line of output; an `Err`
    // escaping `main` comes back through `onPrint(line, true)`.
    function runOxidized(source, onPrint) {
        const program = new Parser(lex(source)).parseProgram();
        const interp = new Interpreter(onPrint);
        const outer = INTERP;
        INTERP = interp;
        try {
            const failure = interp.run(program);
            if (failure) onPrint(failure, true);
        } catch (e) {
            if (e instanceof Exit) return;
            if (e instanceof RangeError) throw new OxPanic("recursion limit exceeded — the playground's stack is much smaller than the real compiler's");
            throw e;
        } finally {
            INTERP = outer;
        }
    }

    // A separate, deliberately tolerant tokenizer for live syntax
    // highlighting — unlike lex() above, it must never throw on invalid or
    // half-typed source (an unterminated string mid-keystroke is normal,
    // not an error) and it only needs to *look* right, not be correct.
    const HL_TOKEN_RE = new RegExp(
        [
            /((?:\/\/|#)[^\n]*)/.source,
            /("(?:\\.|[^"\\\n])*"?)/.source,
            /(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/.source,
            /(\btrue\b|\bfalse\b|\bNone\b)/.source,
            /(\b(?:let|fn|if|else|while|for|in|break|continue|struct|impl|enum|trait|const|native|match|as|import|return|print|assert|self)\b)/.source,
            /(\b(?:Int|Float|String|string|bool|Bool|List|Box|i32|i64|f32|f64|Result|Ok|Err)\b|\b[A-Z]\w*)/.source,
            /([A-Za-z_]\w*)(?=\s*\()/.source,
            /([A-Za-z_]\w*)/.source,
            /(::|=>|->|\.\.|[+\-*/%=<>!&|?]+|[(){}[\];,.:])/.source,
        ].join("|"),
        "g"
    );

    function escapeHtml(s) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function highlightOxidized(source) {
        const CLASSES = ["tok-comment", "tok-string", "tok-number", "tok-bool", "tok-keyword", "tok-type", "tok-call", "tok-ident", "tok-op"];
        let out = "";
        let lastIndex = 0;
        HL_TOKEN_RE.lastIndex = 0;
        let m;
        while ((m = HL_TOKEN_RE.exec(source))) {
            if (m.index > lastIndex) out += escapeHtml(source.slice(lastIndex, m.index));
            const group = m.findIndex((g, i) => i > 0 && g !== undefined);
            out += `<span class="${CLASSES[group - 1]}">${escapeHtml(m[0])}</span>`;
            lastIndex = HL_TOKEN_RE.lastIndex;
        }
        out += escapeHtml(source.slice(lastIndex));
        return out;
    }

    global.Oxidized = { runOxidized, highlight: highlightOxidized, OxError, OxPanic };
})(typeof window !== "undefined" ? window : globalThis);
