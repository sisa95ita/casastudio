import { ProposalReview } from "./ProposalReview";
import { Project3DInspector } from "./Project3DInspector";
import { Project3DViewer } from "./Project3DViewer";
import { createArchitecturalScene3DModel } from "./model/architectural-scene-3d-model";
import { resolveArchitecturalSelection3D } from "./interaction/architectural-selection-3d";
import { demoProjectFixture } from "../../test/demo-project-fixture";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import type {
  DesignProposal,
  DesignReferenceView,
  DurableDesignProposal
} from "@casastudio/ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "../../core/api/CasaStudioApiClient";
import { useDesignGeneration } from "./useDesignGeneration";
import { AiRoomDesignPanel } from "./AiRoomDesignPanel";

const apiMocks = vi.hoisted(() => ({
  generateRoomDesign: vi.fn(),
  listRoomDesigns: vi.fn(),
  getDesignArtifact: vi.fn(),
  deleteDesignProposal: vi.fn(),
  replaceProject: vi.fn()
}));

vi.mock("../../core/api/ApiProvider", () => ({
  useCasaStudioApi: () => apiMocks
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
    generationMode: "edit" as const,
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

const inspectorModel = createArchitecturalScene3DModel(demoProjectFixture);
const inspectorLevel = inspectorModel.levels.find(
  (level) => level.floors.length
)!;
const inspectorRoom = resolveArchitecturalSelection3D(inspectorModel, {
  kind: "room",
  levelId: inspectorLevel.id,
  id: inspectorLevel.floors[0]!.roomId
});
const inspectorProps = {
  projectName: "Fixture house",
  model: inspectorModel,
  visibility: "all" as const
};
const inspectorReferences = references().map((reference) => ({
  ...reference,
  target: {
    ...reference.target,
    projectId: inspectorModel.sourceProjectId,
    levelId: inspectorRoom!.levelId,
    roomId: inspectorRoom!.id
  }
}));

const instructions = "Warm minimal living room";

function references(roomId = "room-1"): readonly DesignReferenceView[] {
  return (
    ["room-axonometric", "room-interior-a", "room-interior-b"] as const
  ).map((kind) => ({
    kind,
    target: {
      kind: "room",
      projectId: "project-1",
      levelId: "level-1",
      roomId
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
  }));
}

const capture = async () => references();
const panelProps = {
  projectId: "project-1",
  levelId: "level-1",
  roomId: "room-1",
  roomName: "Living room",
  capture
};

const durable: DurableDesignProposal = {
  ...proposal,
  projectRevision: 1,
  instructions,
  referenceFingerprint: "f".repeat(64),
  artifact: {
    ...proposal.artifact,
    uri: "/api/v1/projects/project-1/design-proposals/proposal-1/artifact",
    width: 1,
    height: 1,
    byteSize: 68,
    sha256: "a".repeat(64)
  }
};

function direction(value = instructions) {
  fireEvent.change(screen.getByRole("textbox", { name: "Design direction" }), {
    target: { value }
  });
}

const generateButton = () =>
  screen.getByRole("button", { name: "Generate design" });
const anotherButton = () => screen.getByRole("button", { name: "Try another" });
const previewButton = () => screen.getByRole("button", { name: "Open design" });
async function openReferences() {
  fireEvent.click(screen.getByRole("button", { name: "Inspect references" }));
  return screen.findByRole("dialog", { name: "Reference views" });
}
const activeImage = () => within(previewButton()).getByRole("img");
const disabled = (button: HTMLElement) =>
  (button as HTMLButtonElement).disabled;

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<Value>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function problem(code: string, detail: string, status = 503) {
  return new ApiRequestError("problem", "Sanitized API error", status, {
    type: "/problems/ai",
    title: "AI generation failure",
    status,
    detail,
    code
  });
}

async function renderReadyPanel() {
  const rendered = render(<AiRoomDesignPanel {...panelProps} />);
  await waitFor(() =>
    expect(
      document
        .querySelector("[data-generation-state]")
        ?.getAttribute("data-generation-state")
    ).not.toBe("preparing")
  );
  direction();
  return rendered;
}

async function renderGeneratedProposal() {
  await renderReadyPanel();
  fireEvent.click(screen.getByRole("button", { name: "Generate design" }));
  return screen.findByRole("button", { name: "Open design" });
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("Live HTTP is forbidden in proposal UX tests")
  );
  apiMocks.generateRoomDesign.mockResolvedValue(proposal);
  apiMocks.listRoomDesigns.mockResolvedValue({ proposals: [] });
});

afterEach(() => {
  cleanup();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(apiMocks.replaceProject).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("durable Room history", () => {
  beforeEach(() => {
    const NativeURL = URL;
    let next = 0;
    vi.stubGlobal(
      "URL",
      class extends NativeURL {
        static override createObjectURL = vi.fn(() => `blob:fixture-${++next}`);
        static override revokeObjectURL = vi.fn();
      }
    );
    apiMocks.getDesignArtifact.mockResolvedValue(
      new Blob(["fixture"], { type: "image/png" })
    );
    apiMocks.deleteDesignProposal.mockResolvedValue(undefined);
  });
  async function openHistory() {
    fireEvent.click(screen.getByRole("button", { name: "View history" }));
    return screen.findByRole("dialog", { name: /Room design history/ });
  }
  async function selectSaved() {
    const dialog = await openHistory();
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: new RegExp(instructions)
      })
    );
    await within(dialog).findByRole("img");
    return dialog;
  }
  it("keeps history secondary, loads only the selected artifact, and shares its URL with Review", async () => {
    apiMocks.listRoomDesigns.mockResolvedValue({ proposals: [durable] });
    const view = render(
      <AiRoomDesignPanel {...panelProps} projectRevision={2} />
    );
    await screen.findByText("1 saved proposal");
    expect(screen.queryByText(instructions)).toBeNull();
    expect(apiMocks.getDesignArtifact).not.toHaveBeenCalled();
    const dialog = await selectSaved();
    expect(within(dialog).getByRole("img").getAttribute("src")).toBe(
      "blob:fixture-1"
    );
    expect(
      within(dialog).getByText(/Historical design · revision 1/)
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Open design" })
    );
    const review = screen.getByRole("dialog", { name: /Proposal review/ });
    expect(within(review).getByRole("img").getAttribute("src")).toBe(
      "blob:fixture-1"
    );
    expect(within(review).getByText("Project revision 1")).toBeTruthy();
    expect(within(review).getByText(instructions)).toBeTruthy();
    expect(apiMocks.getDesignArtifact).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture-1");
    render(<AiRoomDesignPanel {...panelProps} projectRevision={1} />);
    const reloaded = await selectSaved();
    expect(
      within(reloaded).getByText("Current Project revision 1")
    ).toBeTruthy();
    expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();
  });
  it("reconciles one stable persisted/session ID and confirms deletion without Project mutation or generation", async () => {
    apiMocks.generateRoomDesign.mockResolvedValue(durable);
    await renderGeneratedProposal();
    await waitFor(() =>
      expect(activeImage().getAttribute("src")).toBe("blob:fixture-1")
    );
    await screen.findByText("1 saved proposal");
    const history = await openHistory();
    expect(
      within(history).getAllByRole("button", { name: new RegExp(instructions) })
    ).toHaveLength(1);
    fireEvent.click(
      within(history).getByRole("button", { name: "Open design" })
    );
    const review = screen.getByRole("dialog", { name: /Proposal review/ });
    fireEvent.click(
      within(review).getByRole("button", { name: "Delete saved design" })
    );
    const confirmation = screen.getByRole("dialog", {
      name: "Delete this saved design?"
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(confirmation).getByRole("button", { name: "Cancel" })
      )
    );
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Cancel" })
    );
    expect(apiMocks.deleteDesignProposal).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Delete this saved design?" })
      ).toBeNull()
    );
    fireEvent.click(
      within(review).getByRole("button", { name: "Delete saved design" })
    );
    const pending = deferred<void>();
    apiMocks.deleteDesignProposal.mockReturnValueOnce(pending.promise);
    const confirm = screen.getByRole("button", { name: "Delete design" });
    act(() => {
      confirm.click();
      confirm.click();
    });
    expect(apiMocks.deleteDesignProposal).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /Proposal review/ })
      ).toBeNull()
    );
    expect(
      within(history).getByText("No saved designs for this Room yet.")
    ).toBeTruthy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture-1");
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
  });
  it("aborts old Room artifacts, suppresses late completions and closes old Room surfaces", async () => {
    apiMocks.listRoomDesigns.mockResolvedValue({ proposals: [durable] });
    const pending = deferred<Blob>();
    apiMocks.getDesignArtifact.mockReturnValueOnce(pending.promise);
    const view = render(<AiRoomDesignPanel {...panelProps} />);
    const dialog = await openHistory();
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: new RegExp(instructions)
      })
    );
    await waitFor(() =>
      expect(apiMocks.getDesignArtifact).toHaveBeenCalledTimes(1)
    );
    const signal = apiMocks.getDesignArtifact.mock.calls[0]![2] as AbortSignal;
    apiMocks.listRoomDesigns.mockResolvedValue({ proposals: [] });
    view.rerender(
      <AiRoomDesignPanel
        {...panelProps}
        roomId="room-2"
        capture={() => Promise.resolve(references("room-2"))}
      />
    );
    await waitFor(() =>
      expect(apiMocks.listRoomDesigns).toHaveBeenLastCalledWith(
        "project-1",
        "level-1",
        "room-2",
        undefined,
        expect.any(AbortSignal)
      )
    );
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(new Blob(["obsolete"])));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText(instructions)).toBeNull();
    expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();
  });
  it("retains persisted results over late lists and direction changes, with explicit history refresh", async () => {
    const pending = deferred<{ proposals: readonly DurableDesignProposal[] }>();
    apiMocks.listRoomDesigns.mockReturnValueOnce(pending.promise);
    apiMocks.generateRoomDesign.mockResolvedValue(durable);
    await renderGeneratedProposal();
    await screen.findByText("1 saved proposal");
    await act(async () => pending.resolve({ proposals: [] }));
    direction("New direction");
    expect(screen.getByText("1 saved proposal")).toBeTruthy();
    const dialog = await openHistory();
    expect(
      within(dialog).getByRole("button", { name: new RegExp(instructions) })
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Refresh history" })
    );
    await waitFor(() =>
      expect(apiMocks.listRoomDesigns).toHaveBeenCalledTimes(2)
    );
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
  });
  it("retries only selected artifact retrieval after an error", async () => {
    apiMocks.listRoomDesigns.mockResolvedValue({ proposals: [durable] });
    apiMocks.getDesignArtifact.mockRejectedValueOnce(new Error("offline"));
    render(<AiRoomDesignPanel {...panelProps} />);
    const dialog = await openHistory();
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: new RegExp(instructions)
      })
    );
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Retry image" })
    );
    expect(await within(dialog).findByRole("img")).toBeTruthy();
    expect(apiMocks.getDesignArtifact).toHaveBeenCalledTimes(2);
    expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();
  });
  it("reports persistence failure without retrying", async () => {
    apiMocks.generateRoomDesign.mockRejectedValueOnce(
      problem("AI_PROPOSAL_PERSISTENCE_FAILED", "safe failure")
    );
    await renderReadyPanel();
    fireEvent.click(generateButton());
    expect(
      await screen.findByText(
        /The design was generated, but CasaStudio could not save/
      )
    ).toBeTruthy();
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    expect(apiMocks.getDesignArtifact).not.toHaveBeenCalled();
  });
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
    await screen.findByRole("button", { name: "Open design" });
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(2);
  });

  it("shows normalized generation telemetry without provider internals", async () => {
    await renderGeneratedProposal();
    expect(
      screen.queryByRole("button", { name: "Generation details" })
    ).toBeNull();
    fireEvent.click(previewButton());
    fireEvent.click(screen.getByRole("button", { name: "Generation details" }));
    const telemetry = screen.getByRole("region", {
      name: "Generation details"
    });
    expect(telemetry.textContent).toContain("gpt-5.6-sol");
    expect(telemetry.textContent).toContain("gpt-image-2.5-flare");
    expect(telemetry.textContent).toContain("1.2 s");
    expect(telemetry.textContent).toContain("1536×1024 PNG");
    expect(telemetry.textContent).toContain("2300 total tokens");
    expect(telemetry.textContent).toContain("Generation mode: edit");
    expect(telemetry.textContent).toContain(proposal.telemetry.generatedAt);
    expect(telemetry.textContent).not.toContain("requestId");
    expect(telemetry.textContent).not.toContain("response");
  });

  it("opens and closes the automatic reference preview accessibly without generating", async () => {
    render(<AiRoomDesignPanel {...panelProps} />);
    await openReferences();
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
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Room axonometric" })
      ).toBeNull()
    );
    expect(document.activeElement).toBe(trigger);
  });

  it("opens the generated image at a viewport-contained size and closes explicitly", async () => {
    const previewTrigger = await renderGeneratedProposal();
    previewTrigger.focus();
    fireEvent.click(previewTrigger);

    const dialog = await screen.findByRole("dialog", {
      name: /Proposal review/
    });
    const previewImage = within(dialog).getByRole("img", {
      name: "AI-generated interior design proposal for the selected Room"
    });

    expect(
      previewImage.closest('[data-editor-shortcut-scope="true"]')
    ).toBeTruthy();
    expect(previewImage.style.objectFit).toBe("contain");
    expect(previewImage.style.maxWidth).toBe("100%");
    expect(previewImage.style.maxHeight).toBe("calc(100dvh - 240px)");

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(previewTrigger);
  });

  it("closes with Escape and restores focus to the thumbnail control", async () => {
    const previewTrigger = await renderGeneratedProposal();
    previewTrigger.focus();
    fireEvent.click(previewTrigger);

    const dialog = await screen.findByRole("dialog", {
      name: /Proposal review/
    });
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(previewTrigger);
  });
});

describe("AiRoomDesignPanel transient proposal workflow", () => {
  it("prepares local references before enabling Generate and never submits automatically", async () => {
    const pending = deferred<readonly DesignReferenceView[]>();
    render(
      <AiRoomDesignPanel {...panelProps} capture={() => pending.promise} />
    );
    expect(
      screen.getByRole("status", { name: "AI Interior Designer" }).textContent
    ).toContain("Preparing local Room");
    expect(disabled(generateButton())).toBe(true);
    expect(
      screen
        .getByRole("region", { name: "AI Interior Designer" })
        .getAttribute("data-editor-shortcut-scope")
    ).toBe("true");
    direction("  ");
    expect(disabled(generateButton())).toBe(true);
    direction();
    expect(disabled(generateButton())).toBe(true);
    await act(async () => pending.resolve(references()));
    expect(
      screen.getByRole("status", { name: "AI Interior Designer" }).textContent
    ).toContain("References ready");
    expect(disabled(generateButton())).toBe(false);
    direction("");
    expect(disabled(generateButton())).toBe(true);
    expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();
  });

  it.each(["missing", "duplicate", "mismatched"])(
    "rejects %s required reference evidence locally",
    async (kind) => {
      const views =
        kind === "missing"
          ? references().slice(0, 1)
          : kind === "duplicate"
            ? [...references(), references()[0]]
            : references("room-other");
      const captureMock = vi
        .fn()
        .mockResolvedValueOnce(views)
        .mockResolvedValue(references());
      render(<AiRoomDesignPanel {...panelProps} capture={captureMock} />);
      direction();
      await openReferences();
      expect((await screen.findByRole("alert")).textContent).toContain(
        "Refresh"
      );
      expect(disabled(screen.getByRole("button", { name: "Refresh" }))).toBe(
        false
      );
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await screen.findByRole("button", { name: "Room axonometric" });
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(disabled(generateButton())).toBe(false));
      expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();
    }
  );

  it("communicates an indeterminate provider wait and keeps the original Room context", async () => {
    const pending = deferred<DesignProposal>();
    apiMocks.generateRoomDesign.mockReturnValueOnce(pending.promise);
    await renderReadyPanel();
    fireEvent.click(generateButton());
    const progress = screen.getByRole("progressbar", { name: "Generating…" });
    expect(progress.hasAttribute("aria-valuenow")).toBe(false);
    const status = screen.getByRole("status", { name: "AI Interior Designer" });
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Generating design for Living room");
    expect(status.textContent).toContain("few minutes");
    expect(status.textContent).not.toMatch(/\d+%/);
    expect(
      screen.queryByRole("button", { name: /Cancel generation/i })
    ).toBeNull();
    await openReferences();
    expect(disabled(screen.getByRole("button", { name: "Refresh" }))).toBe(
      true
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () => pending.resolve(proposal));
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(
      screen.getByRole("status", { name: "AI Interior Designer" }).textContent
    ).toContain("Proposal ready");
    expect(activeImage().getAttribute("src")).toBe(proposal.artifact.uri);
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledExactlyOnceWith(
      "project-1",
      {
        levelId: "level-1",
        roomId: "room-1",
        instructions,
        referenceViews: references()
      }
    );
    expect(
      (
        screen.getByRole("textbox", {
          name: "Design direction"
        }) as HTMLTextAreaElement
      ).value
    ).toBe(instructions);
  });

  it("requests one alternative per explicit action, selects its telemetry, and evicts the oldest fourth success", async () => {
    const variants = [1, 2, 3, 4].map((number) => ({
      ...proposal,
      id: `proposal-${number}`,
      artifact: {
        ...proposal.artifact,
        uri: `data:image/png;base64,variant${number}`
      },
      telemetry: {
        ...proposal.telemetry,
        orchestrationModel: `mock-model-${number}`,
        durationMs: number * 1000
      }
    }));
    variants.forEach((value) =>
      apiMocks.generateRoomDesign.mockResolvedValueOnce(value)
    );
    await renderGeneratedProposal();
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("group", { name: "Compare proposals" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Room axonometric" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Generation details" })
    ).toBeNull();
    for (let number = 2; number <= 4; number++) {
      fireEvent.click(anotherButton());
      await waitFor(() =>
        expect(activeImage().getAttribute("src")).toBe(
          variants[number - 1]!.artifact.uri
        )
      );
      expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(number);
    }
    const selectors = within(
      screen.getByRole("group", { name: "Compare proposals" })
    );
    expect(selectors.getAllByRole("button")).toHaveLength(3);
    expect(selectors.queryByRole("button", { name: "Proposal 1" })).toBeNull();
    expect(
      selectors
        .getByRole("button", { name: "Proposal 4" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    const selectSecond = selectors.getByRole("button", { name: "Proposal 2" });
    expect(selectSecond.tagName).toBe("BUTTON");
    expect(selectSecond.tabIndex).toBe(0);
    selectSecond.focus();
    fireEvent.click(selectSecond);
    expect(document.activeElement).toBe(selectSecond);
    expect(selectSecond.getAttribute("aria-pressed")).toBe("true");
    expect(activeImage().getAttribute("src")).toBe(variants[1]!.artifact.uri);
    const trigger = previewButton();
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Generation details" }));
    const telemetry = screen.getByRole("region", {
      name: "Generation details"
    });
    expect(telemetry.textContent).toContain("mock-model-2");
    expect(telemetry.textContent).toContain("2.0 s");
    expect(telemetry.textContent).not.toContain("mock-model-4");
    const dialog = await screen.findByRole("dialog", {
      name: /Proposal review/
    });
    expect(within(dialog).getByRole("img").getAttribute("src")).toBe(
      variants[1]!.artifact.uri
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Proposal 4" }));
    expect(within(dialog).getByRole("img").getAttribute("src")).toBe(
      variants[3]!.artifact.uri
    );
    expect(telemetry.textContent).toContain("mock-model-4");
    expect(telemetry.textContent).not.toContain("mock-model-2");
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(4);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(4);
  });

  it("keeps a successful proposal and its evidence after a failed alternative, then permits an explicit attempt", async () => {
    await renderGeneratedProposal();
    apiMocks.generateRoomDesign.mockRejectedValueOnce(
      new Error("raw provider secret")
    );
    fireEvent.click(anotherButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("raw provider secret");
    expect(activeImage().getAttribute("src")).toBe(proposal.artifact.uri);
    expect(disabled(anotherButton())).toBe(false);
    expect(
      (
        screen.getByRole("textbox", {
          name: "Design direction"
        }) as HTMLTextAreaElement
      ).value
    ).toBe(instructions);
    await openReferences();
    expect(
      await screen.findByRole("button", { name: "Interior perspective A" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Interior perspective B" })
    ).toBeTruthy();
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(anotherButton());
    await screen.findByRole("group", { name: "Compare proposals" });
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks duplicate Try another actions synchronously while preserving the existing preview", async () => {
    await renderGeneratedProposal();
    const pending = deferred<DesignProposal>();
    apiMocks.generateRoomDesign.mockReturnValueOnce(pending.promise);
    const button = anotherButton();
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(2);
    expect(disabled(button)).toBe(true);
    expect(previewButton()).toBeTruthy();
    await act(async () => pending.reject(new Error("failure")));
    expect(disabled(anotherButton())).toBe(false);
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["AI_PROVIDER_NOT_CONFIGURED", "not configured"],
    ["AI_AUTHENTICATION_FAILED", "credentials"],
    ["AI_MODEL_ACCESS_FAILED", "model"],
    ["AI_PROVIDER_UNAVAILABLE", "temporarily unavailable"],
    ["AI_GENERATION_FAILED", "could not complete"],
    ["AI_INVALID_PROVIDER_RESPONSE", "unusable design result"]
  ])(
    "renders actionable normalized %s errors without raw details",
    async (code, expected) => {
      apiMocks.generateRoomDesign.mockRejectedValueOnce(
        problem(code, "raw secret")
      );
      await renderReadyPanel();
      fireEvent.click(generateButton());
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain(expected);
      expect(alert.textContent).not.toContain("raw secret");
      expect(disabled(generateButton())).toBe(false);
      expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    "The AI provider is rate limited. Try again in 12 seconds.",
    "The AI provider is rate limited. Try again later.",
    "The AI provider's usage allowance is exhausted. Check the server's provider budget before trying again.",
    "The AI provider is rate limited. <script>bad()</script>"
  ])(
    "renders sanitized rate/allowance guidance as text without scheduling a retry: %s",
    async (detail) => {
      apiMocks.generateRoomDesign.mockRejectedValueOnce(
        problem("AI_RATE_LIMITED", detail, 429)
      );
      await renderReadyPanel();
      fireEvent.click(generateButton());
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(detail);
      expect(alert.querySelector("script")).toBeNull();
      expect(disabled(generateButton())).toBe(false);
      expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    problem("AI_GENERATION_TIMEOUT", "Timed out", 504),
    new ApiRequestError("network", "secret network details")
  ])(
    "explains ambiguous completion/billing without claiming nothing was generated",
    async (failure) => {
      apiMocks.generateRoomDesign.mockRejectedValueOnce(failure);
      await renderReadyPanel();
      fireEvent.click(generateButton());
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("result could not be confirmed");
      expect(alert.textContent).toContain("paid generation may have completed");
      expect(alert.textContent).toContain("usage or billing");
      expect(alert.textContent).not.toMatch(/nothing|no charge|click retry/i);
      expect(disabled(generateButton())).toBe(false);
      expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    }
  );

  it("clears comparisons on direction changes but preserves reference evidence and uses the new text only on click", async () => {
    await renderGeneratedProposal();
    direction("New direction");
    expect(screen.queryByRole("button", { name: "Open design" })).toBeNull();
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    fireEvent.click(generateButton());
    await screen.findByRole("button", { name: "Open design" });
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(2);
    expect(apiMocks.generateRoomDesign.mock.calls[1]![1].instructions).toBe(
      "New direction"
    );
    expect(
      apiMocks.generateRoomDesign.mock.calls[1]![1].referenceViews
    ).toEqual(references());
  });

  it("ignores surrounding whitespace edits in the normalized direction fingerprint", async () => {
    await renderGeneratedProposal();
    direction(`  ${instructions}  `);
    expect(previewButton()).toBeTruthy();
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
  });

  it("refreshes local references and clears proposals without any provider request", async () => {
    await renderGeneratedProposal();
    await openReferences();
    fireEvent.click(await screen.findByRole("button", { name: "Refresh" }));
    await screen.findByRole("button", { name: "Room axonometric" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(disabled(generateButton())).toBe(false));
    expect(screen.queryByRole("button", { name: "Open design" })).toBeNull();
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
  });

  it.each(["project", "level", "room", "scene", "capture"])(
    "clears old proposals when the %s context changes",
    async (kind) => {
      const { rerender } = await renderReadyPanel();
      fireEvent.click(generateButton());
      await screen.findByRole("button", { name: "Open design" });
      const nextProps = {
        ...panelProps,
        ...(kind === "project" ? { projectId: "project-2" } : {}),
        ...(kind === "level" ? { levelId: "level-2" } : {}),
        ...(kind === "room" ? { roomId: "room-2" } : {}),
        ...(kind === "scene" ? { sceneContext: {} } : {}),
        ...(kind === "capture" ? { capture: async () => references() } : {})
      };
      rerender(<AiRoomDesignPanel {...nextProps} />);
      expect(screen.queryByRole("button", { name: "Open design" })).toBeNull();
      expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    }
  );

  it("discards stale reference capture completions and retains the newest Room evidence", async () => {
    const old = deferred<readonly DesignReferenceView[]>();
    const { rerender } = render(
      <AiRoomDesignPanel {...panelProps} capture={() => old.promise} />
    );
    direction();
    rerender(
      <AiRoomDesignPanel
        {...panelProps}
        roomId="room-2"
        capture={async () => references("room-2")}
      />
    );
    await waitFor(() => expect(disabled(generateButton())).toBe(false));
    await act(async () => old.resolve(references()));
    fireEvent.click(generateButton());
    await screen.findByRole("button", { name: "Open design" });
    expect(
      apiMocks.generateRoomDesign.mock.calls[0]![1].referenceViews
    ).toEqual(references("room-2"));
  });

  it("does not discard a pending reference capture when direction text changes", async () => {
    const captureResult = deferred<readonly DesignReferenceView[]>();
    render(
      <AiRoomDesignPanel
        {...panelProps}
        capture={() => captureResult.promise}
      />
    );
    direction("Direction typed during local preparation");
    await act(async () => captureResult.resolve(references()));
    expect(disabled(generateButton())).toBe(false);
    expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"])(
    "ignores a stale generation %s after target changes without unlocking early",
    async (outcome) => {
      const pending = deferred<DesignProposal>();
      apiMocks.generateRoomDesign.mockReturnValueOnce(pending.promise);
      const { rerender } = await renderReadyPanel();
      fireEvent.click(generateButton());
      rerender(
        <AiRoomDesignPanel
          {...panelProps}
          roomId="room-2"
          roomName="Kitchen"
          capture={async () => references("room-2")}
        />
      );
      await waitFor(() =>
        expect(
          document
            .querySelector("[data-generation-state]")
            ?.getAttribute("data-generation-state")
        ).not.toBe("preparing")
      );
      expect(disabled(generateButton())).toBe(true);
      expect(
        screen.getByRole("status", { name: "AI Interior Designer" }).textContent
      ).toContain("Living room");
      fireEvent.click(generateButton());
      expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
      await act(async () =>
        outcome === "success"
          ? pending.resolve(proposal)
          : pending.reject(new Error("stale failure"))
      );
      expect(disabled(generateButton())).toBe(false);
      expect(screen.queryByRole("button", { name: "Open design" })).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    }
  );

  it("releases transient proposals on unmount/reload", async () => {
    const { unmount } = await renderReadyPanel();
    fireEvent.click(generateButton());
    await screen.findByRole("button", { name: "Open design" });
    unmount();
    await renderReadyPanel();
    expect(screen.queryByRole("button", { name: "Open design" })).toBeNull();
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
  });

  it("keeps the viewer's lock through panel deselection/reselection until the paid request settles", async () => {
    function ViewerHarness({ selected }: { selected: boolean }) {
      const generation = useDesignGeneration();
      return selected ? (
        <AiRoomDesignPanel {...panelProps} generation={generation} />
      ) : null;
    }
    const pending = deferred<DesignProposal>();
    apiMocks.generateRoomDesign.mockReturnValueOnce(pending.promise);
    const { rerender } = render(<ViewerHarness selected />);
    await waitFor(() =>
      expect(
        document
          .querySelector("[data-generation-state]")
          ?.getAttribute("data-generation-state")
      ).not.toBe("preparing")
    );
    direction();
    fireEvent.click(generateButton());
    rerender(<ViewerHarness selected={false} />);
    rerender(<ViewerHarness selected />);
    await waitFor(() =>
      expect(
        document
          .querySelector("[data-generation-state]")
          ?.getAttribute("data-generation-state")
      ).not.toBe("preparing")
    );
    direction();
    expect(disabled(generateButton())).toBe(true);
    fireEvent.click(generateButton());
    await act(async () => pending.resolve(proposal));
    expect(disabled(generateButton())).toBe(false);
    expect(screen.queryByRole("button", { name: "Open design" })).toBeNull();
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
  });
});

// Exercise the real Inspector container and renderer boundary, not a second AI workspace.
describe("Design Studio Inspector", () => {
  it("offers accessible modes, preserves Properties, and gives Designer a deliberate empty state", async () => {
    const view = render(<Project3DInspector {...inspectorProps} />);
    const properties = screen.getByRole("tab", { name: "Properties" });
    const designer = screen.getByRole("tab", { name: "Designer" });
    expect(properties.getAttribute("aria-selected")).toBe("true");
    properties.focus();
    fireEvent.keyDown(properties, { key: "ArrowRight" });
    expect(document.activeElement).toBe(designer);
    expect(screen.getByRole("heading", { name: "3D Properties" })).toBeTruthy();
    fireEvent.click(designer);
    expect(designer.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Select a Room to start designing.")).toBeTruthy();
    fireEvent.click(properties);
    expect(screen.getByRole("heading", { name: "3D Properties" })).toBeTruthy();
    expect(apiMocks.listRoomDesigns).not.toHaveBeenCalled();
    expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();
    view.unmount();
  });

  it("shares workspace space, targets the selected Room, and preserves session and references across modes", async () => {
    const captureMock = vi.fn(async () => inspectorReferences);
    render(
      <>
        <Project3DViewer
          mode="view"
          model={inspectorModel}
          visibility="all"
          onVisibilityChange={vi.fn()}
          onSelectionChange={vi.fn()}
        />
        <Project3DInspector
          {...inspectorProps}
          selection={inspectorRoom}
          referenceCapture={captureMock}
        />
      </>
    );
    expect(
      screen
        .getByTestId("project-3d-canvas")
        .querySelector(".project-3d-designer")
    ).toBeNull();
    await waitFor(() => expect(captureMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("tab", { name: "Designer" }));
    expect(
      screen.getByText(
        `Room: ${inspectorRoom?.floor?.roomName || inspectorRoom?.id}`
      )
    ).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    direction("x".repeat(2000));
    apiMocks.generateRoomDesign.mockResolvedValueOnce({
      ...proposal,
      target: inspectorReferences[0]!.target
    });
    fireEvent.click(generateButton());
    await screen.findByRole("button", { name: "Open design" });
    fireEvent.click(screen.getByRole("tab", { name: "Properties" }));
    expect(screen.getByTestId("project-3d-selection-details")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Designer" }));
    expect(activeImage().getAttribute("src")).toBe(proposal.artifact.uri);
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
    expect(apiMocks.listRoomDesigns).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledTimes(1);
    const reviewTrigger = previewButton();
    reviewTrigger.focus();
    fireEvent.click(reviewTrigger);
    const review = screen.getByRole("dialog", { name: /Proposal review/ });
    fireEvent.keyDown(review, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(reviewTrigger));
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
  });

  it("keeps the generation lock across modes and deselection, ignores the obsolete completion", async () => {
    const captureMock = vi.fn(async () => inspectorReferences);
    const pending = deferred<DesignProposal>();
    apiMocks.generateRoomDesign.mockReturnValueOnce(pending.promise);
    const view = render(
      <Project3DInspector
        {...inspectorProps}
        selection={inspectorRoom}
        referenceCapture={captureMock}
      />
    );
    await waitFor(() => expect(captureMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("tab", { name: "Designer" }));
    direction();
    fireEvent.click(generateButton());
    fireEvent.click(screen.getByRole("tab", { name: "Properties" }));
    fireEvent.click(screen.getByRole("tab", { name: "Designer" }));
    expect(disabled(generateButton())).toBe(true);
    view.rerender(
      <Project3DInspector {...inspectorProps} referenceCapture={captureMock} />
    );
    expect(screen.getByText("Select a Room to start designing.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Generating design"
    );
    view.rerender(
      <Project3DInspector
        {...inspectorProps}
        selection={inspectorRoom}
        referenceCapture={captureMock}
      />
    );
    await waitFor(() => expect(captureMock).toHaveBeenCalledTimes(2));
    direction();
    expect(disabled(generateButton())).toBe(true);
    fireEvent.click(generateButton());
    await act(async () => pending.resolve(proposal));
    expect(disabled(generateButton())).toBe(false);
    expect(screen.queryByRole("button", { name: "Open design" })).toBeNull();
    expect(apiMocks.generateRoomDesign).toHaveBeenCalledTimes(1);
  });
});

it("gives a stale Proposal Review an accessible empty state without fetching or generation", () => {
  render(
    <ProposalReview
      open
      retry={vi.fn()}
      entries={[]}
      onSelect={vi.fn()}
      onClose={vi.fn()}
      onDelete={vi.fn()}
    />
  );
  const review = screen.getByRole("dialog", { name: "Proposal review" });
  expect(
    within(review).getByText(/This proposal is no longer available/)
  ).toBeTruthy();
  expect(apiMocks.getDesignArtifact).not.toHaveBeenCalled();
  expect(apiMocks.generateRoomDesign).not.toHaveBeenCalled();
});
