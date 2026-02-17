"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

interface PrivateCallProps {
  conversationId: string;
  otherUsername: string;
  onLeave: () => void;
}

export default function PrivateCall({ conversationId, otherUsername, onLeave }: PrivateCallProps) {
  const supabase = createSupabaseBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [callStatus, setCallStatus] = useState<"connecting" | "connected" | "failed">("connecting");
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, [supabase.auth]);

  useEffect(() => {
    if (!userId) return;

    const initCall = async () => {
      try {
        // Get audio stream (and video if enabled)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: isVideoEnabled,
        });

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });

        peerConnectionRef.current = pc;

        // Add local stream tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Handle remote stream
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setCallStatus("connected");
          }
        };

        // Queue for ICE candidates received before remote description
        const iceCandidateQueue: RTCIceCandidate[] = [];

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && channelRef.current) {
            channelRef.current.send({
              type: "broadcast",
              event: "ice_candidate",
              payload: {
                candidate: event.candidate,
                from: userId,
              },
            });
          }
        };

        // Set up Supabase realtime channel for signaling
        const channel = supabase.channel(`call:${conversationId}`);
        channelRef.current = channel;

        channel
          .on("broadcast", { event: "offer" }, async ({ payload }) => {
            if (payload.to === userId) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                
                // Process queued ICE candidates
                while (iceCandidateQueue.length > 0) {
                  const candidate = iceCandidateQueue.shift();
                  if (candidate) {
                    await pc.addIceCandidate(candidate);
                  }
                }
                
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                channel.send({
                  type: "broadcast",
                  event: "answer",
                  payload: {
                    answer,
                    from: userId,
                    to: payload.from,
                  },
                });
              } catch (error) {
                console.error("Error handling offer:", error);
              }
            }
          })
          .on("broadcast", { event: "answer" }, async ({ payload }) => {
            if (payload.to === userId) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                
                // Process queued ICE candidates
                while (iceCandidateQueue.length > 0) {
                  const candidate = iceCandidateQueue.shift();
                  if (candidate) {
                    await pc.addIceCandidate(candidate);
                  }
                }
              } catch (error) {
                console.error("Error handling answer:", error);
              }
            }
          })
          .on("broadcast", { event: "ice_candidate" }, async ({ payload }) => {
            if (payload.from !== userId && payload.candidate) {
              try {
                const candidate = new RTCIceCandidate(payload.candidate);
                
                // If remote description is set, add candidate immediately
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(candidate);
                } else {
                  // Otherwise, queue it
                  iceCandidateQueue.push(candidate);
                }
              } catch (error) {
                console.error("Error adding ICE candidate:", error);
              }
            }
          })
          .on("broadcast", { event: "video_toggle" }, ({ payload }) => {
            if (payload.from !== userId) {
              setRemoteVideoEnabled(payload.enabled);
            }
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              // Create and send offer
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              
              // Get other user ID from conversation
              const { data: convo } = await supabase
                .from("direct_conversations")
                .select("user_a_id, user_b_id")
                .eq("id", conversationId)
                .single();
              
              const otherUserId = convo?.user_a_id === userId ? convo?.user_b_id : convo?.user_a_id;
              
              channel.send({
                type: "broadcast",
                event: "offer",
                payload: {
                  offer,
                  from: userId,
                  to: otherUserId,
                },
              });
            }
          });
      } catch (error) {
        console.error("Failed to initialize call:", error);
        setCallStatus("failed");
      }
    };

    initCall();

    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, conversationId, supabase, isVideoEnabled]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = async () => {
    try {
      if (!isVideoEnabled) {
        // Enable video
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        
        if (localStreamRef.current && peerConnectionRef.current) {
          localStreamRef.current.addTrack(videoTrack);
          peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current);
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        }
        
        setIsVideoEnabled(true);
        
        // Notify other user
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "video_toggle",
            payload: { enabled: true, from: userId },
          });
        }
      } else {
        // Disable video
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.stop();
            localStreamRef.current.removeTrack(videoTrack);
          }
        }
        
        setIsVideoEnabled(false);
        
        // Notify other user
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "video_toggle",
            payload: { enabled: false, from: userId },
          });
        }
      }
    } catch (error) {
      console.error("Failed to toggle video:", error);
    }
  };

  const handleLeave = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    onLeave();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1e1f22]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2b2d31] px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{otherUsername}</h2>
          <p className="text-sm text-gray-400">
            {callStatus === "connecting" && "Connecting..."}
            {callStatus === "connected" && "Connected"}
            {callStatus === "failed" && "Connection failed"}
          </p>
        </div>
        <button
          onClick={handleLeave}
          className="rounded-full bg-red-500 p-2 transition hover:bg-red-600"
          title="Leave call"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Video Area */}
      <div className="relative flex-1">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`h-full w-full object-cover ${!remoteVideoEnabled && "hidden"}`}
        />
        
        {/* Remote Avatar (when video is off) */}
        {!remoteVideoEnabled && (
          <div className="flex h-full w-full items-center justify-center bg-[#2b2d31]">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[#5865f2] text-5xl font-bold">
                {otherUsername[0]?.toUpperCase()}
              </div>
              <p className="text-xl text-white">{otherUsername}</p>
            </div>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute bottom-4 right-4 overflow-hidden rounded-lg border-2 border-[#404249] bg-[#2b2d31]">
          {isVideoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-40 w-60 object-cover"
            />
          ) : (
            <div className="flex h-40 w-60 items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#5865f2] text-2xl font-bold">
                You
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 border-t border-[#2b2d31] px-6 py-6">
        <button
          onClick={toggleMute}
          className={`rounded-full p-4 transition ${
            isMuted ? "bg-red-500 hover:bg-red-600" : "bg-[#404249] hover:bg-[#4f5058]"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <button
          onClick={toggleVideo}
          className={`rounded-full p-4 transition ${
            isVideoEnabled ? "bg-[#404249] hover:bg-[#4f5058]" : "bg-red-500 hover:bg-red-600"
          }`}
          title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoEnabled ? (
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
            </svg>
          )}
        </button>

        <button
          onClick={handleLeave}
          className="rounded-full bg-red-500 p-4 transition hover:bg-red-600"
          title="Leave call"
        >
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

