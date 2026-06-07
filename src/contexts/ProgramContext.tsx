import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

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

  // Fetch active program from DB on mount and subscribe to realtime changes
  useEffect(() => {
    const fetchActiveProgram = async () => {
      try {
        const { data, error } = await supabase.from('event_config').select('*').eq('id', 1).single();
        if (!error && data && data.capacities && (data.capacities as any).activeProgram) {
          const dbProgram = (data.capacities as any).activeProgram as Program;
          if (dbProgram === 'ICON' || dbProgram === 'MIDAS') {
            setCurrentProgram(dbProgram);
          }
        }
      } catch (err) {
        console.error("Failed to fetch active program from database:", err);
      }
    };

    fetchActiveProgram();

    // Listen to changes in the event_config table
    const channel = supabase
      .channel('event-config-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_config',
        filter: 'id=eq.1'
      }, (payload) => {
        const newData = payload.new as any;
        if (newData && newData.capacities && newData.capacities.activeProgram) {
          const dbProgram = newData.capacities.activeProgram as Program;
          if (dbProgram === 'ICON' || dbProgram === 'MIDAS') {
            setCurrentProgram(dbProgram);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update theme and localStorage when local state updates
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

  const setProgram = async (program: Program) => {
    setCurrentProgram(program);
    localStorage.setItem('currentProgram', program);

    try {
      // Read current config to avoid overwriting other keys inside capacities
      const { data, error } = await supabase.from('event_config').select('*').eq('id', 1).single();
      if (!error && data) {
        const updatedCapacities = {
          ...(data.capacities || {}),
          activeProgram: program
        };
        await supabase
          .from('event_config')
          .update({
            capacities: updatedCapacities,
            updatedAt: new Date().toISOString()
          })
          .eq('id', 1);
      }
    } catch (err) {
      console.error("Failed to sync program override to database:", err);
    }
  };

  return (
    <ProgramContext.Provider value={{ currentProgram, setProgram }}>
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

