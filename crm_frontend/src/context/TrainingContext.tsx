import { createContext, useContext, useCallback, type ReactNode } from "react";

interface TrainingContextValue {
  openTraining: (articleId?: string) => void;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

interface TrainingProviderProps {
  children: ReactNode;
  onNavigate: (view: string, articleId?: string) => void;
}

export function TrainingProvider({ children, onNavigate }: TrainingProviderProps) {
  const openTraining = useCallback(
    (articleId?: string) => {
      onNavigate("training", articleId);
    },
    [onNavigate]
  );

  return <TrainingContext.Provider value={{ openTraining }}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingContextValue {
  const ctx = useContext(TrainingContext);
  if (!ctx) {
    return {
      openTraining: () => {
        console.warn("TrainingProvider not mounted");
      },
    };
  }
  return ctx;
}
