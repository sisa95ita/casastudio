import { configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 10_000 });

// React Router's memory data router uses the jsdom AbortSignal while Node's
// undici Request constructor expects its own realm's signal implementation.
const NodeRequest = globalThis.Request;

globalThis.Request = class TestRequest extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init ? { ...init, signal: undefined } : init);
  }
};
