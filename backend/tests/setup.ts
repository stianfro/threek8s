// Test setup file for Vitest
import { beforeAll, afterAll, afterEach } from "vitest";

// Mock environment variables for tests
process.env.NODE_ENV = "test";
process.env.PORT = "3002";
process.env.WS_PORT = "3002";

beforeAll(() => {
  // Setup before all tests
});

afterEach(() => {
  // Clean up after each test
});

afterAll(() => {
  // Cleanup after all tests
});
