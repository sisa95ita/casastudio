import type { FurniturePropertyChanges } from "./project-furniture-authoring";
import {
  builtinFurnitureDefinitions,
  formatArchitecturalLength,
  type Project
} from "@casastudio/schema";
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useCasaTranslation } from "../../../../core/i18n";
import type { FurnitureEditorController } from "./useFurnitureEditor";

/** Contextual catalog, placement ownership, and exact instance editing in the Inspector. */
export function ProjectFurnitureProperties({
  controller: c,
  units,
  editable
}: {
  readonly controller: FurnitureEditorController;
  readonly units: Project["units"];
  readonly editable: boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const { item } = c;
  const definition = builtinFurnitureDefinitions.find(
    (entry) => entry.id === item?.definitionId
  );
  const draft = c.transient;
  const roomControl = (() => {
    const roomState =
      c.candidates.length === 0
        ? "none"
        : c.candidates.length === 1
          ? "resolved"
          : "choice";
    const common = {
      size: "small" as const,
      label: t("furniture.room")
    };
    if (c.candidates.length < 2) {
      return (
        <TextField
          {...common}
          value={c.candidates[0]?.name ?? t("furniture.noRoom")}
          disabled
          slotProps={{
            htmlInput: {
              "data-testid": "furniture-room-control",
              "data-room-state": roomState
            }
          }}
        />
      );
    }
    return (
      <TextField
        {...common}
        select
        value={
          c.candidates.some((room) => room.roomId === item?.roomId)
            ? item!.roomId
            : ""
        }
        disabled={!editable || Boolean(draft?.gesture)}
        onChange={(event) => c.chooseRoom(event.target.value)}
        slotProps={{
          htmlInput: {
            "data-testid": "furniture-room-control",
            "data-room-state": roomState
          }
        }}
      >
        <MenuItem value="" disabled>
          {t("furniture.chooseRoom")}
        </MenuItem>
        {c.candidates.map((room) => (
          <MenuItem key={room.roomId} value={room.roomId}>
            {room.name} · {room.floorElevation > 0 ? "+" : ""}
            {formatArchitecturalLength(room.floorElevation, units.length)}
          </MenuItem>
        ))}
      </TextField>
    );
  })();
  const field = (
    key: "width" | "depth" | "height" | "rotation" | "x" | "z"
  ) => {
    if (!item) return null;
    const value = key === "x" || key === "z" ? item.position[key] : item[key];
    const suffix = key === "rotation" ? "°" : units.length;
    const label = `${t(`furniture.${key}`)} (${suffix})`;
    return (
      <FurnitureNumber
        key={key}
        label={label}
        value={value}
        positive={["width", "depth", "height"].includes(key)}
        disabled={
          !editable || Boolean(draft?.gesture) || Boolean(draft?.awaitingRoom)
        }
        onCommit={(next) =>
          c.update(
            key === "x" || key === "z"
              ? { position: { ...item.position, [key]: next } }
              : ({ [key]: next } as FurniturePropertyChanges)
          )
        }
      />
    );
  };
  return (
    <Stack spacing={1.5} data-testid="furniture-properties">
      <Typography variant="subtitle2" component="h2">
        {t("tools.furniture")}
      </Typography>
      {c.authoring ? (
        <TextField
          select
          size="small"
          label={t("furniture.catalog")}
          value={item?.definitionId ?? ""}
          onChange={(event) => c.chooseDefinition(event.target.value)}
        >
          {builtinFurnitureDefinitions.map((entry) => (
            <MenuItem key={entry.id} value={entry.id}>
              {entry.category} · {entry.name}
            </MenuItem>
          ))}
          {item && !definition ? (
            <MenuItem value={item.definitionId}>
              {t("furniture.unknown")}
            </MenuItem>
          ) : null}
        </TextField>
      ) : item ? (
        <Typography variant="body2">
          {item.name ?? definition?.name ?? t("furniture.unknown")} ·{" "}
          {definition?.category ?? "GENERIC"}
        </Typography>
      ) : null}
      {item ? (
        <>
          {roomControl}
          {!c.authoring ? (
            <>
              <Typography variant="overline">
                {t("furniture.position")}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                  gap: 1
                }}
              >
                {field("x")}
                {field("z")}
              </Box>
            </>
          ) : null}
          <Typography variant="overline">
            {t("furniture.dimensions")}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 1
            }}
          >
            {field("width")}
            {field("depth")}
            {field("height")}
            {field("rotation")}
          </Box>
          <Divider />
          <Stack spacing={0.5} component="dl" sx={{ m: 0 }}>
            {c.room &&
            !c.candidates.some(
              (candidate) => candidate.roomId === item.roomId
            ) ? (
              <>
                <Typography variant="caption" component="dt">
                  {t("furniture.room")}
                </Typography>
                <Typography variant="caption" component="dd" sx={{ m: 0 }}>
                  {c.room.room.name}
                </Typography>
              </>
            ) : null}
            <Typography variant="caption" component="dt">
              {t("furniture.definition")}
            </Typography>
            <Typography
              variant="caption"
              component="dd"
              sx={{ m: 0, overflowWrap: "anywhere" }}
            >
              {item.definitionId}
            </Typography>
            {c.room ? (
              <>
                <Typography variant="caption" component="dt">
                  {t("furniture.floor")}
                </Typography>
                <Typography
                  variant="body2"
                  component="dd"
                  sx={{ m: 0 }}
                  data-testid="furniture-floor"
                >
                  {formatArchitecturalLength(
                    c.room.floorElevation,
                    units.length
                  )}
                </Typography>
              </>
            ) : null}
          </Stack>
        </>
      ) : null}
      {c.authoring || draft || c.error || c.validation?.status === "WARNING" ? (
        <Alert
          severity={
            c.error || c.validation?.status === "INVALID" ? "warning" : "info"
          }
        >
          {c.error === "WALL_INTERSECTION" ||
          c.validation?.status === "INVALID" &&
            c.validation.issue === "WALL_INTERSECTION"
            ? t("furniture.wallIntersection")
            : c.error === "FURNITURE_INTERSECTION" ||
                c.validation?.status === "INVALID" &&
                  c.validation.issue === "FURNITURE_INTERSECTION"
              ? t("furniture.furnitureIntersection")
              : c.error === "NO_ROOM" ||
                  c.validation?.status === "INVALID" &&
                    c.validation.issue === "NO_ROOM"
                ? t("furniture.outside")
                : c.error === "AMBIGUOUS_ROOM" ||
                    c.validation?.status === "INVALID" &&
                      c.validation.issue === "AMBIGUOUS_ROOM"
                  ? t("furniture.ambiguous")
                  : c.error
                    ? t("furniture.invalid")
                    : c.validation?.status === "WARNING"
                      ? t("furniture.stairWarning")
            : !draft
              ? t("furniture.selectHint")
              : !draft.positioned
                ? t("furniture.placeHint")
                : !c.candidates.length
                  ? t("furniture.outside")
                  : !item?.roomId
                    ? t("furniture.ambiguous")
                    : draft.awaitingRoom
                      ? t("furniture.confirmHint")
                      : draft.gesture
                        ? t("furniture.gestureHint")
                        : t("furniture.ready")}
        </Alert>
      ) : null}
      {editable ? (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {draft ? (
            <Button onClick={c.cancel}>{t("furniture.cancel")}</Button>
          ) : null}
          {draft?.awaitingRoom ? (
            <Button disabled={!item?.roomId} onClick={() => c.commit()}>
              {t("furniture.confirm")}
            </Button>
          ) : null}
          {!c.authoring && c.selected && !draft ? (
            <>
              <Button onClick={c.duplicate}>{t("furniture.duplicate")}</Button>
              <Button color="error" onClick={c.remove}>
                {t("furniture.delete")}
              </Button>
            </>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

function FurnitureNumber({
  label,
  value,
  positive,
  disabled,
  onCommit
}: {
  readonly label: string;
  readonly value: number;
  readonly positive: boolean;
  readonly disabled: boolean;
  readonly onCommit: (value: number) => boolean;
}) {
  const displayValue =
    value !== 0 && Math.abs(value) < 0.01 ? value : Number(value.toFixed(2));
  return (
    <TextField
      key={value}
      label={label}
      defaultValue={displayValue}
      size="small"
      type="number"
      disabled={disabled}
      slotProps={{
        htmlInput: { step: "any", ...(positive ? { min: 0 } : {}) }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      onChange={(event) =>
        (event.target as HTMLInputElement).setCustomValidity("")
      }
      onBlur={(event) => {
        const input = event.target as HTMLInputElement;
        const next = Number(input.value);
        if (
          input.value.trim() === "" ||
          !Number.isFinite(next) ||
          (positive && next <= 0) ||
          (next !== displayValue && !onCommit(next))
        ) {
          input.value = String(displayValue);
          input.setCustomValidity("Enter a valid value.");
          input.reportValidity();
        } else input.setCustomValidity("");
      }}
    />
  );
}
