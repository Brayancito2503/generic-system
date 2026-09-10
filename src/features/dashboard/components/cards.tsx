export default function CardWrapper() {
  return null; // Will be replaced by module-specific dashboards
}

export function Card({
  title,
  value,
  type,
}: {
  title: string;
  value: number | string;
  type: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 shadow-sm">
      <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
      <p className="mt-2 text-2xl font-bold text-white truncate">{value}</p>
    </div>
  );
}
