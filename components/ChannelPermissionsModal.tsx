"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

interface Role {
  id: string;
  name: string;
  color: string;
}

interface ChannelPermission {
  role_id: string;
  can_view: boolean;
  can_send_messages: boolean;
}

interface ChannelPermissionsModalProps {
  channelId: string;
  channelName: string;
  serverId: string;
  onClose: () => void;
}

export default function ChannelPermissionsModal({
  channelId,
  channelName,
  serverId,
  onClose,
}: ChannelPermissionsModalProps) {
  const supabase = createSupabaseBrowserClient();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Map<string, ChannelPermission>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [channelId, serverId]);

  const loadData = async () => {
    // Load roles
    const { data: rolesData } = await supabase
      .from("server_roles")
      .select("id, name, color")
      .eq("server_id", serverId)
      .order("position", { ascending: false });

    if (rolesData) {
      setRoles(rolesData);
    }

    // Load existing permissions
    const { data: permsData } = await supabase
      .from("channel_permissions")
      .select("*")
      .eq("channel_id", channelId);

    if (permsData) {
      const permsMap = new Map();
      permsData.forEach((p: any) => {
        permsMap.set(p.role_id, {
          role_id: p.role_id,
          can_view: p.can_view,
          can_send_messages: p.can_send_messages,
        });
      });
      setPermissions(permsMap);
    }

    setLoading(false);
  };

  const togglePermission = (roleId: string, field: "can_view" | "can_send_messages") => {
    setPermissions((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(roleId) || {
        role_id: roleId,
        can_view: true,
        can_send_messages: true,
      };
      newMap.set(roleId, {
        ...existing,
        [field]: !existing[field],
      });
      return newMap;
    });
  };

  const handleSave = async () => {
    setSaving(true);

    // Delete all existing permissions for this channel
    await supabase
      .from("channel_permissions")
      .delete()
      .eq("channel_id", channelId);

    // Insert new permissions
    const permsToInsert = Array.from(permissions.values()).map((p) => ({
      channel_id: channelId,
      role_id: p.role_id,
      can_view: p.can_view,
      can_send_messages: p.can_send_messages,
    }));

    if (permsToInsert.length > 0) {
      const { error } = await supabase
        .from("channel_permissions")
        .insert(permsToInsert);

      if (error) {
        alert("Failed to save permissions: " + error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onClose();
  };

  const resetPermissions = async () => {
    if (!confirm("Reset all permissions for this channel? Everyone will have access.")) return;
    
    setSaving(true);
    await supabase
      .from("channel_permissions")
      .delete()
      .eq("channel_id", channelId);
    
    setPermissions(new Map());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-[#313338] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">#{channelName} Permissions</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-400">
          Control which roles can view and send messages in this channel. If no permissions are set, everyone has access.
        </p>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Loading...</div>
        ) : (
          <>
            <div className="mb-4 max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-[#2b2d31]">
                  <tr className="text-left text-sm text-gray-400">
                    <th className="p-2">Role</th>
                    <th className="p-2 text-center">View Channel</th>
                    <th className="p-2 text-center">Send Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => {
                    const perm = permissions.get(role.id);
                    const canView = perm?.can_view ?? true;
                    const canSend = perm?.can_send_messages ?? true;

                    return (
                      <tr key={role.id} className="border-t border-[#1e1f22]">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: role.color }}
                            />
                            <span>{role.name}</span>
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={canView}
                            onChange={() => togglePermission(role.id, "can_view")}
                            className="h-5 w-5 cursor-pointer"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={canSend}
                            onChange={() => togglePermission(role.id, "can_send_messages")}
                            className="h-5 w-5 cursor-pointer"
                            disabled={!canView}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <button
                onClick={resetPermissions}
                disabled={saving}
                className="rounded bg-red-500 px-4 py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              >
                Reset All
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded bg-[#404249] px-4 py-2 text-sm font-medium hover:bg-[#4f5058]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded bg-[#5865f2] px-4 py-2 text-sm font-medium hover:bg-[#4752c4] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
