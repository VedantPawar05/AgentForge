"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface WorkspaceContext {
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceSlug: string | null;
  role: string | null;
  setActiveWorkspace: (
    id: string,
    name: string,
    slug: string,
    role: string,
  ) => void;
}

const WorkspaceCtx = createContext<WorkspaceContext>({
  workspaceId: null,
  workspaceName: null,
  workspaceSlug: null,
  role: null,
  setActiveWorkspace: () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const setActiveWorkspace = useCallback(
    (id: string, name: string, slug: string, r: string) => {
      setWorkspaceId(id);
      setWorkspaceName(name);
      setWorkspaceSlug(slug);
      setRole(r);
    },
    [],
  );

  return (
    <WorkspaceCtx.Provider
      value={{
        workspaceId,
        workspaceName,
        workspaceSlug,
        role,
        setActiveWorkspace,
      }}
    >
      {children}
    </WorkspaceCtx.Provider>
  );
}

export function useWorkspaceContext() {
  return useContext(WorkspaceCtx);
}
