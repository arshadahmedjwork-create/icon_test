import React, { createContext, useContext, useState, useEffect } from 'react';

export type Program = 'MIDAS' | 'ICON';

interface ProgramContextType {
  currentProgram: Program;
  setProgram: (program: Program) => void;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export const ProgramProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentProgram, setCurrentProgram] = useState<Program>(() => {
    // 1. Check hostname for subdomain (icon.example.com)
    const hostname = window.location.hostname;
    if (hostname.startsWith('icon.')) {
      return 'ICON';
    }

    // 2. Check localStorage for admin override
    const saved = localStorage.getItem('currentProgram');
    return (saved as Program) || 'MIDAS';
  });

  useEffect(() => {
    localStorage.setItem('currentProgram', currentProgram);
    
    // Apply theme at root level
    if (currentProgram === 'ICON') {
      document.documentElement.classList.add('theme-icon');
      document.documentElement.classList.remove('theme-midas');
    } else {
      document.documentElement.classList.add('theme-midas');
      document.documentElement.classList.remove('theme-icon');
    }
  }, [currentProgram]);

  return (
    <ProgramContext.Provider value={{ currentProgram, setProgram: setCurrentProgram }}>
      {children}
    </ProgramContext.Provider>
  );
};

export const useProgram = () => {
  const context = useContext(ProgramContext);
  if (context === undefined) {
    throw new Error('useProgram must be used within a ProgramProvider');
  }
  return context;
};
