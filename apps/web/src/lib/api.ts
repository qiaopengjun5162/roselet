const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface Rose {
  id: string;
  color: string;
  gratitude: string | null;
  anxiety: string | null;
  hope: string | null;
  created_at: string;
}

export interface CreateRose {
  color: string;
  gratitude?: string;
  anxiety?: string;
  hope?: string;
}

export async function createRose(data: CreateRose): Promise<Rose> {
  const res = await fetch(`${API_BASE}/api/rose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create rose");
  return res.json();
}

export async function getGarden(): Promise<Rose[]> {
  const res = await fetch(`${API_BASE}/api/garden`);
  if (!res.ok) throw new Error("Failed to fetch garden");
  return res.json();
}

export async function getRose(id: string): Promise<Rose> {
  const res = await fetch(`${API_BASE}/api/rose/${id}`);
  if (!res.ok) throw new Error("Failed to fetch rose");
  return res.json();
}
