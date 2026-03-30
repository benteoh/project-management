export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
