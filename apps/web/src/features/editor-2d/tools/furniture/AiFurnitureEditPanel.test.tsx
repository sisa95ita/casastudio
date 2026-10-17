import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFurnitureItemFromDefinition,
  resolveBuiltinFurnitureDefinition,
  ProjectSchema,
  type FurnitureCommand
} from "@casastudio/schema";
import { createAppStore } from "../../../../app/store/store";
import { furnitureProjectFixture } from "../../../../test/furniture-project-fixture";
import {
  editingSessionEntered,
  editingDraftReplaced,
  editorUndoRequested,
  editorRedoRequested
} from "../../state/project-editor-slice";
import { AiFurnitureEditPanel } from "./AiFurnitureEditPanel";

const api = vi.hoisted(() => ({
  proposeFurnitureEdit: vi.fn(),
  getProject: vi.fn()
}));
vi.mock("../../../../core/api/ApiProvider", () => ({
  useCasaStudioApi: () => api
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

function setup(anchorPoint?: { x: number; z: number }) {
  const project = furnitureProjectFixture();
  project.building.furniture = [
    createFurnitureItemFromDefinition(
      resolveBuiltinFurnitureDefinition("generic-chair")!,
      {
        id: "item-a",
        roomId: "living",
        position: { x: 200, z: 200 },
        rotation: 30
      }
    )
  ];
  const store = createAppStore();
  store.dispatch(
    editingSessionEntered({ project, baseRevision: project.revision })
  );
  api.getProject.mockResolvedValue({ project });
  render(
    <Provider store={store}>
      <AiFurnitureEditPanel
        anchorPoint={anchorPoint}
        levelId="ground"
        selectedFurnitureIds={["item-a"]}
        blocked={false}
        canPick
        picking={false}
        onPick={vi.fn()}
        onClearAnchor={vi.fn()}
      />
    </Provider>
  );
  fireEvent.click(screen.getByText("AI Furniture editing"));
  fireEvent.change(screen.getByLabelText("Furniture edit instruction"), {
    target: { value: "Rotate this Furniture 90 degrees" }
  });
  return { project, store };
}
const rotate: FurnitureCommand = {
  type: "ROTATE_FURNITURE",
  furnitureId: "item-a",
  targetRotation: 120
};
async function propose(
  projectId: string,
  projectRevision: number,
  operations: FurnitureCommand[] = [rotate]
) {
  api.proposeFurnitureEdit.mockResolvedValue({
    projectId,
    projectRevision,
    result: { kind: "EDIT_PROPOSAL", operations }
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Request edit proposal" })
  );
  await screen.findByTestId("furniture-edit-review");
}

describe("AI Furniture editor explicit review and normal history", () => {
  it.each([
    {
      type: "MOVE_FURNITURE",
      furnitureId: "item-a",
      targetPosition: { x: 150, z: 350 }
    },
    rotate,
    {
      type: "ADD_FURNITURE",
      definitionId: "generic-desk",
      roomId: "living",
      position: { x: 150, z: 400 },
      rotation: 0
    },
    {
      type: "TRANSFER_FURNITURE",
      furnitureId: "item-a",
      targetRoomId: "other",
      targetPosition: { x: 850, z: 450 }
    }
  ] satisfies FurnitureCommand[])(
    "reviews $type without mutation, then Apply/Undo/Redo/Save serialize normally",
    async (operation) => {
      const { project, store } = setup();
      const before = JSON.stringify(store.getState().projectEditor.draft);
      await propose(project.id, project.revision, [operation]);
      expect(JSON.stringify(store.getState().projectEditor.draft)).toBe(before);
      expect(store.getState().projectEditor.dirty).toBe(false);
      expect(store.getState().projectEditor.history.past).toHaveLength(0);
      expect(api.proposeFurnitureEdit).toHaveBeenCalledWith(
        project.id,
        expect.objectContaining({
          selectedFurnitureIds: ["item-a"],
          baseRevision: project.revision
        })
      );
      fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
      await waitFor(() =>
        expect(store.getState().projectEditor.dirty).toBe(true)
      );
      const applied = store.getState().projectEditor.draft!;
      expect(api.proposeFurnitureEdit).toHaveBeenCalledTimes(1);
      expect(api.getProject).toHaveBeenCalledTimes(1);
      expect(store.getState().projectEditor.history.past).toHaveLength(1);
      if (operation.type === "ADD_FURNITURE") {
        expect(applied.building.furniture.at(-1)).toMatchObject({
          id: expect.stringMatching(/^furniture-[a-f0-9-]+$/),
          width: 120,
          depth: 60,
          height: 75,
          roomId: "living"
        });
      } else if (operation.type === "TRANSFER_FURNITURE") {
        expect(applied.building.furniture[0]).toMatchObject({
          roomId: "other",
          position: operation.targetPosition,
          rotation: 30
        });
        expect(applied.building.furniture[0]).not.toHaveProperty("levelId");
      } else if (operation.type === "MOVE_FURNITURE") {
        expect(applied.building.furniture[0]!.position).toEqual(
          operation.targetPosition
        );
      } else
        expect(applied.building.furniture[0]).toMatchObject({
          rotation: 120,
          position: { x: 200, z: 200 }
        });
      act(() => {
        store.dispatch(editorUndoRequested());
      });
      expect(JSON.stringify(store.getState().projectEditor.draft)).toBe(before);
      expect(store.getState().projectEditor.dirty).toBe(false);
      act(() => {
        store.dispatch(editorRedoRequested());
      });
      expect(store.getState().projectEditor.draft).toEqual(applied);
      expect(ProjectSchema.parse(JSON.parse(JSON.stringify(applied)))).toEqual(
        applied
      );
    }
  );
  it("sends the canonical here anchor and reviews catalog placement without committing it", async () => {
    const anchor = { x: 150, z: 400 };
    const { project, store } = setup(anchor);
    await propose(project.id, project.revision, [
      {
        type: "ADD_FURNITURE",
        definitionId: "generic-desk",
        roomId: "living",
        position: anchor,
        rotation: 0
      }
    ]);
    expect(api.proposeFurnitureEdit).toHaveBeenCalledWith(
      project.id,
      expect.objectContaining({
        placementHint: { roomId: "living", position: anchor }
      })
    );
    expect(store.getState().projectEditor.draft).toEqual(project);
  });
  it("ignores a late response after Cancel", async () => {
    const { project, store } = setup();
    let finish!: (value: unknown) => void;
    api.proposeFurnitureEdit.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Request edit proposal" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    await act(async () => {
      finish({
        projectId: project.id,
        projectRevision: project.revision,
        result: { kind: "EDIT_PROPOSAL", operations: [rotate] }
      });
    });
    expect(screen.queryByTestId("furniture-edit-review")).toBeNull();
    expect(store.getState().projectEditor.draft).toEqual(project);
  });
  it("commits a bounded related batch as one Undo transaction", async () => {
    const { project, store } = setup();
    await propose(project.id, project.revision, [
      {
        type: "MOVE_FURNITURE",
        furnitureId: "item-a",
        targetPosition: { x: 150, z: 350 }
      },
      rotate
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    await waitFor(() =>
      expect(store.getState().projectEditor.dirty).toBe(true)
    );
    expect(store.getState().projectEditor.history.past).toHaveLength(1);
    act(() => {
      store.dispatch(editorUndoRequested());
    });
    expect(store.getState().projectEditor.draft).toEqual(project);
  });
  it("Cancel dismisses a preview without canonical changes", async () => {
    const { project, store } = setup();
    await propose(project.id, project.revision);
    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(screen.queryByTestId("furniture-edit-review")).toBeNull();
    expect(store.getState().projectEditor.draft).toEqual(project);
    expect(api.getProject).not.toHaveBeenCalled();
  });
  it.each(["CLARIFICATION_REQUIRED", "UNSUPPORTED_REQUEST"])(
    "shows %s and keeps the Project immutable",
    async (kind) => {
      const { project, store } = setup();
      api.proposeFurnitureEdit.mockResolvedValue({
        projectId: project.id,
        projectRevision: project.revision,
        result: { kind, message: "Fixture response" }
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Request edit proposal" })
      );
      await screen.findByText(/Fixture response/);
      expect(
        screen.queryByRole("button", { name: "Apply changes" })
      ).toBeNull();
      expect(store.getState().projectEditor.draft).toEqual(project);
    }
  );
  it("provider failure leaves canonical state and history intact", async () => {
    const { project, store } = setup();
    api.proposeFurnitureEdit.mockRejectedValue(
      new Error("Fixture provider failed")
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Request edit proposal" })
    );
    await screen.findByText("Fixture provider failed");
    expect(store.getState().projectEditor.draft).toEqual(project);
    expect(store.getState().projectEditor.history.past).toHaveLength(0);
  });
  it("blocks unsaved edits before requesting and blocks proposals after local edits", async () => {
    const { project, store } = setup();
    await propose(project.id, project.revision);
    act(() => {
      store.dispatch(
        editingDraftReplaced({ ...project, name: "Unsaved local change" })
      );
    });
    expect(screen.getByText(/Save your Project before/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Request edit proposal"
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Apply changes"
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(api.proposeFurnitureEdit).toHaveBeenCalledTimes(1);
  });
  it("blocks Apply when persisted revision N has changed to N+1", async () => {
    const { project, store } = setup();
    await propose(project.id, project.revision);
    api.getProject.mockResolvedValue({
      project: { ...project, revision: project.revision + 1 }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    await screen.findByText(/This proposal is stale. Save or reload/);
    expect(store.getState().projectEditor.draft).toEqual(project);
    expect(api.proposeFurnitureEdit).toHaveBeenCalledTimes(1);
  });
  it("checks current editor state again after the asynchronous persisted revision read", async () => {
    const { project, store } = setup();
    await propose(project.id, project.revision);
    let finish!: (value: unknown) => void;
    api.getProject.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    act(() => {
      store.dispatch(
        editingDraftReplaced({ ...project, name: "Concurrent local edit" })
      );
    });
    await act(async () => {
      finish({ project });
    });
    await screen.findByText(/This proposal is stale. Save or reload/);
    expect(store.getState().projectEditor.draft!.name).toBe(
      "Concurrent local edit"
    );
    expect(
      store.getState().projectEditor.draft!.building.furniture[0]!.rotation
    ).toBe(30);
  });
});
