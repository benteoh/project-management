import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background font-sans">
      <main className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">DSP Project Intelligence</h1>
        <p className="text-sm text-muted-foreground">Select a project to get started.</p>
        <Link
          href="/projects/1"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:opacity-80"
        >
          Open Euston Underground
        </Link>
      </main>
    </div>
  );
}
