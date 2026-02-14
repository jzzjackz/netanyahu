// Global audio manager to handle notification sounds
// This helps bypass browser autoplay restrictions

class AudioManager {
  private audio: HTMLAudioElement | null = null;
  private initialized = false;

  initialize() {
    if (this.initialized || typeof window === "undefined") return;
    
    this.audio = new Audio("/sounds/notification.ogg");
    this.audio.volume = 0.5;
    this.audio.load();
    this.initialized = true;
    
    console.log("🔊 Audio manager initialized");
  }

  async playNotification() {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.audio) {
      console.error("❌ Audio element not available");
      return;
    }

    try {
      // Reset audio to beginning
      this.audio.currentTime = 0;
      await this.audio.play();
      console.log("✅ Notification sound played!");
    } catch (error) {
      console.error("❌ Failed to play notification:", error);
      console.log("💡 Tip: Browser may be blocking autoplay. Try clicking anywhere on the page first.");
    }
  }
}

export const audioManager = new AudioManager();

// Initialize on first user interaction
if (typeof window !== "undefined") {
  const initOnInteraction = () => {
    audioManager.initialize();
    // Remove listeners after first interaction
    document.removeEventListener("click", initOnInteraction);
    document.removeEventListener("keydown", initOnInteraction);
  };
  
  document.addEventListener("click", initOnInteraction);
  document.addEventListener("keydown", initOnInteraction);
}
