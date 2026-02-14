"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

interface PrivateCallProps {
  conversationId: string;
  otherUsername: string;
  onLeave: () => void;
}

export default function PrivateCall(props: PrivateCallProps) {
  return <div>Private Call Component</div>;
}
