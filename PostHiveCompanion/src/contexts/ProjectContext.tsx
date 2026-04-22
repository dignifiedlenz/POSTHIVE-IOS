import React, {createContext, useContext, ReactNode} from 'react';

export interface ProjectParams {
  projectId: string;
  projectName: string;
  clientName?: string;
  thumbnailUrl?: string;
}

const ProjectContext = createContext<ProjectParams | null>(null);

export function ProjectProvider({
  params,
  children,
}: {
  params: ProjectParams;
  children: ReactNode;
}) {
  return (
    <ProjectContext.Provider value={params}>{children}</ProjectContext.Provider>
  );
}

export function useProjectParams() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProjectParams must be used within ProjectProvider');
  }
  return ctx;
}
