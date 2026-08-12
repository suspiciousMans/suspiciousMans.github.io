const MAX_NAME_LEN = 30;
const MAX_MSG_LEN = 500;
const HISTORY_LIMIT = 100;

const listEl = document.getElementById("chat-messages");
const emptyEl = document.getElementById("chat-empty");
const formEl = document.getElementById("chat-form");
const nameEl = document.getElementById("chat-name");
const textEl = document.getElementById("chat-text");
const statusEl = document.getElementById("chat-status");
const sendBtn = document.getElementById("chat-send");

nameEl.value = localStorage.getItem("chatName") || "";
formEl.querySelector('[type="submit"]').disabled = true;

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function appendMessage(msg) {
    if (emptyEl) emptyEl.remove();
    var atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60;

    var el = document.createElement("div");
    el.className = "chat-message";
    var time = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";
    el.innerHTML =
        '<div class="chat-message-head">' +
        '<span class="chat-message-name">' + escapeHtml(msg.name || "anon") + "</span>" +
        '<span class="chat-message-time">' + escapeHtml(time) + "</span>" +
        "</div>" +
        '<div class="chat-message-text"></div>';
    el.querySelector(".chat-message-text").textContent = msg.text || "";

    listEl.appendChild(el);
    if (atBottom) listEl.scrollTop = listEl.scrollHeight;
}

async function init() {
    // Dynamic + wrapped in try/catch (unlike static imports) so a network
    // hiccup, ad-blocker, or Firebase outage degrades to a visible message
    // instead of silently leaving the form non-functional. Raced against a
    // timeout too: a broken connection doesn't always reject promptly (or
    // at all) on its own, and this shouldn't hang the "loading" state
    // forever if it doesn't.
    let firebaseApp, database;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timed out loading Firebase")), 8000));
        const [{ initializeApp }, dbModule] = await Promise.race([
            Promise.all([
                import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
                import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"),
            ]),
            timeout,
        ]);

        // Public-safe: this identifies the Firebase project only. Actual
        // access control is enforced by the Realtime Database security
        // rules (public read, append-only writes with shape validation),
        // not by keeping this config secret.
        const firebaseConfig = {
            apiKey: "AIzaSyB5T6k3KWKFldgob5vRwzX2a2rTht_4Obw",
            authDomain: "chat-d4d38.firebaseapp.com",
            databaseURL: "https://chat-d4d38-default-rtdb.firebaseio.com",
            projectId: "chat-d4d38",
            storageBucket: "chat-d4d38.firebasestorage.app",
            messagingSenderId: "184896105986",
            appId: "1:184896105986:web:61d27c21a0c2f32a5f011b",
            measurementId: "G-3QS7ZZQ4DP",
        };

        firebaseApp = initializeApp(firebaseConfig);
        database = dbModule.getDatabase(firebaseApp);
        var { ref, push, onChildAdded, query, orderByChild, limitToLast, serverTimestamp } = dbModule;
    } catch (err) {
        console.error("Chat unavailable — Firebase failed to load:", err);
        if (emptyEl) emptyEl.textContent = "Chat is unavailable right now — couldn't reach the server.";
        statusEl.textContent = "";
        return;
    }

    const messagesRef = ref(database, "messages");
    const recentQuery = query(messagesRef, orderByChild("timestamp"), limitToLast(HISTORY_LIMIT));

    onChildAdded(
        recentQuery,
        function (snapshot) {
            appendMessage(snapshot.val());
        },
        function (err) {
            console.error("Chat listener failed:", err);
            statusEl.textContent = "Couldn't connect to chat — try reloading.";
        }
    );

    formEl.querySelector('[type="submit"]').disabled = false;

    formEl.addEventListener("submit", function (e) {
        e.preventDefault();

        var name = nameEl.value.trim().slice(0, MAX_NAME_LEN) || "anon";
        var text = textEl.value.trim().slice(0, MAX_MSG_LEN);
        if (!text) return;

        localStorage.setItem("chatName", name);

        sendBtn.disabled = true;
        push(messagesRef, {
            name: name,
            text: text,
            timestamp: serverTimestamp(),
        })
            .then(function () {
                statusEl.textContent = "";
                textEl.value = "";
                textEl.focus();
            })
            .catch(function (err) {
                console.error("Send failed:", err);
                statusEl.textContent = "Message didn't send — try again.";
            })
            .finally(function () {
                sendBtn.disabled = false;
            });
    });
}

init();
