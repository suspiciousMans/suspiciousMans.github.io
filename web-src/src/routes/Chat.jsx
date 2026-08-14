import { useEffect, useRef, useState } from "react";

const MAX_NAME_LEN = 30;
const MAX_MSG_LEN = 500;
const HISTORY_LIMIT = 100;

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [name, setName] = useState(() => localStorage.getItem("chatName") || "");
    const [text, setText] = useState("");
    const [status, setStatus] = useState("");
    const [unavailable, setUnavailable] = useState(false);
    const [ready, setReady] = useState(false);
    const [sending, setSending] = useState(false);

    const listRef = useRef(null);
    const wasAtBottomRef = useRef(true);
    const pushRef = useRef(null);
    const messagesRefRef = useRef(null);
    const serverTimestampRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe;

        // Dynamic + wrapped in try/catch (unlike static imports) so a
        // network hiccup, ad-blocker, or Firebase outage degrades to a
        // visible message instead of silently leaving the form
        // non-functional. Raced against a timeout too: a broken connection
        // doesn't always reject promptly (or at all) on its own, and this
        // shouldn't hang the "loading" state forever if it doesn't.
        async function init() {
            let database, dbModule;
            try {
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("timed out loading Firebase")), 8000)
                );
                const [{ initializeApp }, mod] = await Promise.race([
                    Promise.all([
                        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
                        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"),
                    ]),
                    timeout,
                ]);
                dbModule = mod;

                // Public-safe: this identifies the Firebase project only.
                // Actual access control is enforced by the Realtime
                // Database security rules (public read, append-only
                // writes with shape validation), not by keeping this
                // config secret.
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

                const app = initializeApp(firebaseConfig);
                database = dbModule.getDatabase(app);
            } catch (err) {
                console.error("Chat unavailable — Firebase failed to load:", err);
                if (!cancelled) setUnavailable(true);
                return;
            }

            if (cancelled) return;

            const messagesRef = dbModule.ref(database, "messages");
            messagesRefRef.current = messagesRef;
            pushRef.current = dbModule.push;
            serverTimestampRef.current = dbModule.serverTimestamp;

            const recentQuery = dbModule.query(messagesRef, dbModule.orderByChild("timestamp"), dbModule.limitToLast(HISTORY_LIMIT));

            unsubscribe = dbModule.onChildAdded(
                recentQuery,
                (snapshot) => {
                    const list = listRef.current;
                    if (list) {
                        wasAtBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
                    }
                    setMessages((prev) => [...prev, { id: snapshot.key, ...snapshot.val() }]);
                },
                (err) => {
                    console.error("Chat listener failed:", err);
                    setStatus("Couldn't connect to chat — try reloading.");
                }
            );

            setReady(true);
        }

        init();

        return () => {
            cancelled = true;
            if (unsubscribe) unsubscribe();
        };
    }, []);

    useEffect(() => {
        const list = listRef.current;
        if (list && wasAtBottomRef.current) {
            list.scrollTop = list.scrollHeight;
        }
    }, [messages]);

    function handleSubmit(e) {
        e.preventDefault();
        const trimmedName = name.trim().slice(0, MAX_NAME_LEN) || "anon";
        const trimmedText = text.trim().slice(0, MAX_MSG_LEN);
        if (!trimmedText || !pushRef.current) return;

        localStorage.setItem("chatName", trimmedName);
        setSending(true);
        pushRef
            .current(messagesRefRef.current, {
                name: trimmedName,
                text: trimmedText,
                timestamp: serverTimestampRef.current(),
            })
            .then(() => {
                setStatus("");
                setText("");
            })
            .catch((err) => {
                console.error("Send failed:", err);
                setStatus("Message didn't send — try again.");
            })
            .finally(() => setSending(false));
    }

    return (
        <>
            <section className="hero" style={{ paddingBottom: "20px" }}>
                <div className="wrap">
                    <span className="eyebrow">Live</span>
                    <h1>
                        Say <span>Hi</span>
                    </h1>
                    <p className="lede">A public chatroom, live for anyone on this site right now. No account needed — pick a name and talk.</p>
                </div>
            </section>

            <section style={{ paddingTop: 0 }}>
                <div className="wrap">
                    <div className="chat-shell">
                        <div className="chat-messages" ref={listRef}>
                            {unavailable && <p className="chat-empty">Chat is unavailable right now — couldn't reach the server.</p>}
                            {!unavailable && messages.length === 0 && (
                                <p className="chat-empty">No messages yet — be the first to say something.</p>
                            )}
                            {messages.map((msg) => (
                                <div className="chat-message" key={msg.id}>
                                    <div className="chat-message-head">
                                        <span className="chat-message-name">{msg.name || "anon"}</span>
                                        <span className="chat-message-time">
                                            {msg.timestamp
                                                ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                                : ""}
                                        </span>
                                    </div>
                                    <div className="chat-message-text">{msg.text || ""}</div>
                                </div>
                            ))}
                        </div>
                        <form className="chat-form" autoComplete="off" onSubmit={handleSubmit}>
                            <input
                                type="text"
                                placeholder="Name"
                                maxLength={MAX_NAME_LEN}
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Say something…"
                                maxLength={MAX_MSG_LEN}
                                required
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary" disabled={!ready || sending}>
                                Send
                            </button>
                        </form>
                    </div>
                    <p className="chat-status">{status}</p>
                    <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "13px", maxWidth: "520px", margin: "10px auto 0" }}>
                        This room is open to anyone visiting the site — please keep it civil. Messages aren't moderated in
                        real time.
                    </p>
                </div>
            </section>
        </>
    );
}
