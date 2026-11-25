import { createContext, useContext } from 'react';

export const MarkFormDirty = createContext<() => void>(() => {});

export function useMarkFormDirty() {
  return useContext(MarkFormDirty);
}
