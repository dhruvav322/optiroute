import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver for tests (used by Recharts ResponsiveContainer)
global.ResizeObserver = class ResizeObserver {
  constructor(cb) {
    this.cb = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};
