"use client";

import { ModalFrame } from "./ModalFrame";

export type SidebarTabOption<TTab extends string> = {
  id: TTab;
  label: string;
};

export function SidebarTabsModal<TTab extends string>({
  title,
  activeTab,
  tabs,
  onTabChange,
  onClose,
  children,
}: {
  title: string;
  activeTab: TTab;
  tabs: SidebarTabOption<TTab>[];
  onTabChange: (tab: TTab) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalFrame
      title={title}
      onClose={onClose}
      sidebar={
        <aside className="border-border w-44 border-r p-3">
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`${idx > 0 ? "mt-1" : ""}w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                activeTab === tab.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </aside>
      }
    >
      {children}
    </ModalFrame>
  );
}
