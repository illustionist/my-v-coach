export function ScoreReadout({ accuracy }: { accuracy: number }) {
  return <div aria-label="Accuracy">{Math.round(accuracy)}%</div>;
}
