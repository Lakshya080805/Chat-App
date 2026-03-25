import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

const GroupModal = ({ isOpen, onClose, users = [], onSubmit, isLoading }) => {
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  useEffect(() => {
    if (!isOpen) {
      setGroupName("");
      setSelectedMemberIds([]);
    }
  }, [isOpen]);

  const toggleMember = (memberId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const availableUsers = useMemo(() => users || [], [users]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }

    if (!selectedMemberIds.length) {
      toast.error("Select at least one member");
      return;
    }

    await onSubmit({ name: groupName.trim(), memberIds: selectedMemberIds });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-base-100 shadow-xl border border-base-200">
        <form className="flex flex-col" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-base-200 px-4 py-3">
            <h3 className="text-lg font-semibold">Create Group</h3>
            <button type="button" className="text-zinc-500" onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-base-content/70">Group name</label>
              <input
                className="input input-bordered w-full mt-1"
                placeholder="E.g. Project Chat"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-base-content/70">Add members</p>
              <div className="max-h-52 overflow-y-auto space-y-2">
                {isLoading ? (
                  <p className="text-sm text-center text-zinc-500">Loading contacts…</p>
                ) : (
                  availableUsers.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => toggleMember(user._id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        selectedMemberIds.includes(user._id)
                          ? "border-primary bg-primary/10"
                          : "border-base-200 bg-base-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={user.profilePic || "/avatar.png"}
                          alt={user.fullName}
                          className="size-8 rounded-full object-cover border"
                        />
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          <p className="text-xs text-zinc-400">{user.email}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-base-200 px-4 py-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm flex-1"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm flex-1"
              disabled={!groupName.trim() || !selectedMemberIds.length}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupModal;
