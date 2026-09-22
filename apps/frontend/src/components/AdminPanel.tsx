import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import LiveScoreboard from "./LiveScoreboard";

interface User {
  username: string;
  email: string;
  status: string;
  isAdmin: boolean;
  isScorer: boolean;
}

interface AdminPanelProps {
  hubKey: number;
  urlMatchId?: string;
  isAdmin: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  hubKey,
  urlMatchId,
  isAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<"USERS" | "MATCHES">("USERS");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<User | null>(null);

  // Custom Modals for Bulk Actions
  const [pendingBulkAction, setPendingBulkAction] = useState<
    | "delete-all-guests"
    | "delete-all-guest-matches"
    | "delete-all-matches"
    | null
  >(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    setMessage("");
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch users");
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setMessage(`❌ Error fetching users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "USERS") {
      fetchUsers();
    }
  }, [activeTab]);

  const handleRoleAction = async (
    email: string,
    role: string,
    action: "promote" | "demote",
  ) => {
    setActionLoading(`${email}-${role}-${action}`);
    setMessage("");
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const method = action === "promote" ? "POST" : "DELETE";
      const body =
        action === "promote"
          ? JSON.stringify({ emailToPromote: email, role })
          : JSON.stringify({ emailToDemote: email, role });

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/users/roles`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body,
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} user`);

      setMessage(`✅ ${data.message || "Success!"}`);
      fetchUsers(); // Refresh the list
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    setPendingDeleteUser(null);
    setActionLoading(`${userToDelete.username}-delete`);
    setMessage("");
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: userToDelete.username,
          email: userToDelete.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");

      setMessage(`✅ ${data.message || "User deleted successfully!"}`);
      fetchUsers(); // Refresh the list
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const executeDeleteAllGuests = async () => {
    setActionLoading("delete-all-guests");
    setPendingBulkAction(null);
    setMessage("");
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/users/guests`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to delete guest users");
      setMessage(`✅ ${data.message || "Success!"}`);
      fetchUsers(); // Refresh the list
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const executeDeleteAllGuestMatches = async () => {
    setActionLoading("delete-all-guest-matches");
    setPendingBulkAction(null);
    setMessage("");
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/matches/guests`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to delete guest matches");
      setMessage(`✅ ${data.message || "Success!"}`);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const executeDeleteAllMatches = async () => {
    if (purgeConfirmText !== "DELETE") return;

    setActionLoading("delete-all-matches");
    setPendingBulkAction(null);
    setPurgeConfirmText("");
    setMessage("");
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/matches`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete matches");
      setMessage(`✅ ${data.message || "All matches deleted successfully!"}`);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="flex bg-slate-900/50 p-1.5 rounded-xl border border-white/5 mb-8 w-fit mx-auto">
        <button
          onClick={() => setActiveTab("USERS")}
          className={`px-6 py-2.5 font-bold text-sm tracking-wide rounded-lg transition-colors ${activeTab === "USERS" ? "text-white bg-indigo-600 shadow-sm" : "text-slate-400 hover:text-indigo-400"}`}
        >
          User Management
        </button>
        <button
          onClick={() => setActiveTab("MATCHES")}
          className={`px-6 py-2.5 font-bold text-sm tracking-wide rounded-lg transition-colors ${activeTab === "MATCHES" ? "text-white bg-indigo-600 shadow-sm" : "text-slate-400 hover:text-indigo-400"}`}
        >
          Database Cleanup
        </button>
      </div>

      {activeTab === "USERS" && (
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] backdrop-blur-3xl shadow-2xl animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-wider italic">
                System Access
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                Manage Roles & Permissions
              </p>
            </div>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
            >
              {loading ? "Loading..." : "🔄 Refresh"}
            </button>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-xl text-sm font-bold ${message.startsWith("✅") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}
            >
              {message}
            </div>
          )}

          <div className="overflow-x-auto bg-slate-950/50 rounded-2xl border border-white/5">
            <table className="w-full text-left text-slate-300 text-sm">
              <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4">User Email</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Roles</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.username}
                    className="border-b border-white/5 last:border-0 hover:bg-slate-800/30"
                  >
                    <td className="px-6 py-4 font-medium text-white">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-md ${user.status === "CONFIRMED" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {user.isAdmin && (
                          <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-md">
                            Admin
                          </span>
                        )}
                        {user.isScorer && (
                          <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-md">
                            Scorer
                          </span>
                        )}
                        {!user.isAdmin && !user.isScorer && (
                          <span className="px-2 py-1 bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-md">
                            Viewer
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {/* SCORER ACTIONS */}
                        {!user.isAdmin &&
                          (!user.isScorer ? (
                            <button
                              onClick={() =>
                                handleRoleAction(
                                  user.email,
                                  "Scorer",
                                  "promote",
                                )
                              }
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 rounded text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              {actionLoading === `${user.email}-Scorer-promote`
                                ? "..."
                                : "+ Scorer"}
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleRoleAction(user.email, "Scorer", "demote")
                              }
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white border border-white/5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              {actionLoading === `${user.email}-Scorer-demote`
                                ? "..."
                                : "- Scorer"}
                            </button>
                          ))}

                        {/* ADMIN ACTIONS */}
                        {!user.isAdmin ? (
                          <button
                            onClick={() =>
                              handleRoleAction(user.email, "Admin", "promote")
                            }
                            disabled={!!actionLoading}
                            className="px-3 py-1.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 rounded text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            {actionLoading === `${user.email}-Admin-promote`
                              ? "..."
                              : "+ Admin"}
                          </button>
                        ) : (
                          user.email !== "venky.2k57@gmail.com" &&
                          user.email !== import.meta.env.VITE_DEFAULT_EMAIL && (
                            <button
                              onClick={() =>
                                handleRoleAction(user.email, "Admin", "demote")
                              }
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white border border-white/5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              {actionLoading === `${user.email}-Admin-demote`
                                ? "..."
                                : "- Admin"}
                            </button>
                          )
                        )}

                        {/* DELETE USER ACTION */}
                        {user.email !== "venky.2k57@gmail.com" &&
                          user.email !== import.meta.env.VITE_DEFAULT_EMAIL && (
                            <button
                              onClick={() => setPendingDeleteUser(user)}
                              disabled={!!actionLoading}
                              title="Delete User from Cognito"
                              className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 rounded text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              {actionLoading === `${user.username}-delete`
                                ? "..."
                                : "🗑️ Delete"}
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-slate-500 italic"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendingDeleteUser &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[300] p-4 backdrop-blur-md">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-sm shadow-2xl shadow-indigo-500/20 overflow-hidden p-6 text-center text-slate-100 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-rose-500/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-400/30">
                <span className="text-3xl">🚨</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2 italic">
                Delete User?
              </h3>
              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                Permanently remove{" "}
                <span className="text-indigo-300 font-bold">
                  {pendingDeleteUser.email}
                </span>{" "}
                from Cognito.
                <br />
                <br />
                This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteUser(null)}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteUser(pendingDeleteUser)}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/25 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {pendingBulkAction &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[300] p-4 backdrop-blur-md">
            <div className="bg-slate-900 border border-rose-500/30 rounded-3xl w-full max-w-sm shadow-2xl shadow-rose-500/20 overflow-hidden p-6 text-center text-slate-100 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-rose-500/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-400/30">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2 italic">
                Confirm Action
              </h3>

              {pendingBulkAction === "delete-all-guests" && (
                <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                  Are you sure you want to permanently delete ALL guest users
                  from Cognito and the database? This cannot be undone.
                </p>
              )}

              {pendingBulkAction === "delete-all-guest-matches" && (
                <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                  Are you sure you want to permanently delete ALL guest matches
                  from the database? This cannot be undone.
                </p>
              )}

              {pendingBulkAction === "delete-all-matches" && (
                <div className="mb-6">
                  <p className="text-red-400 text-sm font-bold mb-4 leading-relaxed">
                    DANGER: This will permanently delete ALL matches in the
                    database.
                  </p>
                  <input
                    type="text"
                    placeholder='Type "DELETE" to confirm'
                    value={purgeConfirmText}
                    onChange={(e) => setPurgeConfirmText(e.target.value)}
                    className="w-full bg-slate-950 border border-red-500/30 rounded-xl px-4 py-3 text-center text-white font-bold tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPendingBulkAction(null);
                    setPurgeConfirmText("");
                  }}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (pendingBulkAction === "delete-all-guests")
                      executeDeleteAllGuests();
                    else if (pendingBulkAction === "delete-all-guest-matches")
                      executeDeleteAllGuestMatches();
                    else if (pendingBulkAction === "delete-all-matches")
                      executeDeleteAllMatches();
                  }}
                  disabled={
                    pendingBulkAction === "delete-all-matches" &&
                    purgeConfirmText !== "DELETE"
                  }
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/25 transition-all"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {activeTab === "MATCHES" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] backdrop-blur-3xl shadow-2xl">
            <h2 className="text-xl font-black text-white uppercase tracking-wider italic mb-4">
              Bulk Actions
            </h2>

            {message && (
              <div
                className={`mb-6 p-4 rounded-xl text-sm font-bold ${message.startsWith("✅") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}
              >
                {message}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setPendingBulkAction("delete-all-guests")}
                disabled={!!actionLoading}
                className="p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group disabled:opacity-50"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  👤
                </span>
                <span className="text-xs font-black text-slate-300 uppercase tracking-widest text-center">
                  {actionLoading === "delete-all-guests"
                    ? "Deleting..."
                    : "Delete All Guest Users"}
                </span>
              </button>

              <button
                onClick={() => setPendingBulkAction("delete-all-guest-matches")}
                disabled={!!actionLoading}
                className="p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group disabled:opacity-50"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  🏏
                </span>
                <span className="text-xs font-black text-slate-300 uppercase tracking-widest text-center">
                  {actionLoading === "delete-all-guest-matches"
                    ? "Deleting..."
                    : "Delete Guest Matches"}
                </span>
              </button>

              <button
                onClick={() => setPendingBulkAction("delete-all-matches")}
                disabled={!!actionLoading}
                className="p-4 bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group disabled:opacity-50"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  🔥
                </span>
                <span className="text-xs font-black text-red-400 uppercase tracking-widest text-center">
                  {actionLoading === "delete-all-matches"
                    ? "Deleting..."
                    : "Delete All Matches"}
                </span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] backdrop-blur-3xl shadow-2xl">
            <h2 className="text-xl font-black text-white uppercase tracking-wider italic mb-4">
              Individual Match Management
            </h2>
            <LiveScoreboard
              key={`hub-${hubKey}`}
              isAdmin={isAdmin}
              showDeleteControls={true}
              initialMatchId={urlMatchId}
              onResumeMatch={undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
