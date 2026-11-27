export function logHeap(label: string): void {
  const mu = process.memoryUsage();
  console.log(
    `heap ${label}: heapUsed=${(mu.heapUsed / 1024 / 1024).toFixed(1)}MB rss=${(mu.rss / 1024 / 1024).toFixed(1)}MB`
  );
}