export function Period({ start, end }: { start: number; end: number }) {
  return <span className="mono">{`[${start}, ${end})`}</span>;
}
