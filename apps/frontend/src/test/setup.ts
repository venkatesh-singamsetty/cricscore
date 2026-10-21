import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<
    R extends void | Promise<void> = void,
    T = unknown,
  > extends TestingLibraryMatchers<any, T> {}
}
