(function () {
    "use strict";

    const EXAMPLES = {
        hello: {
            label: "Hello (hello.ox)",
            code: `// hello.ox
fn greet(name) {
    print("Hello, {name}!")
}

fn main() {
    let x = 5
    let y: i32 = 10
    print("{x} + {y} = {x + y}")

    greet("world")

    let sign = if x > 0 { "positive" } else { "non-positive" }
    print(sign)

    let i = 0
    while i < 3 {
        print(i)
        i += 1
    }
}
`,
        },
        fizzbuzz: {
            label: "FizzBuzz",
            code: `fn fizz(i) {
    return match (i % 3, i % 5) {
        (0, 0) => "FizzBuzz",
        (0, _) => "Fizz",
        (_, 0) => "Buzz",
        _ => i as String
    }
}

fn main() {
    for i in 1..16 {
        print(fizz(i))
    }
}
`,
        },
        patterns: {
            label: "Pattern matching",
            code: `enum Ev {
    Click { x: Int, y: Int },
    Key { code: Int, shift: Bool },
    Quit
}

fn describe(e: Ev) {
    return match e {
        Ev::Click { x, y: 0 } => "click on the axis at {x}",
        Ev::Click { x, y } => "click {x},{y}",
        Ev::Key { code, shift: true } => "SHIFT {code}",
        Ev::Key { code, .. } => "key {code}",
        Ev::Quit() => "quit"
    }
}

fn classify(n: Int) {
    return match n {
        0 => "zero",
        x if x < 0 => "negative",
        x if x % 2 == 0 => "even",
        _ => "odd"
    }
}

fn main() {
    let events = [Ev::Click(x: 5, y: 0), Ev::Click(y: 2, x: 7), Ev::Key(code: 66, shift: true), Ev::Quit()]
    for e in events {
        print(describe(e))
    }
    for n in [-3, 0, 8, 7] {
        print(n, "is", classify(n))
    }
}
`,
        },
        traits: {
            label: "Traits",
            code: `trait Shape {
    fn area(self) -> Float
    fn name(self) -> String { return "shape" }
    fn describe(self) -> String {
        return "{self.name()} with area {format_float(self.area(), 2)}"
    }
}

struct Circle { r: Float }
struct Rect { w: Float, h: Float }

impl Shape for Circle {
    fn area(self) -> Float { return 3.14159 * self.r * self.r }
    fn name(self) -> String { return "circle" }
}

impl Shape for Rect {
    fn area(self) -> Float { return self.w * self.h }
}

fn largest<T: Shape>(shapes) {
    let best = shapes[0]
    for s in shapes {
        if s.area() > best.area() { best = s }
    }
    return best
}

fn main() {
    let shapes = [Circle(r: 1.5), Rect(w: 2.0, h: 3.0), Circle(r: 0.5)]
    for s in shapes {
        print(s.describe())     # dispatched on each value's struct
    }
    print("largest:", largest(shapes).describe())
}
`,
        },
        operators: {
            label: "Operator overloading",
            code: `struct Vec2 { x: Float, y: Float }

impl Vec2 {
    fn __add__(self, other: Vec2) -> Vec2 { return Vec2(x: self.x + other.x, y: self.y + other.y) }
    fn __mul__(self, k: Float) -> Vec2 { return Vec2(x: self.x * k, y: self.y * k) }
    fn __neg__(self) -> Vec2 { return Vec2(x: -self.x, y: -self.y) }
    fn len(self) -> Float { return sqrt(self.x * self.x + self.y * self.y) }
}

struct Version { major: Int, minor: Int }

impl Version {
    fn __lt__(self, other: Version) -> Bool {
        return if self.major != other.major { self.major < other.major } else { self.minor < other.minor }
    }
}

fn main() {
    let a = Vec2(x: 3.0, y: 4.0)
    let b = Vec2(x: 1.0, y: 1.0)
    print(a + b)
    print(-(a * 2.0))
    print(a.len())

    let vs = [Version(major: 2, minor: 1), Version(major: 1, minor: 9), Version(major: 2, minor: 0)]
    for v in sort(vs) {
        print("{v.major}.{v.minor}")
    }
}
`,
        },
        results: {
            label: "Errors and ?",
            code: `fn parse_all(text) {
    let total = 0
    for part in split(text, ",") {
        let n = parse_int(trim(part))?      # Ok(v) -> v, Err(e) -> return Err(e)
        total = checked_add(total, n)?
    }
    return Result::Ok(total)
}

fn main() {
    print(parse_all("1, 2, 3"))
    print(parse_all("1, x, 3"))
    print(unwrap_or(parse_int("nope"), -1))
    print(try_index([1, 2, 3], 7))

    let n = parse_all("4,5")?        # \`?\` in main: an Err ends the program
    print("got", n)
    let m = parse_all("4,oops")?
    print("never printed")
}
`,
        },
        tuples: {
            label: "Tuples and strings",
            code: `fn divmod(a: Int, b: Int) -> (Int, Int) {
    return (a / b, a % b)
}

fn where_is(x, y) {
    return match (x, y) {
        (0, 0) => "origin",
        (0, y) => "on the y axis at {y}",
        (x, y) => "at {x},{y}"
    }
}

fn main() {
    let (q, r) = divmod(17, 5)
    print("17 = 5 * {q} + {r}")
    print(where_is(0, 0), "/", where_is(0, 4), "/", where_is(2, 3))

    let word = "oxidized"
    print(upper(word), reverse(word), len(word))
    print(join(sort(chars(word)), ""))
    print(pad_left("7", 3, "0"), repeat("=", 8), "{{braces}}")
}
`,
        },
        maps: {
            label: "Maps and JSON",
            code: `fn main() {
    let words = split("rust never sleeps rust never rests", " ")
    let counts = map_new()
    for w in words {
        if map_has(counts, w) {
            counts[w] += 1
        } else {
            counts[w] = 1
        }
    }
    print(counts)
    print(map_keys(counts))

    let doc = unwrap(json_parse("{{\\"name\\": \\"ox\\", \\"tags\\": [1, 2.5, null]}}"))
    print(doc["name"], doc["tags"])
    doc["tags"][0] = 99
    print(unwrap(json_stringify(doc)))
}
`,
        },
        structs: {
            label: "Structs and methods",
            code: `struct Point {
    x: Int,
    y: Int,
}

impl Point {
    fn dist_sq(self) -> Int {
        return self.x * self.x + self.y * self.y
    }

    fn nudge(self) {
        self.x += 1    # the caller's variable sees this
    }
}

struct Node { val: Int, next: Box<Node> }

fn main() {
    let p = Point(x: 3, y: 4)
    print(p.dist_sq())
    p.nudge()
    p.nudge()
    print(p)

    let pts = [Point(x: 0, y: 0), Point(x: 1, y: 1)]
    pts[1].y = 10
    print(pts)

    let list = Node(val: 1, next: Node(val: 2, next: Node(val: 3, next: None)))
    let cur = list
    let total = 0
    while cur != None {
        total += cur.val
        cur = cur.next
    }
    print("sum of the chain:", total)
}
`,
        },
        closures: {
            label: "Closures",
            code: `fn make_counter() {
    let n = 0
    let inc = fn() {
        n += 1
        return n
    }
    return inc
}

fn main() {
    let c1 = make_counter()
    print(c1())
    print(c1())

    let c2 = make_counter()
    print(c2())    # a separate counter with its own n
    print(c1())

    let by_len = sort_by(["ferrous", "ox", "rust"], fn(a, b) { return len(a) - len(b) })
    print(by_len)
    print((fn(x) { return x * x })(12))
}
`,
        },
        types: {
            label: "Types, casts, generics",
            code: `fn add(a: i32, b: i32) -> i32 {
    return a + b
}

fn identity<T>(x: T) -> T {
    return x
}

const fn factorial(n: Int) -> Int {
    let acc = 1
    let i = 1
    while i <= n {
        acc *= i
        i += 1
    }
    return acc
}

fn main() {
    let x = 5             # dynamic
    let y: i32 = 10       # pinned to a Rust i32
    print(add(x, y))

    let f = 3.7
    print(f as Int, 5 as Float, "42" as Int + 1, 7 as String)

    print(identity("hi"), identity(99))
    print(sqrt(2), pow(2, 10), round(2.5))
    print(factorial(10))  # folded to 3628800 at compile time
}
`,
        },
    };

    const codeEl = document.getElementById("ox-code");
    const highlightEl = document.getElementById("ox-highlight-code");
    const highlightPre = document.querySelector(".ox-highlight");
    const outputEl = document.getElementById("ox-output");
    const outputPane = document.querySelector(".ox-output-pane");
    const runBtn = document.getElementById("ox-run");
    const clearBtn = document.getElementById("ox-clear");
    const exampleSelect = document.getElementById("ox-examples");

    function updateHighlight() {
        // Trailing newline keeps the <pre> from collapsing a blank last
        // line, which would otherwise leave the textarea's real last line
        // visually unbacked once it's empty.
        highlightEl.innerHTML = window.Oxidized.highlight(codeEl.value) + "\n";
    }

    function loadExample(key) {
        const ex = EXAMPLES[key];
        if (!ex) return;
        codeEl.value = ex.code;
        updateHighlight();
    }

    Object.keys(EXAMPLES).forEach((key) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = EXAMPLES[key].label;
        exampleSelect.appendChild(opt);
    });

    exampleSelect.addEventListener("change", () => loadExample(exampleSelect.value));

    function print(line, cls) {
        const row = document.createElement("div");
        row.className = "ox-line" + (cls ? " " + cls : "");
        row.textContent = line;
        outputEl.appendChild(row);
        outputEl.scrollTop = outputEl.scrollHeight;
    }

    function pulse(el, cls) {
        el.classList.remove(cls);
        // Force a reflow so re-adding the class restarts the animation even
        // if it's still playing from a previous run.
        void el.offsetWidth;
        el.classList.add(cls);
        el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
    }

    function run() {
        outputEl.textContent = "";
        pulse(runBtn, "ox-ignite");
        const source = codeEl.value;
        const start = performance.now();
        try {
            window.Oxidized.runOxidized(source, (line, isErr) => print(line, isErr ? "ox-error" : ""));
            const ms = (performance.now() - start).toFixed(1);
            print(`— finished in ${ms}ms —`, "ox-meta");
            outputPane.classList.add("ox-flash");
            setTimeout(() => outputPane.classList.remove("ox-flash"), 500);
        } catch (err) {
            const panicked = err instanceof window.Oxidized.OxPanic;
            const kind = panicked ? "panicked" : err instanceof window.Oxidized.OxError ? "error" : "internal error";
            print(kind + ": " + (err && err.message ? err.message : String(err)), "ox-error");
            pulse(outputPane, "ox-shake");
        }
    }

    runBtn.addEventListener("click", run);
    clearBtn.addEventListener("click", () => {
        outputEl.textContent = "";
    });

    codeEl.addEventListener("input", updateHighlight);
    codeEl.addEventListener("scroll", () => {
        highlightPre.scrollTop = codeEl.scrollTop;
        highlightPre.scrollLeft = codeEl.scrollLeft;
    });

    codeEl.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            run();
            return;
        }
        if (e.key === "Tab") {
            e.preventDefault();
            const { selectionStart, selectionEnd, value } = codeEl;
            codeEl.value = value.slice(0, selectionStart) + "    " + value.slice(selectionEnd);
            codeEl.selectionStart = codeEl.selectionEnd = selectionStart + 4;
            updateHighlight();
        }
    });

    loadExample("hello");
    run();
})();
