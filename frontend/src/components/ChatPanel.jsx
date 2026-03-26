import { useState, useRef, useEffect } from "react"
import { sendChat } from "../api"

const DODGE_AVATAR = (
  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#111",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
    D
  </div>
)

const USER_AVATAR = (
  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#e5e5e5",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#999">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
    </svg>
  </div>
)

export default function ChatPanel() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send() {
    const msg = input.trim()
    if (!msg || loading) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", text: msg }])
    setLoading(true)

    try {
      const result = await sendChat(msg)
      const text = result.type === "reject" ? result.message : result.answer
      setMessages(prev => [...prev, {
        role: "assistant", text,
        sql: result.sql, rowCount: result.rowCount
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: "Something went wrong. Please try again."
      }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Chat with Graph</div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>Order to Cash</div>
      </div>

      {/* AI identity row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10,
        padding: "14px 20px", borderBottom: "1px solid #f0f0f0" }}>
        {DODGE_AVATAR}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Graph Agent</div>
          <div style={{ fontSize: 11, color: "#999" }}>Graph Agent</div>
        </div>
      </div>

      {/* Welcome message */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {DODGE_AVATAR}
          <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>
            Hi! I can help you analyze the{" "}
            <strong>Order to Cash</strong> process.
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px",
        display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end",
                alignItems: "flex-start", gap: 8 }}>
                <div style={{
                  maxWidth: "80%", background: "#111", color: "#fff",
                  padding: "10px 14px", borderRadius: 12,
                  borderBottomRightRadius: 2, fontSize: 13, lineHeight: 1.5
                }}>
                  {msg.text}
                </div>
                <div style={{ display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 11, color: "#999", fontWeight: 500 }}>You</span>
                  {USER_AVATAR}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {DODGE_AVATAR}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>
                    <strong style={{ color: "#333" }}>Graph Agent</strong> · Graph Agent
                  </div>
                  <div
                    style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: msg.text }}
                  />
                  {msg.sql && (
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ fontSize: 11, color: "#aaa", cursor: "pointer" }}>
                        SQL · {msg.rowCount} rows
                      </summary>
                      <pre style={{ fontSize: 10, color: "#888", background: "#f9f9f9",
                        padding: "8px", borderRadius: 6, marginTop: 4,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                        border: "1px solid #eee" }}>
                        {msg.sql}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {DODGE_AVATAR}
            <div style={{ fontSize: 13, color: "#aaa" }}>Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Status + Input */}
      <div style={{ borderTop: "1px solid #f0f0f0", flexShrink: 0 }}>
        <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
            background: loading ? "#F59E0B" : "#22C55E" }} />
          <span style={{ fontSize: 11, color: "#999" }}>
            {loading ? "Graph Agent is thinking..." : "Graph Agent is awaiting instructions"}
          </span>
        </div>

        <div style={{ padding: "0 16px 16px", display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Analyze anything"
            style={{
              flex: 1, border: "1px solid #e5e5e5", borderRadius: 12,
              padding: "12px 14px", fontSize: 13, outline: "none",
              background: "#fff", color: "#111", resize: "none",
              minHeight: 80, lineHeight: 1.5,
              fontFamily: "inherit"
            }}
          />
          <button onClick={send} disabled={loading}
            style={{
              height: 40, width: 60, flexShrink: 0,
              background: loading ? "#e5e5e5" : "#111",
              color: loading ? "#999" : "#fff", border: "none",
              borderRadius: 8, cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 500, marginBottom: 20
            }}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}