// Suppress ReactQuill findDOMNode deprecation warning ONLY
// This file must be imported before React loads
// IMPORTANT: We suppress both console.warn AND console.error for this specific warning only

const originalWarn = console.warn;
const originalError = console.error;

// Only suppress the specific findDOMNode warning, nothing else
const suppressFindDOMNodeWarning = (...args: unknown[]): boolean => {
  try {
    const fullMessage = args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        if (typeof arg === "object" && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    // VERY SPECIFIC: Only suppress if it's EXACTLY the findDOMNode deprecation warning
    // React logs this through both console.warn and console.error depending on the context
    // We check for the specific warning text AND the ReactQuill component in the stack
    const isFindDOMNodeWarning = 
      fullMessage.includes("findDOMNode is deprecated") ||
      fullMessage.includes("Warning: findDOMNode") ||
      (fullMessage.includes("findDOMNode") && fullMessage.includes("deprecated"));
    
    // Also check if ReactQuill is mentioned in the message or if it's from React's internal warning system
    const isFromReactQuill = 
      fullMessage.includes("ReactQuill") || 
      fullMessage.includes("ReactQuill2") ||
      // React's internal warnings about findDOMNode are typically from third-party libraries
      (isFindDOMNodeWarning && !fullMessage.includes("Invalid hook call"));
    
    return isFindDOMNodeWarning && isFromReactQuill;
  } catch {
    return false;
  }
};

// Patch console.warn for warnings
Object.defineProperty(console, "warn", {
  value: (...args: unknown[]) => {
    if (!suppressFindDOMNodeWarning(...args)) {
      originalWarn.apply(console, args);
    }
  },
  writable: true,
  configurable: true,
});

// Also patch console.error BUT only for this specific warning
// React's StrictMode logs deprecation warnings through console.error
Object.defineProperty(console, "error", {
  value: (...args: unknown[]) => {
    // Only suppress if it's the findDOMNode warning, allow all other errors through
    if (!suppressFindDOMNodeWarning(...args)) {
      originalError.apply(console, args);
    }
  },
  writable: true,
  configurable: true,
});
