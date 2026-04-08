import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-background flex flex-1 flex-col items-center justify-center font-sans">
      <main className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-foreground text-2xl font-semibold">Kite</h1>
        <p className="text-muted-foreground text-sm">Project management</p>
        <p className="text-muted-foreground text-sm">Select a project to get started.</p>
        <Link
          href="/projects/1"
          className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
        >
          Open Euston Underground
        </Link>
      </main>
    </div>
  );
}
