"use client";

import { useId } from "react";

export function ModalFrame({
  title,
  onClose,
  sidebar,
  children,
}: {
  title: string;
  onClose: () => void;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="border-border bg-card shadow-overlay flex h-[min(92vh,900px)] w-full max-w-6xl rounded-lg border"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {sidebar}
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="border-border flex items-center justify-between border-b p-4">
              <h2 id={titleId} className="text-foreground text-base font-semibold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">{children}</div>
          </section>
        </div>
      </div>
    </>
  );
}
