"use client";

import { useCallback, useState } from "react";

import { ProjectSettingsDetail } from "./ProjectSettingsDetail";
import { ProjectSettingsList } from "./ProjectSettingsList";

export function ProjectSettingsSection() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleBackToList = useCallback(() => setSelectedProjectId(null), []);

  if (selectedProjectId) {
    return (
      <ProjectSettingsDetail
        key={selectedProjectId}
        projectId={selectedProjectId}
        onBackToProjects={handleBackToList}
        onDuplicated={setSelectedProjectId}
      />
    );
  }

  return <ProjectSettingsList onSelectProject={setSelectedProjectId} />;
}
