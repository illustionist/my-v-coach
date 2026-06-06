export function GuideVocalSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label>
      Guide vocal
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        aria-label="Guide vocal"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
