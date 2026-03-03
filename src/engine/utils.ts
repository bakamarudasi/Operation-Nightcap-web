export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function randomPick<T>(arr: T[]): T {
  if (arr.length === 0) return undefined as unknown as T;
  return arr[Math.floor(Math.random() * arr.length)];
}
