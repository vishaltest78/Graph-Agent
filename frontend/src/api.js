const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001"

export async function fetchGraph() {
  const res = await fetch(`${BASE}/api/graph`)
  return res.json()
}

export async function sendChat(message) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
  return res.json()
}