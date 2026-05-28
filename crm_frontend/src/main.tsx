// Suppress ReactQuill findDOMNode deprecation warning - import first
import './suppress-warnings';

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Additional suppression layer - the main suppression is in suppress-warnings.ts
// This is a backup in case React loads before suppress-warnings.ts
const suppressFindDOMNode = (...args: unknown[]): boolean => {
  try {
    const msg = args.map(a => {
      if (typeof a === 'string') return a;
      if (typeof a === 'object' && a !== null) {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');
    
    // VERY SPECIFIC: Only suppress findDOMNode warnings
    const isFindDOMNodeWarning = 
      msg.includes('findDOMNode is deprecated') ||
      msg.includes('Warning: findDOMNode') ||
      (msg.includes('findDOMNode') && msg.includes('deprecated'));
    
    // Don't suppress if it's an "Invalid hook call" error
    if (msg.includes('Invalid hook call')) {
      return false;
    }
    
    return isFindDOMNodeWarning;
  } catch {
    return false;
  }
};

// Backup suppression for console.warn
const originalWarn = console.warn.bind(console);
Object.defineProperty(console, 'warn', {
  value: function(...args: unknown[]) {
    if (!suppressFindDOMNode(...args)) {
      originalWarn(...args);
    }
  },
  writable: true,
  configurable: true
});

// Backup suppression for console.error (only for findDOMNode warnings)
const originalError = console.error.bind(console);
Object.defineProperty(console, 'error', {
  value: function(...args: unknown[]) {
    // Only suppress findDOMNode warnings, allow all other errors through
    if (!suppressFindDOMNode(...args)) {
      originalError(...args);
    }
  },
  writable: true,
  configurable: true
});

createRoot(document.getElementById("root")!).render(<App />);
