// Global audio manager to handle notification sounds
// This helps bypass browser autoplay restrictions

class AudioManager {
  private notificationAudio: HTMLAudioElement | null = null;
  private ringtoneAudio: HTMLAudioElement | null = null;
  private initialized = false;

  initialize() {
    if (this.initialized || typeof window === "undefined") return;
    
    this.notificationAudio = new Audio("/sounds/notification.ogg");
    this.notificationAudio.volume = 0.5;
    this.notificationAudio.load();
    
    this.ringtoneAudio = new Audio("/sounds/ringtone.ogg");
    this.ringtoneAudio.volume = 0.5;
    this.ringtoneAudio.loop = true;
    this.ringtoneAudio.load();
    
    this.initialized = true;
    
    console.log("🔊 Audio manager initialized");
  }

  async playNotification() {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.notificationAudio) {
      console.error("❌ Audio element not available");
      return;
    }

    try {
      // Reset audio to beginning
      this.notificationAudio.currentTime = 0;
      await this.notificationAudio.play();
      console.log("✅ Notification sound played!");
    } catch (error) {
      console.error("❌ Failed to play notification:", error);
      console.log("💡 Tip: Browser may be blocking autoplay. Try clicking anywhere on the page first.");
    }
  }

  async playRingtone() {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.ringtoneAudio) {
      console.error("❌ Ringtone audio element not available");
      return;
    }

    try {
      this.ringtoneAudio.currentTime = 0;
      await this.ringtoneAudio.play();
      console.log("✅ Ringtone playing!");
    } catch (error) {
      console.error("❌ Failed to play ringtone:", error);
    }
  }

  stopRingtone() {
    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
      console.log("🔇 Ringtone stopped");
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
