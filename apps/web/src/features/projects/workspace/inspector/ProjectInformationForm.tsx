import {
  PROJECT_NAME_MAX_LENGTH,
  normalizeProjectName,
  prepareProjectName
} from "@casastudio/schema";
import { TextField } from "@mui/material";

/** Validation result for user-editable Project information. */
export type ProjectInformationValidation = {
  readonly preparedName: string;
  readonly error?: string;
};

/** Validates Project information using the same name normalization as the backend. */
export function validateProjectInformation(
  name: string,
  existingNames: readonly string[],
  messages: { required: string; tooLong: string; duplicate: string }
): ProjectInformationValidation {
  const preparedName = prepareProjectName(name);
  if (!preparedName) return { preparedName, error: messages.required };
  if (preparedName.length > PROJECT_NAME_MAX_LENGTH)
    return { preparedName, error: messages.tooLong };
  if (
    existingNames.some(
      (value) =>
        normalizeProjectName(value) === normalizeProjectName(preparedName)
    )
  )
    return { preparedName, error: messages.duplicate };
  return { preparedName };
}

/** Renders the reusable user-editable Project information fields. */
export function ProjectInformationForm({
  name,
  onNameChange,
  error,
  disabled,
  label
}: {
  readonly name: string;
  readonly onNameChange: (value: string) => void;
  readonly error?: string;
  readonly disabled: boolean;
  readonly label: string;
}) {
  return (
    <TextField
      autoFocus
      fullWidth
      required
      label={label}
      value={name}
      disabled={disabled}
      error={Boolean(error)}
      helperText={error ?? " "}
      slotProps={{ htmlInput: { maxLength: PROJECT_NAME_MAX_LENGTH + 1 } }}
      onChange={(event) => onNameChange(event.target.value)}
    />
  );
}
