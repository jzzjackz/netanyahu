"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../../lib/supabaseClient";
import Link from "next/link";

interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
  manage_server: boolean;
  manage_roles: boolean;
  manage_channels: boolean;
  kick_members: boolean;
  ban_members: boolean;
  create_invite: boolean;
  manage_messages: boolean;
  send_messages: boolean;
  read_messages: boolean;
  mention_everyone: boolean;
  add_reactions: boolean;
  view_audit_log: boolean;
}

export default function ServerSettings() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.id as string;
  const supabase = createSupabaseBrowserClient();
  
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [serverName, setServerName] = useState("");
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [discoveryDescription, setDiscoveryDescription] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreateRole, setShowCreateRole] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: server, error: serverError } = await supabase
        .from("servers")
        .select("name, owner_id, is_discoverable, discovery_description")
        .eq("id", serverId)
        .single();

      if (serverError || !server) {
        console.error("Error loading server:", serverError);
        // If columns don't exist, just load basic info
        const { data: basicServer } = await supabase
          .from("servers")
          .select("name, owner_id")
          .eq("id", serverId)
          .single();
        
        if (!basicServer) {
          alert("Server not found");
          router.push("/commz");
          return;
        }
        
        setServerName(basicServer.name);
        setIsDiscoverable(false);
        setDiscoveryDescription("");
        
        if (basicServer.owner_id !== user.id) {
          alert("Only server owners can access settings");
          router.push("/commz");
          return;
        }
      } else {
        setServerName(server.name);
        setIsDiscoverable(server.is_discoverable || false);
        setDiscoveryDescription(server.discovery_description || "");

        if (server.owner_id !== user.id) {
          alert("Only server owners can access settings");
          router.push("/commz");
          return;
        }
      }

      setIsOwner(true);
      loadRoles();
      setLoading(false);
    };

    checkAccess();
  }, [serverId, router, supabase]);

  const loadRoles = async () => {
    const { data } = await supabase
      .from("server_roles")
      .select("*")
      .eq("server_id", serverId)
      .order("position", { ascending: false });

    if (data) {
      setRoles(data);
    }
  };

  const handleCreateRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const { error } = await supabase.from("server_roles").insert({
      server_id: serverId,
      name: formData.get("name") as string,
      color: formData.get("color") as string,
      position: roles.length,
    });

    if (error) {
      alert("Failed to create role: " + error.message);
    } else {
      setShowCreateRole(false);
      loadRoles();
    }
  };

  const handleUpdateRole = async (role: Role) => {
    const { error } = await supabase
      .from("server_roles")
      .update(role)
      .eq("id", role.id);

    if (error) {
      alert("Failed to update role: " + error.message);
    } else {
      setEditingRole(null);
      loadRoles();
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (roleName === "@everyone") {
      alert("Cannot delete @everyone role");
      return;
    }

    if (!confirm(`Delete role? This will remove it from all members.`)) return;

    const { error } = await supabase
      .from("server_roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      alert("Failed to delete role: " + error.message);
    } else {
      loadRoles();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#313338] text-white">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isOwner) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[#313338] text-white">
      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{serverName} Settings</h1>
            <p className="text-sm text-gray-400">Manage roles and permissions</p>
          </div>
          <Link
            href="/commz"
            className="rounded-sm bg-[#5865f2] px-4 py-2 text-sm font-medium hover:bg-[#4752c4]"
          >
            Back to Server
          </Link>
        </div>

        {/* Discovery Section */}
        <div className="mb-6 rounded-lg bg-[#2b2d31] p-6">
          <h2 className="mb-4 text-xl font-bold">Server Discovery</h2>
          <p className="mb-4 text-sm text-gray-400">
            Make your server discoverable so others can find and join it
          </p>
          
          <div className="mb-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isDiscoverable}
                onChange={(e) => setIsDiscoverable(e.target.checked)}
                className="h-5 w-5 cursor-pointer"
              />
              <span className="font-medium">Make server discoverable</span>
            </label>
          </div>

          {isDiscoverable && (
            <div className="mb-4">
              <label className="mb-2 block text-sm text-gray-400">
                Server Description (max 100 characters)
              </label>
              <textarea
                value={discoveryDescription}
                onChange={(e) => {
                  if (e.target.value.length <= 100) {
                    setDiscoveryDescription(e.target.value);
                  }
                }}
                placeholder="Describe your server..."
                className="w-full rounded-sm bg-[#313338] px-3 py-2 text-[15px] outline-none resize-none"
                rows={3}
                maxLength={100}
              />
              <p className="mt-1 text-xs text-gray-500">
                {discoveryDescription.length}/100 characters
              </p>
            </div>
          )}

          <button
            onClick={async () => {
              const { error } = await supabase
                .from("servers")
                .update({
                  is_discoverable: isDiscoverable,
                  discovery_description: isDiscoverable ? discoveryDescription : null,
                })
                .eq("id", serverId);

              if (error) {
                alert("Failed to update discovery settings: " + error.message);
              } else {
                alert("Discovery settings saved!");
              }
            }}
            className="rounded-sm bg-[#5865f2] px-4 py-2 text-sm font-medium hover:bg-[#4752c4]"
          >
            Save Discovery Settings
          </button>
        </div>

        {/* Roles Section */}
        <div className="rounded-lg bg-[#2b2d31] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Roles ({roles.length})</h2>
            <button
              onClick={() => setShowCreateRole(true)}
              className="rounded-sm bg-[#5865f2] px-4 py-2 text-sm font-medium hover:bg-[#4752c4]"
            >
              Create Role
            </button>
          </div>

          {showCreateRole && (
            <form onSubmit={handleCreateRole} className="mb-4 rounded bg-[#1e1f22] p-4">
              <h3 className="mb-3 font-medium">Create New Role</h3>
              <div className="mb-3">
                <label className="mb-1 block text-sm text-gray-400">Role Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full rounded-sm bg-[#313338] px-3 py-2 text-[15px] outline-none"
                  placeholder="Moderator"
                />
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-sm text-gray-400">Role Color</label>
                <input
                  type="color"
                  name="color"
                  defaultValue="#99aab5"
                  className="h-10 w-20 rounded-sm bg-[#313338] cursor-pointer"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-sm bg-[#5865f2] px-4 py-2 text-sm hover:bg-[#4752c4]"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateRole(false)}
                  className="rounded-sm bg-[#404249] px-4 py-2 text-sm hover:bg-[#4f5058]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {roles.map((role) => (
              <div key={role.id} className="rounded bg-[#1e1f22] p-4">
                {editingRole?.id === role.id ? (
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <input
                        type="text"
                        value={editingRole.name}
                        onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                        className="flex-1 rounded-sm bg-[#313338] px-3 py-2 text-[15px] outline-none"
                        disabled={role.name === "@everyone"}
                      />
                      <input
                        type="color"
                        value={editingRole.color}
                        onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })}
                        className="h-10 w-20 rounded-sm bg-[#313338] cursor-pointer"
                      />
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-2">
                      {[
                        { key: "manage_server", label: "Manage Server" },
                        { key: "manage_roles", label: "Manage Roles" },
                        { key: "manage_channels", label: "Manage Channels" },
                        { key: "kick_members", label: "Kick Members" },
                        { key: "ban_members", label: "Ban Members" },
                        { key: "create_invite", label: "Create Invite" },
                        { key: "manage_messages", label: "Manage Messages" },
                        { key: "send_messages", label: "Send Messages" },
                        { key: "read_messages", label: "Read Messages" },
                        { key: "mention_everyone", label: "Mention Everyone" },
                        { key: "add_reactions", label: "Add Reactions" },
                        { key: "view_audit_log", label: "View Audit Log" },
                      ].map((perm) => (
                        <label key={perm.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editingRole[perm.key as keyof Role] as boolean}
                            onChange={(e) =>
                              setEditingRole({ ...editingRole, [perm.key]: e.target.checked })
                            }
                            className="h-4 w-4"
                          />
                          {perm.label}
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateRole(editingRole)}
                        className="rounded-sm bg-[#5865f2] px-4 py-2 text-sm hover:bg-[#4752c4]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingRole(null)}
                        className="rounded-sm bg-[#404249] px-4 py-2 text-sm hover:bg-[#4f5058]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="font-medium">{role.name}</span>
                      <span className="text-xs text-gray-400">
                        {Object.entries(role).filter(([k, v]) => 
                          k !== "id" && k !== "server_id" && k !== "name" && k !== "color" && 
                          k !== "position" && k !== "created_at" && v === true
                        ).length} permissions
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingRole(role)}
                        className="rounded-sm bg-[#404249] px-3 py-1 text-sm hover:bg-[#4f5058]"
                      >
                        Edit
                      </button>
                      {role.name !== "@everyone" && (
                        <button
                          onClick={() => handleDeleteRole(role.id, role.name)}
                          className="rounded-sm bg-red-500 px-3 py-1 text-sm hover:bg-red-600"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
