import { useState } from "react"
import GraphView from "./components/GraphView"
import ChatPanel from "./components/ChatPanel"

export default function App() {
  const [selectedNode, setSelectedNode] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      background: "#f5f5f5", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Top nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px",
        height: 48, background: "#fff", borderBottom: "1px solid #e5e5e5", flexShrink: 0 }}>
        <button onClick={() => setSidebarOpen(v => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4,
            display: "flex", alignItems: "center" }}>
          <SidebarIcon />
        </button>
        <span style={{ color: "#999", fontSize: 14 }}>Mapping</span>
        <span style={{ color: "#999", fontSize: 14 }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>Order to Cash</span>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Graph area */}
        <div style={{ flex: 1, position: "relative", background: "#fafafa" }}>
          <GraphView onNodeSelect={setSelectedNode} selectedNode={selectedNode} />
        </div>

        {/* Chat panel */}
        {sidebarOpen && (
          <div style={{ width: 340, borderLeft: "1px solid #e5e5e5",
            background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <ChatPanel />
          </div>
        )}
      </div>
    </div>
  )
}

function SidebarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="16" height="16" rx="2" stroke="#555" strokeWidth="1.5"/>
      <line x1="6" y1="1" x2="6" y2="17" stroke="#555" strokeWidth="1.5"/>
    </svg>
  )
}