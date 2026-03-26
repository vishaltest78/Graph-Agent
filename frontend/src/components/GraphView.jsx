import { useEffect, useRef, useState } from "react"
import cytoscape from "cytoscape"
import fcose from "cytoscape-fcose"
import { fetchGraph } from "../api"
import "./LoadingOverlay.css"

cytoscape.use(fcose)

// Two-tone scheme matching the reference images
function getNodeColor(type, connections = 0) {
  // Hub nodes (high connectivity) → blue; leaf nodes → red/pink
  const hubTypes = ["sales_order", "customer", "delivery"]
  if (hubTypes.includes(type) || connections > 3) return "#93C5FD" // light blue
  return "#FCA5A5" // light red/pink
}

function getBorderColor(type, connections = 0) {
  const hubTypes = ["sales_order", "customer", "delivery"]
  if (hubTypes.includes(type) || connections > 3) return "#3B82F6"
  return "#EF4444"
}

export default function GraphView({ onNodeSelect, selectedNode }) {
  const containerRef = useRef(null)
  const cyRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [showOverlay, setShowOverlay] = useState(true)
  const [popupNode, setPopupNode] = useState(null)
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    let isMounted = true;

    fetchGraph().then(({ elements }) => {
      if (!isMounted) return;

      // Calculate connection counts
      const connCount = {}
      elements.forEach(el => {
        if (el.data.source) {
          connCount[el.data.source] = (connCount[el.data.source] || 0) + 1
          connCount[el.data.target] = (connCount[el.data.target] || 0) + 1
        }
      })

      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: "node",
            style: {
              "background-color": ele => getNodeColor(ele.data("type"), connCount[ele.id()] || 0),
              "border-color": ele => getBorderColor(ele.data("type"), connCount[ele.id()] || 0),
              "border-width": 1,
              width: ele => {
                const c = connCount[ele.id()] || 0
                return Math.max(10, Math.min(28, 10 + c * 1.5))
              },
              height: ele => {
                const c = connCount[ele.id()] || 0
                return Math.max(10, Math.min(28, 10 + c * 1.5))
              },
              label: "",  // no labels by default — clean look
              "overlay-opacity": 0,
            },
          },
          {
            selector: "node:selected",
            style: {
              "border-width": 2.5,
              "border-color": "#1D4ED8",
              "background-color": "#3B82F6",
            },
          },
          {
            selector: "edge",
            style: {
              width: 0.8,
              "line-color": "#BFDBFE",
              "target-arrow-color": "#93C5FD",
              "target-arrow-shape": "triangle",
              "curve-style": "straight",
              opacity: 0.7,
              "overlay-opacity": 0,
            },
          },
          {
            selector: "edge:selected",
            style: { "line-color": "#3B82F6", width: 1.5 },
          },
        ],
        layout: { name: 'null' },
        wheelSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 4,
      })
      cyRef.current = cy;

      cy.on("tap", "node", evt => {
        const node = evt.target
        const data = node.data()
        const renderedPos = node.renderedPosition()
        const container = containerRef.current.getBoundingClientRect()

        setPopupNode(data)
        setPopupPos({
          x: renderedPos.x + container.left,
          y: renderedPos.y + container.top,
        })
        onNodeSelect(data)
      })

      cy.on("tap", evt => {
        if (evt.target === cy) {
          setPopupNode(null)
          onNodeSelect(null)
        }
      })

      setTimeout(() => {
        if (!isMounted) return;
        const layout = cy.layout({
          name: "fcose",
          animate: true,
          quality: "proof", // Higher performance quality
          randomize: true,
          nodeRepulsion: 4500,
          idealEdgeLength: 50,
          edgeElasticity: 0.45,
          gravity: 0.25,
          numIter: 2500,
          refresh: 30, // Yield more often back to main thread
          fit: true,
          padding: 30,
        });

        layout.on("layoutstop", () => {
          if (isMounted) setLoading(false);
        });

        layout.run();
      }, 50);
    })

    return () => {
      isMounted = false;
      cyRef.current?.destroy();
    }
  }, [])

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Toolbar */}
      <div style={{
        position: "absolute", top: 12, left: 12, zIndex: 10,
        display: "flex", gap: 8
      }}>
        <ToolbarBtn icon="↗" label="Minimize" />
        <ToolbarBtn
          icon="≡"
          label={showOverlay ? "Hide Granular Overlay" : "Show Granular Overlay"}
          onClick={() => {
            setShowOverlay(v => !v)
            if (cyRef.current) {
              cyRef.current.edges().style("opacity", showOverlay ? 0 : 0.7)
            }
          }}
        />
      </div>

      {loading && (
        <div className="graph-loading-overlay">
          <div className="spinner"></div>
          <div className="loading-text">Building graph...</div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`graph-container ${loading ? 'loading' : ''}`}
      />

      {/* Node popup — appears where node is clicked */}
      {popupNode && (
        <NodePopup
          node={popupNode}
          screenX={popupPos.x}
          screenY={popupPos.y}
          onClose={() => setPopupNode(null)}
          containerRef={containerRef}
        />
      )}
    </div>
  )
}
function ToolbarBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "#111", color: "#fff", border: "none",
        borderRadius: 6, padding: "7px 12px", fontSize: 12,
        fontWeight: 500, cursor: "pointer", userSelect: "none"
      }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  )
}

function NodePopup({ node, screenX, screenY, onClose, containerRef }) {
  const containerRect = containerRef.current?.getBoundingClientRect() || {}
  const relX = screenX - containerRect.left
  const relY = screenY - containerRect.top

  // Clamp popup so it doesn't go off screen
  const popupW = 280
  const popupH = 380
  const left = Math.min(relX + 16, (containerRect.width || 800) - popupW - 16)
  const top = Math.min(relY - 20, (containerRect.height || 600) - popupH - 16)

  // Filter out internal graph properties
  const skip = new Set(["id", "label", "type", "source", "target"])
  const fields = Object.entries(node).filter(([k]) => !skip.has(k))
  const shown = fields.slice(0, 12)
  const hidden = fields.length - shown.length

  return (
    <div style={{
      position: "absolute", left, top,
      width: popupW, maxHeight: popupH,
      background: "#fff", borderRadius: 10,
      boxShadow: "0 4px 24px rgba(0,0,0,0.13)",
      border: "1px solid #e5e5e5",
      padding: "16px", overflowY: "auto", zIndex: 100,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 10 }}>
          {node.type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || node.label}
        </div>
        <button onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#999", fontSize: 16, lineHeight: 1, padding: 0
          }}>×</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {shown.map(([k, v]) => (
          <div key={k} style={{ fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: "#333" }}>{k}: </span>
            <span style={{ color: "#555" }}>{String(v ?? "—")}</span>
          </div>
        ))}
        {hidden > 0 && (
          <div style={{ fontSize: 11, color: "#aaa", fontStyle: "italic", marginTop: 4 }}>
            Additional fields hidden for readability
          </div>
        )}
      </div>

      <div style={{
        marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0f0f0",
        fontSize: 12, color: "#555", fontWeight: 500
      }}>
        Connections: {node.connections || "—"}
      </div>
    </div>
  )
}