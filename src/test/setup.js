import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

// Framer Motion does a lot of runtime work that isn't relevant for unit tests.
vi.mock('framer-motion', () => {
  function passthrough(tag) {
    return function MotionComponent({ children, ...props }) {
      return React.createElement(tag, props, children);
    };
  }

  const motionProxy = new Proxy(
    {},
    {
      get(_target, key) {
        // Default to a div if an unknown motion tag is used.
        return passthrough(typeof key === 'string' ? key : 'div');
      },
    },
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

// Some components use window.alert for validation flows.
// Tests can override this per-case if they need to assert calls.
if (!window.alert) {
  window.alert = () => {};
}

