import { Box, ButtonBase, Typography } from "@mui/material";
import {
  useRef,
  type KeyboardEvent,
  type ReactNode
} from "react";

export type VisualChoiceOption<T extends string | number> = {
  readonly value: T;
  readonly label: string;
  readonly caption?: string;
  readonly disabled?: boolean;
  readonly thumbnail?: ReactNode;
};

/** Compact, natively scrollable visual radio group for Inspector choices. */
export function VisualChoiceStrip<T extends string | number>({
  label,
  options,
  value,
  onChange
}: {
  readonly label: string;
  readonly options: readonly VisualChoiceOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  const itemRefs = useRef(new Map<T, HTMLButtonElement>());
  const enabled = options.filter((option) => !option.disabled);
  const selectedIndex = options.findIndex(
    (option) => option.value === value && !option.disabled
  );
  const fallbackTabValue = enabled[0]?.value;

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    option: VisualChoiceOption<T>
  ) => {
    const currentIndex = enabled.findIndex(
      (candidate) => candidate.value === option.value
    );
    if (currentIndex < 0) return;
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % enabled.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = enabled.length - 1;
    else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onChange(option.value);
      return;
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = enabled[nextIndex];
    if (!next) return;
    onChange(next.value);
    itemRefs.current.get(next.value)?.focus();
  };

  return (
    <Box
      role="radiogroup"
      aria-label={label}
      data-testid="visual-choice-strip"
      data-editor-shortcut-scope="true"
      sx={{
        display: "flex",
        gap: 1,
        maxWidth: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        pb: 0.5,
        scrollSnapType: "x proximity"
      }}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <ButtonBase
            key={String(option.value)}
            ref={(node) => {
              if (node) itemRefs.current.set(option.value, node);
              else itemRefs.current.delete(option.value);
            }}
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            disabled={option.disabled}
            tabIndex={
              selected || (selectedIndex < 0 && option.value === fallbackTabValue)
                ? 0
                : -1
            }
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, option)}
            sx={{
              alignItems: "stretch",
              bgcolor: selected ? "action.selected" : "background.paper",
              border: "1px solid",
              borderColor: selected ? "primary.main" : "divider",
              borderRadius: 1.5,
              color: selected ? "primary.main" : "text.primary",
              display: "flex",
              flex: "0 0 76px",
              flexDirection: "column",
              minHeight: 70,
              overflow: "hidden",
              scrollSnapAlign: "start",
              transition: "border-color 120ms ease, background-color 120ms ease",
              "&:hover": {
                bgcolor: selected ? "action.selected" : "action.hover",
                borderColor: selected ? "primary.main" : "text.secondary"
              },
              "&.Mui-focusVisible": {
                outline: "3px solid",
                outlineColor: "primary.light",
                outlineOffset: 1
              }
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                alignItems: "center",
                display: "flex",
                flex: "1 1 auto",
                justifyContent: "center",
                minHeight: 48,
                p: 0.75,
                width: "100%"
              }}
            >
              {option.thumbnail}
            </Box>
            {option.caption ? (
              <Typography
                component="span"
                variant="caption"
                sx={{
                  borderTop: "1px solid",
                  borderColor: "divider",
                  display: "block",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  px: 0.5,
                  py: 0.5,
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  width: "100%"
                }}
              >
                {option.caption}
              </Typography>
            ) : null}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
