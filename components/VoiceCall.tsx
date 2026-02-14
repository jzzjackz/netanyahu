"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

interface VoiceCallProps {
  channelId: string;
  channelName: string;
  onLeave: () => void;
}

interface Participant {
  id: string;
  username: string;
}

export default function VoiceCall({ channelId, channelName, onLeave }: VoiceCallProps) {
  const supabase = createSupabaseBrowserClient();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Initialize audio stream
  useEffect(() => {
    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }, 
          video: false 
        });
        localStreamRef.current = stream;
        setIsConnecting(false);
      } catch (error) {
        console.error("Failed to get audio stream:", error);
        alert("Could not access microphone. Please check permissions.");
        onLeave();
      }
    };

    initAudio();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      remoteAudiosRef.current.forEach(audio => audio.remove());
      remoteAudiosRef.current.clear();
    };
  }, [onLeave]);

  // Initialize signaling
  useEffect(() => {
    if (isConnecting) return;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      const channel = supabase.channel(`voice:${channelId}`);
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "user_joined" }, async ({ payload }) => {
          if (payload.id === user.id) return;
          
          setParticipants((prev) => {
            if (prev.some((p) => p.id === payload.id)) return prev;
            return [...prev, { id: payload.id, username: payload.username }];
          });

          await createPeerConnection(payload.id, true);
        })
        .on("broadcast", { event: "user_left" }, ({ payload }) => {
          setParticipants((prev) => prev.filter((p) => p.id !== payload.id));
          
          const pc = peerConnectionsRef.current.get(payload.id);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(payload.id);
          }
          
          const audio = remoteAudiosRef.current.get(payload.id);
          if (audio) {
            audio.remove();
            remoteAudiosRef.current.delete(payload.id);
          }
        })
        .on("broadcast", { event: "webrtc_offer" }, async ({ payload }) => {
          if (payload.to !== user.id) return;
          await handleOffer(payload.from, payload.offer);
        })
        .on("broadcast", { event: "webrtc_answer" }, async ({ payload }) => {
          if (payload.to !== user.id) return;
          await handleAnswer(payload.from, payload.answer);
        })
        .on("broadcast", { event: "webrtc_ice" }, async ({ payload }) => {
          if (payload.to !== user.id) return;
          await handleIceCandidate(payload.from, payload.candidate);
        })
        .subscribe();

      await channel.send({
        type: "broadcast",
        event: "user_joined",
        payload: { id: user.id, username: profile?.username || "Unknown" },
      });
    };

    init();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [channelId, supabase, isConnecting]);

  const createPeerConnection = async (peerId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const remoteAudio = document.createElement('audio');
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.autoplay = true;
      remoteAudio.muted = isDeafened;
      document.body.appendChild(remoteAudio);
      remoteAudiosRef.current.set(peerId, remoteAudio);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "webrtc_ice",
          payload: {
            from: userId,
            to: peerId,
            candidate: event.candidate,
          },
        });
      }
    };

    peerConnectionsRef.current.set(peerId, pc);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "webrtc_offer",
          payload: {
            from: userId,
            to: peerId,
            offer: offer,
          },
        });
      }
    }
  };

  const handleOffer = async (peerId: string, offer: RTCSessionDescriptionInit) => {
    let pc = peerConnectionsRef.current.get(peerId);
    if (!pc) {
      await createPeerConnection(peerId, false);
      pc = peerConnectionsRef.current.get(peerId);
    }

    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "webrtc_answer",
          payload: {
            from: userId,
            to: peerId,
            answer: answer,
          },
        });
      }
    }
  };

  const handleAnswer = async (peerId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (peerId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    remoteAudiosRef.current.forEach(audio => {
      audio.muted = newDeafened;
    });
  };

  const handleLeave = async () => {
    if (userId && channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "user_left",
        payload: { id: userId },
      });
    }
    onLeave();
  };

  if (isConnecting) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1e1f22] bg-[#232428] p-4">
        <div className="mx-auto flex max-w-4xl items-center justify-center">
          <span className="text-sm text-gray-400">Connecting to voice channel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1e1f22] bg-[#232428] p-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-400">Voice Connected</span>
          </div>
          <span className="text-sm text-gray-400">#{channelName}</span>
          <span className="text-xs text-gray-500">{participants.length + 1} participant{participants.length !== 0 ? "s" : ""}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`rounded-full p-2 transition ${isMuted ? "bg-red-500 hover:bg-red-600" : "bg-[#404249] hover:bg-[#4f5058]"}`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleDeafen}
            className={`rounded-full p-2 transition ${isDeafened ? "bg-red-500 hover:bg-red-600" : "bg-[#404249] hover:bg-[#4f5058]"}`}
            title={isDeafened ? "Undeafen" : "Deafen"}
          >
            {isDeafened ? (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <button
            onClick={handleLeave}
            className="rounded bg-red-500 px-4 py-2 text-sm font-medium hover:bg-red-600"
          >
            Leave Call
          </button>
        </div>
      </div>

      {participants.length > 0 && (
        <div className="mx-auto mt-3 flex max-w-4xl flex-wrap gap-2">
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded bg-[#2b2d31] px-3 py-1.5 text-sm"
            >
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>{p.username}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
