// Test setup file
const globalAny = globalThis as any;
globalAny.window = globalAny.window || {};
globalAny.window.__TAURI_INTERNALS__ = {};
