"use client";

import ServerSidebar from "./ServerSidebar";
import ChannelSidebar from "./ChannelSidebar";
import ChatArea from "./ChatArea";
import MemberList from "./MemberList";
import FriendsPanel from "./FriendsPanel";
import { useAppStore } from "../lib/store";

export default function AppShell() {
  const { currentServerId } = useAppStore();

  return (
    <div className="flex h-full w-full">
      <ServerSidebar />
      <ChannelSidebar />
      <ChatArea />
      {currentServerId ? <MemberList /> : <FriendsPanel />}
    </div>
  );
}
