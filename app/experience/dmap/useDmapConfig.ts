"use client";

import { onValue, ref, runTransaction } from "firebase/database";
import { useEffect, useState } from "react";

import { DEFAULT_DMAP_CONFIG, mergeDmapConfig } from "@/lib/dmap";
import type { DmapConfig } from "@/lib/dmap";
import { realtimeDatabase } from "@/lib/firebase";

export function useDmapConfig() {
  const [config, setConfig] = useState(DEFAULT_DMAP_CONFIG);

  useEffect(() => {
    const configPath = ref(realtimeDatabase, "dmap/config");
    void runTransaction(configPath, (current: Partial<DmapConfig> | null) => {
      const completeConfig = mergeDmapConfig(current);
      return JSON.stringify(current) === JSON.stringify(completeConfig) ? current : completeConfig;
    });
    return onValue(configPath, (snapshot) => setConfig(mergeDmapConfig(snapshot.val())));
  }, []);

  return config;
}
