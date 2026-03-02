const BASE = import.meta.env.BASE_URL + 'data/';

const cache: Record<string, unknown> = {};

export async function load<T>(file: string): Promise<T> {
  if (cache[file]) return cache[file] as T;
  const res = await fetch(BASE + file);
  const data = await res.json();
  cache[file] = data;
  return data as T;
}
