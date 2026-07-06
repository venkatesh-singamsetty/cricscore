import React, { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

interface User {
  username: string;
  email: string;
  status: string;
  isAdmin: boolean;
  isScorer: boolean;
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setMessage("");
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setMessage(`❌ Error fetching users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleAction = async (email: string, role: string, action: "promote" | "demote") => {
    setActionLoading(`${email}-${role}-${action}`);
    setMessage("");
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const method = action === "promote" ? "POST" : "DELETE";
      const body = action === "promote" 
        ? JSON.stringify({ emailToPromote: email, role })
        : JSON.stringify({ emailToDemote: email, role });

      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/roles`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      });

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

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider italic">
            User Management
          </h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
            Manage System Access & Roles
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
        <div className={`mb-6 p-4 rounded-xl text-sm font-bold ${message.startsWith("✅") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
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
              <tr key={user.username} className="border-b border-white/5 last:border-0 hover:bg-slate-800/30">
                <td className="px-6 py-4 font-medium text-white">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-md ${user.status === 'CONFIRMED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {user.isAdmin && (
                      <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-md">Admin</span>
                    )}
                    {user.isScorer && (
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-md">Scorer</span>
                    )}
                    {!user.isAdmin && !user.isScorer && (
                      <span className="px-2 py-1 bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-md">Viewer</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    {/* SCORER ACTIONS */}
                    {!user.isScorer ? (
                      <button
                        onClick={() => handleRoleAction(user.email, "Scorer", "promote")}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 rounded text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `${user.email}-Scorer-promote` ? "..." : "+ Scorer"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRoleAction(user.email, "Scorer", "demote")}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white border border-white/5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `${user.email}-Scorer-demote` ? "..." : "- Scorer"}
                      </button>
                    )}

                    {/* ADMIN ACTIONS */}
                    {!user.isAdmin ? (
                      <button
                        onClick={() => handleRoleAction(user.email, "Admin", "promote")}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 rounded text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `${user.email}-Admin-promote` ? "..." : "+ Admin"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRoleAction(user.email, "Admin", "demote")}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white border border-white/5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `${user.email}-Admin-demote` ? "..." : "- Admin"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPanel;
