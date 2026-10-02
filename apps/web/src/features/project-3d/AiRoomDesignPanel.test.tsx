import {
  act,
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
  createdAt: "2026-09-28T12:00:00.000Z",
  telemetry: {
    provider: "openai",
    orchestrationModel: "gpt-5.6-sol",
    imageModel: "gpt-image-2.5-flare",
    durationMs: 1234,
    generatedAt: "2026-09-28T12:00:00.000Z",
    image: {
      width: 1536,
      height: 1024,
      format: "png" as const,
      quality: "medium"
    },
    usage: {
      inputTokens: 700,
      outputTokens: 1600,
      cachedInputTokens: 100,
      totalTokens: 2300
    }
  }
} satisfies DesignProposal;

const instructions = "Warm minimal living room";

async function renderReadyPanel() {
  render(
    <AiRoomDesignPanel
      projectId="project-1"
      levelId="level-1"
      roomId="room-1"
      capture={async () => [
        {
          kind: "room-axonometric",
          target: {
            kind: "room",
            projectId: "project-1",
            levelId: "level-1",
            roomId: "room-1"
          },
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
        }
      ]}
    />
  );

  await screen.findByRole("button", { name: "Room axonometric" });

  fireEvent.change(screen.getByRole("textbox", { name: "Design direction" }), {
    target: { value: instructions }
  });
}

async function renderGeneratedProposal() {
  await renderReadyPanel();
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
  it("blocks duplicate clicks before rendering and throughout a pending request", async () => {
    let resolve!: (value: DesignProposal) => void;
    apiMocks.generateRoomDesign.mockReturnValue(
      new Promise<DesignProposal>((done) => {
        resolve = done;
      })
    );
    await renderReadyPanel();
    expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "Generate design" });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Design direction" }),
      {
        target: { value: "New direction while pending" }
      }
    );
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    await act(async () => resolve(proposal));
    expect(
      (
        screen.getByRole("button", {
          name: "Generate design"
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
  });

  it("releases pending state after failure and waits for an explicit new click", async () => {
    apiMocks.generateRoomDesign.mockRejectedValueOnce(
      new Error("mock failure")
    );
    await renderReadyPanel();
    fireEvent.click(screen.getByRole("button", { name: "Generate design" }));
    await screen.findByRole("alert");
    const button = screen.getByRole("button", { name: "Generate design" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    await screen.findByRole("button", { name: "Open full-size preview" });
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(2);
  });

  it("shows normalized generation telemetry without provider internals", async () => {
    await renderGeneratedProposal();

    const telemetry = screen.getByLabelText("Generation details");
    expect(telemetry.textContent).toContain("gpt-5.6-sol");
    expect(telemetry.textContent).toContain("gpt-image-2.5-flare");
    expect(telemetry.textContent).toContain("1.2 s");
    expect(telemetry.textContent).toContain("1536×1024 PNG");
    expect(telemetry.textContent).toContain("2300 total tokens");
    expect(telemetry.textContent).not.toContain("requestId");
    expect(telemetry.textContent).not.toContain("response");
  });

  it("opens and closes the automatic reference preview accessibly without generating", async () => {
    render(
      <AiRoomDesignPanel
        projectId="project-1"
        levelId="level-1"
        roomId="room-1"
        capture={async () => [
          {
            kind: "room-axonometric",
            target: {
              kind: "room",
              projectId: "project-1",
              levelId: "level-1",
              roomId: "room-1"
            },
            image: {
              dataUrl: "data:image/png;base64,cmVmZXJlbmNl",
              mimeType: "image/png",
              width: 960,
              height: 720
            },
            camera: {
              projection: "perspective",
              position: { x: 1, y: 2, z: 3 },
              direction: { x: 0, y: 0, z: -1 },
              up: { x: 0, y: 1, z: 0 }
            }
          }
        ]}
      />
    );
    const trigger = await screen.findByRole("button", {
      name: "Room axonometric"
    });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Room axonometric"
    });
    expect(
      within(dialog).getByRole("img", { name: "Room axonometric" })
    ).toBeTruthy();
    expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

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

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close preview" })
    );

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
