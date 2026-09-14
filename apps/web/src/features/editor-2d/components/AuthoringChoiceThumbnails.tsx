import type { RoomShapeKind } from "@casastudio/schema";
import type { StairTemplate } from "../tools/stair/project-stair-authoring";

const common = {
  fill: "#f4f1e9",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinejoin: "round" as const
};

/** Small plan-language geometry mark for Room shape selection. */
export function RoomShapeThumbnail({ shape }: { readonly shape: RoomShapeKind }) {
  const points: Record<RoomShapeKind, string> = {
    RECTANGLE: "8,9 56,9 56,39 8,39",
    L_SHAPE: "8,8 35,8 35,24 56,24 56,40 8,40",
    U_SHAPE: "8,8 23,8 23,27 41,27 41,8 56,8 56,40 8,40",
    T_SHAPE: "8,8 56,8 56,23 40,23 40,40 24,40 24,23 8,23"
  };
  return (
    <svg viewBox="0 0 64 48" width="64" height="48" focusable="false">
      <polygon points={points[shape]} {...common} />
    </svg>
  );
}

/** Compact flight/landing mark using the same clean plan conventions as the canvas. */
export function StairTemplateThumbnail({
  template
}: {
  readonly template: StairTemplate;
}) {
  return (
    <svg viewBox="0 0 64 48" width="64" height="48" focusable="false">
      {template === "STRAIGHT" ? (
        <>
          <rect x="20" y="5" width="24" height="38" {...common} />
          {[12, 19, 26, 33].map((y) => (
            <line key={y} x1="20" y1={y} x2="44" y2={y} stroke="currentColor" strokeWidth="1.25" />
          ))}
          <path d="M32 36V12m0 0-4 5m4-5 4 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </>
      ) : template === "L_SHAPED" ? (
        <>
          <path d="M10 40V15h22V7h22v22H32v11Z" {...common} />
          <path d="M21 35V20h24m0 0-5-4m5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="32" y1="15" x2="32" y2="29" stroke="currentColor" strokeWidth="1.25" />
        </>
      ) : (
        <>
          <path d="M8 40V10h18v20h12V10h18v30H38V30H26v10Z" {...common} />
          <path d="M17 35V17m0 0-4 5m4-5 4 5M47 17v18" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="26" y="22" width="12" height="8" fill="#e6e1d7" stroke="currentColor" strokeWidth="1.25" />
        </>
      )}
    </svg>
  );
}
