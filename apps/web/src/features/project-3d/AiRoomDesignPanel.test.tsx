import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import type { DesignProposal } from "@casastudio/ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiRoomDesignPanel } from "./AiRoomDesignPanel";

const apiMocks = vi.hoisted(() => ({
  generateRoomDesign: vi.fn()
}));

vi.mock("../../core/api/ApiProvider", () => ({
  useCasaStudioApi: () => ({
    generateRoomDesign: apiMocks.generateRoomDesign
  })
}));

const proposal = {
  id: "proposal-1",
  target: {
    kind: "room" as const,
    projectId: "project-1",
    levelId: "level-1",
    roomId: "room-1"
  },
  status: "succeeded" as const,
  artifact: {
    kind: "image" as const,
    mimeType: "image/png" as const,
    uri: "data:image/png;base64,cHJvcG9zYWw="
  },
  createdAt: "2026-09-28T12:00:00.000Z"
} satisfies DesignProposal;

const instructions = "Warm minimal living room";

async function renderGeneratedProposal() {
  render(
    <AiRoomDesignPanel
      projectId="project-1"
      levelId="level-1"
      roomId="room-1"
      capture={() => ({
        image: {
          dataUrl: "data:image/png;base64,cmVmZXJlbmNl",
          mimeType: "image/png",
          width: 1024,
          height: 768
        },
        camera: {
          projection: "perspective",
          position: { x: 0, y: 2, z: 5 },
          direction: { x: 0, y: 0, z: -1 },
          up: { x: 0, y: 1, z: 0 },
          verticalFovDegrees: 45
        }
      })}
    />
  );

  fireEvent.change(screen.getByRole("textbox", { name: "Design direction" }), {
    target: { value: instructions }
  });
  fireEvent.click(screen.getByRole("button", { name: "Generate design" }));

  return screen.findByRole("button", { name: "Open full-size preview" });
}

beforeEach(() => {
  apiMocks.generateRoomDesign.mockResolvedValue(proposal);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AiRoomDesignPanel proposal preview", () => {
  it("opens the generated image at a viewport-contained size and closes explicitly", async () => {
    const previewTrigger = await renderGeneratedProposal();
    previewTrigger.focus();
    fireEvent.click(previewTrigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Design proposal preview"
    });
    const previewImage = within(dialog).getByRole("img", {
      name: "AI-generated interior design proposal for the selected Room"
    });

    expect(previewImage.style.objectFit).toBe("contain");
    expect(previewImage.style.maxWidth).toBe("calc(100vw - 64px)");
    expect(previewImage.style.maxHeight).toBe("calc(100dvh - 160px)");

    fireEvent.click(within(dialog).getByRole("button", { name: "Close preview" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(previewTrigger);
  });

  it("closes with Escape and restores focus to the thumbnail control", async () => {
    const previewTrigger = await renderGeneratedProposal();
    previewTrigger.focus();
    fireEvent.click(previewTrigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Design proposal preview"
    });
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(previewTrigger);
  });
});
