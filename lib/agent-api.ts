const BASE = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
const KEY = process.env.INTERNAL_API_KEY ?? "";

export async function serverFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-internal-key": KEY },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`server ${res.status}`);
  return res.json() as Promise<T>;
}
