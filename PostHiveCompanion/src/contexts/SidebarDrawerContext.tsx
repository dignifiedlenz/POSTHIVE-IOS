import React, {createContext, useContext, type ReactNode} from 'react';

type SidebarDrawerContextValue = {
  openSidebar: () => void;
};

const SidebarDrawerContext = createContext<SidebarDrawerContextValue>({
  openSidebar: () => {},
});

export function SidebarDrawerProvider({
  openSidebar,
  children,
}: {
  openSidebar: () => void;
  children: ReactNode;
}) {
  return (
    <SidebarDrawerContext.Provider value={{openSidebar}}>
      {children}
    </SidebarDrawerContext.Provider>
  );
}

export function useSidebarDrawer() {
  return useContext(SidebarDrawerContext);
}
