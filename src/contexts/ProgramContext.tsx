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
    console.log("[ProgramContext] Mounting ProgramProvider. Initial program:", currentProgram);
    const fetchActiveProgram = async () => {
      try {
        console.log("[ProgramContext] Fetching active program from DB...");
        const { data, error } = await supabase.from('event_config').select('*').eq('id', 1).single();
        if (error) {
          console.error("[ProgramContext] Supabase query error fetching active program:", error);
          return;
        }
        console.log("[ProgramContext] Fetched event_config data:", data);
        if (data && data.capacities && (data.capacities as any).activeProgram) {
          const dbProgram = (data.capacities as any).activeProgram as Program;
          console.log("[ProgramContext] Active program from DB is:", dbProgram);
          if (dbProgram === 'ICON' || dbProgram === 'MIDAS') {
            if (dbProgram !== currentProgram) {
              console.log("[ProgramContext] Program mismatch. Updating state to:", dbProgram);
              setCurrentProgram(dbProgram);
            } else {
              console.log("[ProgramContext] Program matches DB:", dbProgram);
            }
          }
        } else {
          console.warn("[ProgramContext] No activeProgram key found in event_config capacities:", data?.capacities);
        }
      } catch (err) {
        console.error("[ProgramContext] Failed to fetch active program from database:", err);
      }
    };

    fetchActiveProgram();

    // Listen to changes in the event_config table
    console.log("[ProgramContext] Subscribing to event_config realtime channel...");
    const channel = supabase
      .channel('event-config-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_config',
        filter: 'id=eq.1'
      }, (payload) => {
        console.log("[ProgramContext] Realtime payload received:", payload);
        const newData = payload.new as any;
        if (newData && newData.capacities && newData.capacities.activeProgram) {
          const dbProgram = newData.capacities.activeProgram as Program;
          console.log("[ProgramContext] Realtime active program is:", dbProgram);
          if (dbProgram === 'ICON' || dbProgram === 'MIDAS') {
            setCurrentProgram(dbProgram);
          }
        }
      })
      .subscribe((status) => {
        console.log("[ProgramContext] Realtime channel status:", status);
      });

    return () => {
      console.log("[ProgramContext] Unsubscribing from realtime channel...");
      supabase.removeChannel(channel);
    };
  }, []);

  // Update theme and localStorage when local state updates
  useEffect(() => {
    console.log("[ProgramContext] Setting localStorage and applying theme classes for:", currentProgram);
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
    console.log("[ProgramContext] setProgram called with:", program);
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
        console.log("[ProgramContext] Updating database event_config capacities to:", updatedCapacities);
        const { error: updateErr } = await supabase
          .from('event_config')
          .update({
            capacities: updatedCapacities,
            updatedAt: new Date().toISOString()
          })
          .eq('id', 1);
        if (updateErr) {
          console.error("[ProgramContext] Database update error:", updateErr);
        } else {
          console.log("[ProgramContext] Database update successful.");
        }
      } else {
        console.error("[ProgramContext] Error fetching event_config for update:", error);
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

