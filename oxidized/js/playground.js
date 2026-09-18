(function () {
    "use strict";

    const EXAMPLES = {
        hello: {
            label: "Hello, corrosion",
            code: `// the obligatory first rust spot
print("the metal starts to turn.");
print("hello, oxidized world.");
`,
        },
        fizzbuzz: {
            label: "FizzBuzz",
            code: `for i in 1..21 {
    if (i % 15 == 0) {
        print("FizzBuzz");
    } else if (i % 3 == 0) {
        print("Fizz");
    } else if (i % 5 == 0) {
        print("Buzz");
    } else {
        print(i);
    }
}
`,
        },
        fib: {
            label: "Fibonacci",
            code: `fn fib(n) {
    if (n < 2) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

for i in 0..10 {
    print(fib(i));
}
`,
        },
        oxidize: {
            label: "Oxidation level",
            code: `let rust = 0;
while (rust < 100) {
    rust = rust + 20;
    print("oxidation level: " + rust + "%");
}
print("fully oxidized.");
`,
        },
    };

    const codeEl = document.getElementById("ox-code");
    const outputEl = document.getElementById("ox-output");
    const runBtn = document.getElementById("ox-run");
    const clearBtn = document.getElementById("ox-clear");
    const exampleSelect = document.getElementById("ox-examples");

    function loadExample(key) {
        const ex = EXAMPLES[key];
        if (!ex) return;
        codeEl.value = ex.code;
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

    function run() {
        outputEl.textContent = "";
        const source = codeEl.value;
        const start = performance.now();
        try {
            window.Oxidized.runOxidized(source, (line) => print(line));
            const ms = (performance.now() - start).toFixed(1);
            print(`— finished in ${ms}ms —`, "ox-meta");
        } catch (err) {
            print("rust error: " + (err && err.message ? err.message : String(err)), "ox-error");
        }
    }

    runBtn.addEventListener("click", run);
    clearBtn.addEventListener("click", () => {
        outputEl.textContent = "";
    });
    codeEl.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            run();
        }
    });

    loadExample("hello");
    run();
})();
