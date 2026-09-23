// Oxidized in the browser: lexer, parser and tree-walking interpreter for the
// language at github.com/suspiciousMans/oxidized.
//
// The real compiler transpiles .ox to Rust and builds it with rustc; this is
// a JavaScript port of the same grammar and of the generated runtime's
// behavior (DynamicValue, the builtins, closures, structs, enums, match), so
// programs print what `oxidized run` prints. Checks the real checker does
// before rustc runs are done here as the program runs instead, and `import`
// isn't available (there are no files to import from).
(function (global) {
    "use strict";

    class OxError extends Error {}
    // Runtime failures: the generated Rust would panic.
    class OxPanic extends Error {}

    const KEYWORDS = new Set([
        "let", "fn", "if", "else", "while", "for", "in", "break", "continue", "struct", "impl",
        "enum", "match", "as", "import", "return", "print", "assert", "true", "false", "None",
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
                    } else {
                        if (src[i] === "\n") line++;
                        s += src[i++];
                    }
                }
                if (i >= n) throw new OxError(`unterminated string (line ${line})`);
                i++;
                push("Str", s);
                continue;
            }
            if (isDigit(c) || (c === "." && isDigit(src[i + 1] || ""))) {
                const start = i;
                let isFloat = false;
                while (i < n && isDigit(src[i])) i++;
                if (src[i] === "." && isDigit(src[i + 1] || "")) {
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
            if (["->", "=>", "==", "!=", "<=", ">=", "&&", "||", "::"].includes(two)) {
                push(two, two);
                i += 2;
                continue;
            }
            if ("+-*/%=!<>:,(){}[];.".includes(c)) {
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

    class Parser {
        constructor(tokens) {
            this.tokens = tokens;
            this.pos = 0;
            this.loops = 0;
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

        parseProgram() {
            const decls = [];
            this.skipSemis();
            while (!this.at("Eof")) {
                const t = this.peek();
                if (!["fn", "struct", "enum", "impl", "import"].includes(t.type)) {
                    this.fail("only `fn`, `struct`, `enum`, `impl` and `import` can appear at the top level — put statements inside `fn main()`");
                }
                decls.push(this.parseStmt());
                this.skipSemis();
            }
            return decls;
        }

        parseStmt() {
            this.skipSemis();
            const t = this.peek();
            const line = t.line;
            const s = this.parseStmtKind();
            s.line = line;
            return s;
        }

        parseStmtKind() {
            const t = this.peek();
            switch (t.type) {
                case "let": return this.parseLet();
                case "fn": return { kind: "Fn", def: this.parseFn() };
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
                case "Ident":
                    if (this.peek(1).type === "=") {
                        const name = this.bump().value;
                        this.bump();
                        return { kind: "Assign", name, value: this.parseExpr() };
                    }
                    return this.parseExprStmt();
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

        parseType() {
            return this.ident("a type name");
        }

        parseLet() {
            this.bump();
            const name = this.ident("identifier after `let`");
            let ty = null;
            if (this.at(":")) {
                this.bump();
                ty = this.parseType();
            }
            this.expect("=");
            return { kind: "Let", name, ty, value: this.parseExpr() };
        }

        typeParams() {
            const params = [];
            if (!this.at("<")) return params;
            this.bump();
            for (;;) {
                params.push(this.ident("type parameter name"));
                if (this.at(",")) this.bump();
                else break;
            }
            this.expect(">");
            return params;
        }

        parseFn() {
            this.bump();
            const name = this.ident("function name after `fn`");
            const typeParams = this.typeParams();
            this.expect("(");
            const params = [];
            if (!this.at(")")) {
                for (;;) {
                    const pname = this.ident("parameter name");
                    let ty = null;
                    if (this.at(":")) {
                        this.bump();
                        ty = this.parseType();
                    }
                    params.push({ name: pname, ty });
                    if (this.at(",")) this.bump();
                    else break;
                }
            }
            this.expect(")");
            let ret = null;
            if (this.at("->")) {
                this.bump();
                ret = this.parseType();
            }
            const body = this.fnBody();
            return { name, typeParams, params, ret, body };
        }

        fnBody() {
            const outer = this.loops;
            this.loops = 0;
            try {
                return this.parseBlock();
            } finally {
                this.loops = outer;
            }
        }

        parseReturn() {
            this.bump();
            const t = this.peek();
            const ends = ["}", "Eof", "let", "if", "while", "return", "else", "for", "break", "continue", "struct", "import", ";"];
            if (ends.includes(t.type) || (t.type === "fn" && this.peek(1).type !== "(")) {
                return { kind: "Return", value: null };
            }
            return { kind: "Return", value: this.parseExpr() };
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

        parseStruct() {
            this.bump();
            const name = this.ident("struct name after `struct`");
            const typeParams = this.typeParams();
            this.expect("{");
            const fields = [];
            if (!this.at("}")) {
                for (;;) {
                    const fname = this.ident("field name");
                    let ty = null;
                    if (this.at(":")) {
                        this.bump();
                        ty = this.parseType();
                    }
                    fields.push({ name: fname, ty });
                    if (this.at(",")) this.bump();
                    else break;
                }
            }
            this.expect("}");
            return { kind: "Struct", name, typeParams, fields };
        }

        parseEnum() {
            this.bump();
            const name = this.ident("enum name after `enum`");
            this.expect("{");
            const variants = [];
            if (!this.at("}")) {
                for (;;) {
                    const vname = this.ident("variant name");
                    const payload = [];
                    if (this.at("(")) {
                        this.bump();
                        if (!this.at(")")) {
                            for (;;) {
                                payload.push(this.parseType());
                                if (this.at(",")) this.bump();
                                else break;
                            }
                        }
                        this.expect(")");
                    }
                    variants.push({ name: vname, payload });
                    if (this.at(",")) this.bump();
                    else break;
                }
            }
            this.expect("}");
            return { kind: "Enum", name, variants };
        }

        parseImpl() {
            this.bump();
            const name = this.ident("struct name after `impl`");
            this.expect("{");
            const methods = [];
            while (this.at("fn")) methods.push(this.parseFn());
            this.expect("}");
            return { kind: "Impl", name, methods };
        }

        parseExprStmt() {
            const line = this.peek().line;
            const expr = this.parseExpr();
            if (this.at("=")) {
                if (expr.kind !== "Field") {
                    this.fail("cannot assign to this expression — only a variable (`x = ...`) or a struct field (`x.field = ...`) can be assigned to");
                }
                this.bump();
                return { kind: "FieldAssign", target: expr.target, field: expr.field, value: this.parseExpr(), line };
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
            const LEVELS = [["||"], ["&&"], ["==", "!=", "<", ">", "<=", ">="], ["+", "-"], ["*", "/", "%"]];
            if (level === LEVELS.length) return this.parseUnary();
            let lhs = this.binary(level + 1);
            while (LEVELS[level].includes(this.peek().type)) {
                const op = this.bump().type;
                const line = this.peek().line;
                const rhs = this.binary(level + 1);
                lhs = { kind: "Binary", op, lhs, rhs, line };
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
                    const field = this.ident("field name after `.`");
                    if (this.at("(")) {
                        this.bump();
                        expr = { kind: "MethodCall", receiver: expr, method: field, args: this.callArgs(), line };
                    } else {
                        expr = { kind: "Field", target: expr, field, line };
                    }
                } else if (this.at("as")) {
                    this.bump();
                    expr = { kind: "Cast", value: expr, ty: this.parseType(), line };
                } else {
                    return expr;
                }
            }
        }

        callArgs() {
            const args = [];
            if (!this.at(")")) {
                for (;;) {
                    args.push(this.parseExpr());
                    if (this.at(",")) this.bump();
                    else break;
                }
            }
            this.expect(")");
            return args;
        }

        isFieldList() {
            return this.at("Ident") && this.peek(1).type === ":";
        }

        fieldInits() {
            const fields = [];
            for (;;) {
                const name = this.ident("field name");
                this.expect(":");
                fields.push({ name, value: this.parseExpr() });
                if (this.at(",")) this.bump();
                else break;
            }
            this.expect(")");
            return fields;
        }

        parsePattern() {
            const t = this.bump();
            switch (t.type) {
                case "Int": case "Float": case "Str":
                    return { kind: "Literal", value: t.value };
                case "true": return { kind: "Literal", value: true };
                case "false": return { kind: "Literal", value: false };
                case "-": {
                    const num = this.bump();
                    if (num.type !== "Int" && num.type !== "Float") this.fail("expected a number after '-' in pattern", num);
                    return { kind: "Literal", value: -num.value };
                }
                case "Ident": {
                    if (t.value === "_") return { kind: "Wildcard" };
                    let variant = t.value;
                    let qualified = false;
                    if (this.at("::")) {
                        this.bump();
                        variant = this.ident("variant name after `::` in pattern");
                        qualified = true;
                    }
                    if (this.at("(")) {
                        this.bump();
                        const bindings = [];
                        if (!this.at(")")) {
                            for (;;) {
                                bindings.push(this.ident("binding name in pattern"));
                                if (this.at(",")) this.bump();
                                else break;
                            }
                        }
                        this.expect(")");
                        return { kind: "Variant", variant, bindings };
                    }
                    if (qualified) return { kind: "Variant", variant, bindings: [] };
                    return { kind: "Binding", name: t.value };
                }
                default:
                    return this.fail(`unexpected ${this.describe(t)} in pattern`, t);
            }
        }

        parsePrimary() {
            const t = this.bump();
            const line = t.line;
            switch (t.type) {
                case "Int": case "Float": case "Str":
                    return { kind: "Lit", value: t.value };
                case "true": return { kind: "Lit", value: true };
                case "false": return { kind: "Lit", value: false };
                case "None": return { kind: "Lit", value: null };
                case "fn": {
                    this.expect("(");
                    const params = [];
                    if (!this.at(")")) {
                        for (;;) {
                            params.push(this.ident("parameter name"));
                            if (this.at(":")) this.fail("lambda parameters cannot have type annotations");
                            if (this.at(",")) this.bump();
                            else break;
                        }
                    }
                    this.expect(")");
                    if (this.at("->")) this.fail("lambda cannot have a return type annotation");
                    return { kind: "Lambda", params, body: this.fnBody(), line };
                }
                case "match": {
                    const scrutinee = this.parseExpr();
                    this.expect("{");
                    const arms = [];
                    while (!this.at("}")) {
                        const pattern = this.parsePattern();
                        this.expect("=>");
                        arms.push({ pattern, body: this.parseExpr() });
                        if (this.at(",")) this.bump();
                        else break;
                    }
                    this.expect("}");
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
                    const e = this.parseExpr();
                    this.expect(")");
                    return e;
                }
                case "[": {
                    const items = [];
                    if (!this.at("]")) {
                        for (;;) {
                            items.push(this.parseExpr());
                            if (this.at(",")) this.bump();
                            else break;
                        }
                    }
                    this.expect("]");
                    return { kind: "List", items };
                }
                default:
                    return this.fail(`unexpected ${this.describe(t)} in expression`, t);
            }
        }
    }

    // ---------- values ----------
    //
    // Int → BigInt (checked against i64), Float → number, Str → string,
    // Bool → boolean, None → null, List → array. Values are never mutated
    // in place: `p.x = 1` builds a new struct and rebinds the variable,
    // which gives the language's copy-on-pass semantics for free.

    const I64_MAX = (1n << 63n) - 1n;
    const I64_MIN = -(1n << 63n);
    const I32_MAX = (1n << 31n) - 1n;
    const I32_MIN = -(1n << 31n);

    class OxStruct {
        constructor(name, fields) {
            this.name = name;
            this.fields = fields; // [[name, value], ...] in declaration order
        }
        get(field) {
            const f = this.fields.find(([k]) => k === field);
            if (!f) throw new OxPanic(`no field \`${field}\` on struct \`${this.name}\``);
            return f[1];
        }
        with(field, value) {
            if (!this.fields.some(([k]) => k === field)) throw new OxPanic(`no field \`${field}\` on struct \`${this.name}\``);
            return new OxStruct(this.name, this.fields.map(([k, v]) => [k, k === field ? value : v]));
        }
    }

    class OxEnum {
        constructor(type, variant, payload) {
            this.type = type;
            this.variant = variant;
            this.payload = payload;
        }
    }

    class OxMap {
        constructor(entries) {
            this.entries = entries; // [[key, value], ...]
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
        const s = String(n);
        const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
        if (!m) return s;
        const [, sign, lead, frac = "", expText] = m;
        const exp = Number(expText);
        const digits = lead + frac;
        if (exp < 0) return sign + "0." + "0".repeat(-exp - 1) + digits;
        return sign + digits.padEnd(exp + 1, "0");
    }

    function show(v) {
        if (v === null) return "None";
        if (isInt(v)) return v.toString();
        if (isFloat(v)) return formatFloat(v);
        if (typeof v === "string") return v;
        if (typeof v === "boolean") return v ? "true" : "false";
        if (Array.isArray(v)) return "[" + v.map(show).join(", ") + "]";
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
        if (isFloat(v)) return `Float(${Number.isInteger(v) ? v.toFixed(1) : v})`;
        if (typeof v === "string") return `Str(${JSON.stringify(v)})`;
        if (typeof v === "boolean") return `Bool(${v})`;
        if (Array.isArray(v)) return `List([${v.map(debug).join(", ")}])`;
        if (v instanceof OxStruct) return `Struct(${JSON.stringify(v.name)}, [${v.fields.map(([k, x]) => `(${JSON.stringify(k)}, ${debug(x)})`).join(", ")}])`;
        if (v instanceof OxEnum) return `Enum(${JSON.stringify(v.type)}, ${JSON.stringify(v.variant)}, [${v.payload.map(debug).join(", ")}])`;
        if (v instanceof OxMap) return `Map([${v.entries.map(([k, x]) => `(${debug(k)}, ${debug(x)})`).join(", ")}])`;
        return "Function(<function>)";
    }

    function typeName(v) {
        if (v === null) return "None";
        if (isInt(v)) return "Int";
        if (isFloat(v)) return "Float";
        if (typeof v === "string") return "String";
        if (typeof v === "boolean") return "Bool";
        if (Array.isArray(v)) return "List";
        if (v instanceof OxStruct) return v.name;
        if (v instanceof OxEnum) return v.type;
        if (v instanceof OxMap) return "Map";
        return "function";
    }

    function eq(a, b) {
        if (isInt(a) && isInt(b)) return a === b;
        if (isFloat(a) && isFloat(b)) return Math.abs(a - b) < 1e-9;
        if (typeof a === "string" || typeof a === "boolean" || a === null) return a === b;
        if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => eq(x, b[i]));
        if (a instanceof OxStruct && b instanceof OxStruct) {
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

    // Derived PartialOrd: same variant compares contents, different variants
    // compare by declaration order. null when unordered (NaN, functions).
    const RANK = ["Int", "Float", "Str", "Bool", "List", "Struct", "Enum", "Map", "Function", "None"];
    function rank(v) {
        if (v === null) return 9;
        if (isInt(v)) return 0;
        if (isFloat(v)) return 1;
        if (typeof v === "string") return 2;
        if (typeof v === "boolean") return 3;
        if (Array.isArray(v)) return 4;
        if (v instanceof OxStruct) return 5;
        if (v instanceof OxEnum) return 6;
        if (v instanceof OxMap) return 7;
        return 8;
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
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return cmpPrim(ra, rb);
        switch (RANK[ra]) {
            case "Int": case "Float": case "Str": return cmpPrim(a, b);
            case "Bool": return cmpPrim(Number(a), Number(b));
            case "List": return cmpSeq(a, b, cmp);
            case "Struct": return cmpPrim(a.name, b.name) || cmpSeq(a.fields, b.fields, (x, y) => cmpPrim(x[0], y[0]) || cmp(x[1], y[1]));
            case "Enum": return cmpPrim(a.type, b.type) || cmpPrim(a.variant, b.variant) || cmpSeq(a.payload, b.payload, cmp);
            case "Map": return cmpSeq(a.entries, b.entries, (x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]));
            case "None": return 0;
            default: return null;
        }
    }

    const truthy = (v) => (typeof v === "boolean" ? v : v !== null);

    // Type annotations: the primitives pin a value, anything else (a struct,
    // an enum, a type parameter) is dynamic.
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
                else if (isFloat(v)) {
                    if (Number.isNaN(v)) out = 0n;
                    else if (v >= 9.223372036854776e18) out = I64_MAX;
                    else if (v <= -9.223372036854776e18) out = I64_MIN;
                    else out = BigInt(Math.trunc(v));
                } else if (typeof v === "boolean") out = v ? 1n : 0n;
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
        const kind = (v) => (isInt(v) ? "Int" : isFloat(v) ? "Float" : typeof v === "string" ? "Str" : null);
        if (kind(a) && kind(b) && kind(a) !== kind(b)) {
            throw new OxError(`type mismatch in arithmetic expression: ${kind(a)} vs ${kind(b)}${kind(a) !== "Str" && kind(b) !== "Str" ? " — convert one side with `as`" : ""}`);
        }
        throw new OxPanic(`type error in ${op}`);
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

    const STEP_LIMIT = 5_000_000;
    const DEPTH_LIMIT = 5000;

    class Interpreter {
        constructor(onPrint) {
            this.onPrint = onPrint;
            this.fns = new Map();
            this.structs = new Map();
            this.enums = new Map([["Result", { name: "Result", variants: [{ name: "Ok", payload: [null] }, { name: "Err", payload: ["String"] }] }]]);
            this.methods = new Map();
            this.steps = 0;
            this.depth = 0;
        }

        run(program) {
            for (const d of program) {
                const where = d.line ? ` (line ${d.line})` : "";
                switch (d.kind) {
                    case "Fn":
                        if (this.fns.has(d.def.name)) throw new OxError(`duplicate function \`${d.def.name}\`${where}`);
                        this.fns.set(d.def.name, new OxFunc(d.def, null));
                        break;
                    case "Struct":
                        this.structs.set(d.name, d);
                        break;
                    case "Enum":
                        this.enums.set(d.name, d);
                        break;
                    case "Impl": {
                        if (!this.methods.has(d.name)) this.methods.set(d.name, new Map());
                        for (const m of d.methods) this.methods.get(d.name).set(m.name, new OxFunc(m, null));
                        break;
                    }
                    case "Import":
                        throw new OxError(`\`import "${d.path}"\` needs files next to this one, so it only works with the real \`oxidized\` CLI, not in the playground${where}`);
                }
            }
            for (const name of this.methods.keys()) {
                if (!this.structs.has(name)) throw new OxError(`\`impl ${name}\` for a struct that doesn't exist`);
            }
            const main = this.fns.get("main");
            if (!main) throw new OxError("no `fn main()` — execution starts there");
            this.callFunction(main, [], "main");
        }

        tick() {
            if (++this.steps > STEP_LIMIT) throw new OxPanic("execution step limit reached — infinite loop?");
        }

        // Errors get the line of the innermost statement that raised them.
        execBlock(stmts, scope) {
            for (const s of stmts) {
                try {
                    this.exec(s, scope);
                } catch (err) {
                    if ((err instanceof OxPanic || err instanceof OxError) && !err.lined) {
                        err.lined = true;
                        if (s.line && !/\(line \d+\)/.test(err.message)) err.message += ` (line ${s.line})`;
                    }
                    throw err;
                }
            }
        }

        exec(s, scope) {
            this.tick();
            switch (s.kind) {
                case "Let": {
                    let value = this.eval(s.value, scope);
                    if (isInt(value) && primitive(s.ty) === "f64") {
                        throw new OxError(`type mismatch: \`${s.name}\` is annotated ${s.ty} but assigned an Int — write a float literal or use \`as ${s.ty}\``);
                    }
                    const existing = scope.findLocal(s.name);
                    if (existing) {
                        const ty = s.ty || existing.ty;
                        existing.value = ty ? coerce(value, ty, `\`${s.name}\``) : value;
                        if (s.ty) existing.ty = s.ty;
                    } else {
                        if (s.ty) value = coerce(value, s.ty, `\`${s.name}\``);
                        scope.vars.set(s.name, new Cell(value, s.ty));
                    }
                    return;
                }
                case "Assign": {
                    const cell = scope.find(s.name);
                    if (!cell) throw new OxError(`assignment to undeclared variable \`${s.name}\` — declare it with \`let\` first`);
                    const value = this.eval(s.value, scope);
                    cell.value = cell.ty ? coerce(value, cell.ty, `\`${s.name}\``) : value;
                    return;
                }
                case "FieldAssign": {
                    if (s.target.kind !== "Var") throw new OxError(`only a variable's own field can be assigned (\`p.x = ...\`) (line ${s.line})`);
                    const cell = scope.find(s.target.name);
                    if (!cell) throw new OxError(`undefined variable \`${s.target.name}\``);
                    if (!(cell.value instanceof OxStruct)) throw new OxPanic(`type error: cannot set field \`${s.field}\` on ${debug(cell.value)}`);
                    const def = this.structs.get(cell.value.name);
                    const field = def && def.fields.find((f) => f.name === s.field);
                    if (!field) throw new OxError(`struct \`${cell.value.name}\` has no field \`${s.field}\``);
                    const value = coerce(this.eval(s.value, scope), field.ty, `field \`${cell.value.name}.${s.field}\``);
                    cell.value = cell.value.with(s.field, value);
                    if (cell.isSelf) cell.dirty = true;
                    return;
                }
                case "Fn": {
                    if (!scope.fns) scope.fns = new Map();
                    scope.fns.set(s.def.name, new OxFunc(s.def, null));
                    return;
                }
                case "Return":
                    throw new Return(s.value ? this.eval(s.value, scope) : null);
                case "If": {
                    if (truthy(this.eval(s.cond, scope))) this.execBlock(s.then, new Scope(scope));
                    else if (s.otherwise) this.execBlock(s.otherwise, new Scope(scope));
                    return;
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
                    return;
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
                    return;
                }
                case "Break":
                    throw BREAK;
                case "Continue":
                    throw CONTINUE;
                case "Expr":
                    this.eval(s.expr, scope);
                    return;
                case "Struct":
                case "Enum":
                case "Impl":
                case "Import":
                    throw new OxError(`\`${s.kind.toLowerCase()}\` declarations belong at the top level (line ${s.line})`);
            }
        }

        eval(e, scope) {
            switch (e.kind) {
                case "Lit":
                    return e.value;
                case "List":
                    return e.items.map((x) => this.eval(x, scope));
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
                    throw new OxPanic("type error in unary -");
                }
                case "Binary": {
                    if (e.op === "&&") return truthy(this.eval(e.lhs, scope)) && truthy(this.eval(e.rhs, scope));
                    if (e.op === "||") return truthy(this.eval(e.lhs, scope)) || truthy(this.eval(e.rhs, scope));
                    const a = this.eval(e.lhs, scope);
                    const b = this.eval(e.rhs, scope);
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
                case "Index": {
                    const target = this.eval(e.target, scope);
                    const idx = this.eval(e.index, scope);
                    if (!isInt(idx)) throw new OxPanic(`type error: expected Int, got ${debug(idx)}`);
                    if (Array.isArray(target)) {
                        if (idx < 0n || idx >= BigInt(target.length)) throw new OxPanic(`index ${idx} out of bounds (len ${target.length})`);
                        return target[Number(idx)];
                    }
                    if (typeof target === "string") {
                        const chars = Array.from(target);
                        if (idx < 0n || idx >= BigInt(chars.length)) throw new OxPanic(`index ${idx} out of bounds (len ${chars.length})`);
                        return chars[Number(idx)];
                    }
                    throw new OxPanic(`type error: cannot index into ${debug(target)}`);
                }
                case "Field": {
                    const target = this.eval(e.target, scope);
                    if (!(target instanceof OxStruct)) throw new OxPanic(`type error: cannot access field \`${e.field}\` on ${debug(target)}`);
                    return target.get(e.field);
                }
                case "Cast": {
                    const v = this.eval(e.value, scope);
                    if (!primitive(e.ty) && !this.structs.has(e.ty) && !this.enums.has(e.ty) && !/^[A-Z]/.test(e.ty)) {
                        throw new OxError(`\`${e.ty}\` isn't a type (line ${e.line})`);
                    }
                    return cast(v, e.ty);
                }
                case "Lambda":
                    return new OxFunc({ name: "<lambda>", params: e.params.map((name) => ({ name, ty: null })), ret: null, body: e.body, lambda: true }, this.captureFrom(scope));
                case "StructInit":
                    return this.construct(e, scope);
                case "EnumInit": {
                    const en = this.enums.get(e.enumName);
                    if (!en) throw new OxError(`unknown enum \`${e.enumName}\` in \`${e.enumName}::${e.variant}(...)\` (line ${e.line})`);
                    const variant = en.variants.find((v) => v.name === e.variant);
                    if (!variant) throw new OxError(`enum \`${e.enumName}\` has no variant \`${e.variant}\` (line ${e.line})`);
                    if (variant.payload.length !== e.args.length) {
                        throw new OxError(`\`${e.enumName}::${e.variant}\` takes ${variant.payload.length} value(s), got ${e.args.length} (line ${e.line})`);
                    }
                    const payload = e.args.map((a, i) => coerce(this.eval(a, scope), variant.payload[i], `\`${e.enumName}::${e.variant}\`'s payload`));
                    return new OxEnum(e.enumName, e.variant, payload);
                }
                case "Match":
                    return this.match(e, scope);
                case "Call":
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

        construct(e, scope) {
            if (e.name.includes("::")) throw new OxError(`\`${e.name}\` refers to an imported module, and imports aren't available in the playground (line ${e.line})`);
            const def = this.structs.get(e.name);
            if (!def) throw new OxError(`unknown struct \`${e.name}\` (line ${e.line})`);
            const given = new Map();
            for (const f of e.fields) {
                if (!def.fields.some((d) => d.name === f.name)) throw new OxError(`struct \`${e.name}\` has no field \`${f.name}\` (line ${e.line})`);
                if (given.has(f.name)) throw new OxError(`field \`${f.name}\` given twice (line ${e.line})`);
                given.set(f.name, f.value);
            }
            const missing = def.fields.filter((d) => !given.has(d.name)).map((d) => d.name);
            if (missing.length) throw new OxError(`\`${e.name}(...)\` is missing field(s): ${missing.join(", ")} (line ${e.line})`);
            const typeParams = new Set(def.typeParams);
            return new OxStruct(
                e.name,
                def.fields.map((d) => {
                    const v = this.eval(given.get(d.name), scope);
                    return [d.name, typeParams.has(d.ty) ? v : coerce(v, d.ty, `field \`${e.name}.${d.name}\``)];
                })
            );
        }

        match(e, scope) {
            const v = this.eval(e.scrutinee, scope);
            if (v instanceof OxEnum) this.checkExhaustive(v, e);
            for (const arm of e.arms) {
                const p = arm.pattern;
                const bound = new Scope(scope);
                let ok = false;
                switch (p.kind) {
                    case "Wildcard":
                        ok = true;
                        break;
                    case "Binding":
                        bound.vars.set(p.name, new Cell(v, null));
                        ok = true;
                        break;
                    case "Literal":
                        ok = eq(v, p.value);
                        break;
                    case "Variant":
                        if (!(v instanceof OxEnum)) throw new OxPanic(`type error: expected an enum value, got ${debug(v)}`);
                        if (v.variant === p.variant) {
                            if (p.bindings.length !== v.payload.length) {
                                throw new OxError(`pattern \`${p.variant}(...)\` binds ${p.bindings.length} value(s), but \`${p.variant}\` carries ${v.payload.length} (line ${e.line})`);
                            }
                            p.bindings.forEach((name, i) => bound.vars.set(name, new Cell(v.payload[i], null)));
                            ok = true;
                        }
                        break;
                }
                if (ok) return this.eval(arm.body, bound);
            }
            throw new OxPanic(`no match arm matched ${show(v)} (line ${e.line})`);
        }

        checkExhaustive(v, e) {
            const en = this.enums.get(v.type);
            if (!en) return;
            if (e.arms.some((a) => a.pattern.kind === "Wildcard" || a.pattern.kind === "Binding")) return;
            const covered = new Set(e.arms.filter((a) => a.pattern.kind === "Variant").map((a) => a.pattern.variant));
            const missing = en.variants.map((x) => x.name).filter((n) => !covered.has(n));
            if (missing.length) {
                throw new OxError(`non-exhaustive match on \`${en.name}\`: missing ${missing.join(", ")} — add those arms or a \`_\` arm (line ${e.line})`);
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
            return impl(...args);
        }

        methodCall(e, scope) {
            const recv = this.eval(e.receiver, scope);
            const args = e.args.map((a) => this.eval(a, scope));
            if (!(recv instanceof OxStruct)) throw new OxError(`can't call method \`${e.method}\` on ${typeName(recv)} ${show(recv)} — methods only exist on structs (line ${e.line})`);
            return this.invokeMethod(recv, e.method, args, e.receiver, scope, e.line);
        }

        // Runs a method with `self` bound; if the method assigned to self's
        // fields and the receiver is a variable, that variable sees the change.
        invokeMethod(recv, method, args, receiverExpr, scope, line) {
            const fn = this.methods.get(recv.name)?.get(method);
            if (!fn) throw new OxError(`struct \`${recv.name}\` has no method \`${method}\` (line ${line})`);
            const [first, ...rest] = fn.def.params;
            if (!first || first.name !== "self") throw new OxError(`\`${recv.name}::${method}\` doesn't take \`self\`, so it can't be called as a method (line ${line})`);
            const selfCell = new Cell(recv, null);
            selfCell.isSelf = true;
            const result = this.callFunction(new OxFunc({ ...fn.def, params: rest }, null), args, `${recv.name}.${method}`, selfCell);
            if (selfCell.dirty && receiverExpr.kind === "Var") {
                const target = scope.find(receiverExpr.name);
                if (target) {
                    target.value = selfCell.value;
                    if (target.isSelf) target.dirty = true;
                }
            }
            return result;
        }

        callFunction(fn, args, name, selfCell = null) {
            const def = fn.def;
            if (args.length !== def.params.length) throw new OxError(`\`${name}\` expects ${def.params.length} argument(s), got ${args.length}`);
            if (++this.depth > DEPTH_LIMIT) throw new OxPanic("stack overflow — recursion too deep");
            const typeParams = new Set(def.typeParams || []);
            const frame = new Scope(fn.capture, !def.lambda);
            if (selfCell) frame.vars.set("self", selfCell);
            def.params.forEach((p, i) => {
                const ty = typeParams.has(p.ty) ? null : p.ty;
                frame.vars.set(p.name, new Cell(ty ? coerce(args[i], ty, `\`${name}\`'s parameter \`${p.name}\``) : args[i], ty));
            });
            try {
                this.execBlock(def.body, frame);
            } catch (sig) {
                if (sig instanceof Return) {
                    if (def.ret && name !== "main" && !typeParams.has(def.ret)) return coerce(sig.value, def.ret, `\`${name}\`'s return value`);
                    return sig.value;
                }
                throw sig;
            } finally {
                this.depth--;
            }
            if (def.ret && name !== "main") throw new OxError(`\`${name}\` is declared \`-> ${def.ret}\` but can reach its end without returning a value`);
            return null;
        }
    }

    // ---------- builtins ----------

    const result = (variant, value) => new OxEnum("Result", variant, [value]);
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
    const asMap = (m, fn) => {
        if (!(m instanceof OxMap)) throw new OxPanic(`type error: ${fn}() expects a Map, got ${debug(m)}`);
        return m.entries;
    };
    const asResult = (r, fn) => {
        if (!(r instanceof OxEnum) || r.type !== "Result") throw new OxPanic(`type error: ${fn}() expects a Result, got ${debug(r)}`);
        return r;
    };
    const toI64 = (x) => {
        if (Number.isNaN(x)) return 0n;
        if (x >= 9.223372036854776e18) return I64_MAX;
        if (x <= -9.223372036854776e18) return I64_MIN;
        return BigInt(Math.trunc(x));
    };
    const roundHalfAway = (x) => Math.sign(x) * Math.round(Math.abs(x));

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
            if (typeof v === "string") return BigInt(Array.from(v).length);
            if (v instanceof OxMap) return BigInt(v.entries.length);
            throw new OxPanic(`type error: len() expects a List, String, or Map, got ${debug(v)}`);
        }],
        push: [2, (list, v) => {
            if (!Array.isArray(list)) throw new OxPanic(`type error: push() expects a List, got ${debug(list)}`);
            return [...list, v];
        }],
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
        map_new: [0, () => new OxMap([])],
        map_set: [3, (m, k, v) => {
            const entries = asMap(m, "map_set");
            const i = entries.findIndex(([key]) => eq(key, k));
            if (i >= 0) return new OxMap(entries.map((e, j) => (j === i ? [e[0], v] : e)));
            return new OxMap([...entries, [k, v]]);
        }],
        map_get: [2, (m, k) => {
            const hit = asMap(m, "map_get").find(([key]) => eq(key, k));
            if (!hit) throw new OxPanic(`map_get(): no entry for key ${debug(k)}`);
            return hit[1];
        }],
        map_has: [2, (m, k) => asMap(m, "map_has").some(([key]) => eq(key, k))],
        map_remove: [2, (m, k) => new OxMap(asMap(m, "map_remove").filter(([key]) => !eq(key, k)))],
        map_keys: [1, (m) => asMap(m, "map_keys").map(([k]) => k)],
        map_values: [1, (m) => asMap(m, "map_values").map(([, v]) => v)],
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
            if (!Array.isArray(list)) throw new OxPanic(`type error: join() expects a List, got ${debug(list)}`);
            return list.map(show).join(sep);
        }],
        contains: [2, (h, n) => {
            if (typeof h === "string") return h.includes(asStr(n));
            if (Array.isArray(h)) return h.some((x) => eq(x, n));
            throw new OxPanic(`type error: contains() expects a List or String, got ${debug(h)}`);
        }],
        starts_with: [2, (s, p) => asStr(s).startsWith(asStr(p))],
        ends_with: [2, (s, p) => asStr(s).endsWith(asStr(p))],
        replace: [3, (s, a, b) => asStr(s).split(asStr(a)).join(asStr(b))],
        parse_int: [1, (s) => {
            const t = asStr(s).trim();
            if (/^[+-]?\d+$/.test(t)) {
                const n = BigInt(t);
                if (n <= I64_MAX && n >= I64_MIN) return result("Ok", n);
            }
            return result("Err", `cannot parse "${s}" as an Int`);
        }],
        parse_float: [1, (s) => {
            const n = parseFloatStrict(asStr(s).trim());
            return n === null ? result("Err", `cannot parse "${s}" as a Float`) : result("Ok", n);
        }],
        checked_div: [2, (a, b) => {
            if (b === 0n || b === 0) return result("Err", "division by zero");
            return result("Ok", arith("/", a, b));
        }],
        map_try_get: [2, (m, k) => {
            const hit = asMap(m, "map_try_get").find(([key]) => eq(key, k));
            return hit ? result("Ok", hit[1]) : result("Err", `no entry for key ${show(k)}`);
        }],
        is_ok: [1, (r) => asResult(r, "is_ok").variant === "Ok"],
        is_err: [1, (r) => asResult(r, "is_err").variant === "Err"],
        unwrap: [1, (r) => {
            asResult(r, "unwrap");
            if (r.variant === "Ok") return r.payload[0];
            throw new OxPanic(`called unwrap() on an Err: ${show(r.payload[0])}`);
        }],
        unwrap_or: [2, (r, d) => (asResult(r, "unwrap_or").variant === "Ok" ? r.payload[0] : d)],
    };

    function runOxidized(source, onPrint) {
        const program = new Parser(lex(source)).parseProgram();
        const interp = new Interpreter(onPrint);
        try {
            interp.run(program);
        } catch (err) {
            if (err instanceof RangeError) throw new OxPanic("stack overflow — recursion too deep");
            throw err;
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
            /(\b(?:let|fn|if|else|while|for|in|break|continue|struct|impl|enum|match|as|import|return|print|assert|self)\b)/.source,
            /(\b(?:Int|Float|String|string|bool|List|i32|i64|f32|f64|Result|Ok|Err)\b|\b[A-Z]\w*)/.source,
            /([A-Za-z_]\w*)(?=\s*\()/.source,
            /([A-Za-z_]\w*)/.source,
            /(::|=>|->|[+\-*/%=<>!&|]+|[(){}[\];,.:])/.source,
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
