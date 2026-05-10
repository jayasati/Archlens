export function countLoc(source: string): number {
  let count = 0;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (line.startsWith('#')) continue;
    count++;
  }
  return count;
}
