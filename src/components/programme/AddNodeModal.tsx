import { X } from "lucide-react";
import { AddFormState, FormValues, ActivityStatus } from "./types";

interface AddNodeModalProps {
  addForm: AddFormState;
  formValues: FormValues;
  onChange: (values: FormValues) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function AddNodeModal({
  addForm,
  formValues,
  onChange,
  onConfirm,
  onClose,
}: AddNodeModalProps) {
  const set = (patch: Partial<FormValues>) => onChange({ ...formValues, ...patch });

  const inputCls =
    "w-full rounded border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
      <div className="border-border bg-card shadow-overlay w-96 rounded-lg border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-foreground text-sm font-semibold capitalize">Add {addForm.type}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {addForm.type === "activity" && (
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">Activity ID</label>
              <input
                className={inputCls}
                value={formValues.activityId}
                onChange={(e) => set({ activityId: e.target.value })}
                placeholder="e.g. A5000"
              />
            </div>
          )}

          <div>
            <label className="text-muted-foreground mb-1 block text-xs">Name *</label>
            <input
              autoFocus
              className={inputCls}
              value={formValues.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Enter name"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">Start</label>
              <input
                className={inputCls}
                value={formValues.start}
                onChange={(e) => set({ start: e.target.value })}
                placeholder="dd-Mmm-yy"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">Finish</label>
              <input
                className={inputCls}
                value={formValues.finish}
                onChange={(e) => set({ finish: e.target.value })}
                placeholder="dd-Mmm-yy"
              />
            </div>
          </div>

          {addForm.type !== "scope" && (
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">Total Hours</label>
              <input
                type="number"
                className={`${inputCls} no-input-spinner`}
                value={formValues.totalHours}
                onChange={(e) => set({ totalHours: e.target.value })}
              />
            </div>
          )}

          {addForm.type === "activity" && (
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">Status</label>
              <select
                className={inputCls}
                value={formValues.status}
                onChange={(e) => set({ status: e.target.value as ActivityStatus })}
              >
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!formValues.name.trim()}
            className="bg-foreground text-card rounded px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
