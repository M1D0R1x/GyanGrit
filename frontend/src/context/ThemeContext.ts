import { createContext } from "react";

export type ThemeContextType = {
  theme: "light" | "dark";
  toggleTheme: (event?: React.MouseEvent) => void;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
