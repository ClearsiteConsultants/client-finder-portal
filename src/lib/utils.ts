export function formatQuizTitle(title: string): string {
  return title.trim().charAt(0).toUpperCase() + title.trim().slice(1);
}

export function calculateScore(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}
