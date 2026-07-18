import type { ValidationErrorCode } from "./validation-error-code";

/**
 * Describes one domain validation failure.
 *
 * The code is machine-readable, the path identifies the failing Project
 * property, and the message is written for humans.
 */
export type ValidationError = {
  code: ValidationErrorCode;
  path: string;
  message: string;
};

/**
 * Standard result shape returned by CasaStudio validation phases.
 *
 * Validators collect all applicable failures and report validity without
 * throwing for domain validation errors.
 */
export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};
