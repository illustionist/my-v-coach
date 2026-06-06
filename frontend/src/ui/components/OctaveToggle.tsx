export function OctaveToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        aria-label="Octave-tolerant matching"
        onChange={(e) => onChange(e.target.checked)}
      />
      Match any octave
    </label>
  );
}
