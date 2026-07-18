import type { ValidationErrorCode } from "./validation-error-code";

export type ValidationError = {
  code: ValidationErrorCode;
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

