(function () {
    "use strict";

    const EXAMPLES = {
        hello: {
            label: "Hello (hello.ox)",
            code: `// hello.ox — v1 end-to-end example
fn greet(name) {
    print("Hello, " + name + "!")
}

fn main() {
    let x = 5
    let y: i32 = 10
    print(x + y)

    greet("world")

    if x > 0 {
        print("positive")
    } else {
        print("non-positive")
    }

    let i = 0
    while i < 3 {
        print(i)
        i = i + 1
    }
}
`,
        },
        fizzbuzz: {
            label: "FizzBuzz",
            code: `fn main() {
    for i in range(1, 16) {
        if i % 15 == 0 {
            print("FizzBuzz")
        } else {
            if i % 3 == 0 {
                print("Fizz")
            } else {
                if i % 5 == 0 {
                    print("Buzz")
                } else {
                    print(i)
                }
            }
        }
    }
}
`,
        },
        oxidize: {
            label: "Oxidation level",
            code: `# the metal starts to turn
fn main() {
    let rust = 0
    while rust < 100 {
        rust = rust + 20
        print("oxidation level: " + (rust as String) + "%")
    }
    print("fully oxidized.")
}
`,
        },
        structs: {
            label: "Structs and methods",
            code: `struct Point {
    x: Int,
    y: Int
}

impl Point {
    fn dist_sq(self) -> Int {
        return self.x * self.x + self.y * self.y
    }

    fn add(self, other: Point) -> Point {
        return Point(x: self.x + other.x, y: self.y + other.y)
    }

    fn nudge(self) {
        self.x = self.x + 1    # the caller's variable sees this
    }
}

fn main() {
    let p = Point(x: 3, y: 4)
    print(p.dist_sq())
    print(p.add(Point(x: 1, y: 1)))

    p.nudge()
    p.nudge()
    print(p)
}
`,
        },
        enums: {
            label: "Enums and match",
            code: `enum Shape {
    Circle(Int),
    Rect(Int, Int),
    Point
}

fn area(s) {
    return match s {
        Circle(r) => r * r * 3,     # 3 as a stand-in for pi
        Rect(w, h) => w * h,
        Point() => 0
    }
}

fn main() {
    let shapes = [Shape::Circle(5), Shape::Rect(2, 3), Shape::Point()]
    for s in shapes {
        print(s, "has area", area(s))
    }
}
`,
        },
        closures: {
            label: "Closures",
            code: `fn make_counter() {
    let n = 0
    let inc = fn() {
        n = n + 1
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

    let make_adder = fn(a) {
        return fn(b) {
            return a + b
        }
    }
    let add5 = make_adder(5)
    print(add5(2))
}
`,
        },
        higher: {
            label: "Functions as values",
            code: `fn inc(x) {
    return x + 1
}

fn double(x) {
    return x * 2
}

fn apply(f, x) {
    return f(x)
}

fn main() {
    let g = inc
    print(g(5))
    print(apply(inc, 10))
    print(apply(double, 10))
}
`,
        },
        maps: {
            label: "Maps and strings",
            code: `fn main() {
    let words = split("rust never sleeps rust never rests", " ")
    let counts = map_new()
    for w in words {
        if map_has(counts, w) {
            counts = map_set(counts, w, map_get(counts, w) + 1)
        } else {
            counts = map_set(counts, w, 1)
        }
    }
    print(counts)
    print(map_keys(counts))
    print(upper(join(words, "-")))
}
`,
        },
        results: {
            label: "Error handling",
            code: `fn safe_average(total, count) {
    return match checked_div(total, count) {
        Result::Ok(avg) => avg,
        Result::Err(msg) => 0
    }
}

fn main() {
    print(safe_average(10, 2))
    print(safe_average(10, 0))    # division by zero, handled

    let n = parse_int("42")
    print(unwrap(n))
    print(unwrap_or(parse_int("nope"), -1))
    print(parse_float("rust"))
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

fn main() {
    let x = 5             # dynamic
    let y: i32 = 10       # pinned to a Rust i32
    print(add(x, y))

    let f = 3.7
    print(f as Int, 5 as Float, "42" as Int + 1, 7 as String)

    print(identity("hi"), identity(99))
    print(sqrt(2), pow(2, 10), round(2.5))
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
            window.Oxidized.runOxidized(source, (line) => print(line));
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
