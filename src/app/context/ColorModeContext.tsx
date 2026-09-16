import { createContext, useContext } from 'react';
export const ColorModeContext = createContext({ mode: 'light' as 'light' | 'dark', toggle: () => {} });
export const useColorMode = () => useContext(ColorModeContext);
