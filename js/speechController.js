// Hosted
// import { DataHandler } from "/conversation-timelines/js/dataHandler.js";
// import { Visualization } from "/conversation-timelines/js/visualization.js";
//Local
 import { DataHandler } from "./dataHandler.js";
 import { Visualization } from "./visualization.js";

const APIURL = "https://convtimelines-backend.onrender.com"

export class SpeechToTopic {
  constructor() {
    this.data = new DataHandler();
    this.vis = new Visualization(this.data.getData());
    // status fields and start button in UI
    this.SpeechSDK;
    this.conversationTranscriber;
    this.time = "";
    this.transcript = "";
    this.speakerTurns = { total: 0, speakers: [], turns: [] };
    // subscription key and region for speech services.
    this.sdkSetup();
    this.silenceLength = 0;
    this.recordingStatus = true;
  }

  setRecordingStatus(status) {
    this.recordingStatus = status;
    console.log(this.recordingStatus)
  }

  transcriptionStart() {
    if (this.recordingStatus) {
      console.log("Starting transcription...");
      this.conversationTranscriber.startTranscribingAsync(
        () => {
          console.log("Transcription started.");

          // Schedule 10-second cycle for processing transcripts
          this.shortTimeoutId = setTimeout(() => {
            console.log("Stopping transcription after 10 seconds...");
            this.transcriptionStop();
          }, 10000); // 10 seconds

          // Schedule full restart every 9 minutes
          if (!this.longTimeoutId) {
            this.longTimeoutId = setTimeout(() => {
              console.log(
                "Restarting Azure SDK session before 10-minute timeout..."
              );
              this.transcriptionStop();
              this.restartAzureSession();
             }, 9 * 60 * 1000); // 9 minutes (540,000 ms)
          }
        },
        (err) => {
          console.trace("Error starting transcription: " + err);
        }
      );
    } else {
      // Schedule 10-second cycle for processing transcripts
      console.log("Recording turned off");
    }
  }

  transcriptionStop() {
    if (this.recordingStatus) {
      console.log("Stopping transcription...");

      // Clear only the short 10-second timeout
      clearTimeout(this.shortTimeoutId);

      this.conversationTranscriber.stopTranscribingAsync(
        () => {
          console.log("Transcription stopped.");
          const time = this.formatTime(new Date());

          if (this.transcript.length > 1) {
            this.handleTranscription(this.transcript, time, this.speakerTurns, this.silenceLength);
            this.silenceLength = 0;
          } else {
            this.silenceLength += 1;
          }

          this.transcriptionStart();

          // Reset transcript and speaker turns
          this.transcript = "";
          this.speakerTurns = { total: 0, speakers: [], turns: [] };
        },
        (err) => {
          console.trace("Error stopping transcription: " + err);
        }
      );
    }
  }

  async restartAzureSession() {
    console.log("Restarting Azure Speech SDK session...");

    // Clear any pending timeouts
    clearTimeout(this.shortTimeoutId);
    clearTimeout(this.longTimeoutId);
    this.longTimeoutId = null;

    try {
      // --- Gracefully stop any existing transcriber ---
      if (this.conversationTranscriber) {
        console.log("Stopping old transcriber before restart...");
        await new Promise((resolve) => {
          this.conversationTranscriber.stopTranscribingAsync(
            () => {
              console.log("Old transcriber stopped cleanly.");
              resolve();
            },
            (err) => {
              console.error("Error stopping old transcriber:", err);
              resolve(); // continue anyway
            }
          );
        });

        // Explicitly clear reference to help GC
        this.conversationTranscriber = null;
      }

      // --- Reinitialize SDK and start fresh ---
      await this.sdkSetup();
      console.log("Azure Speech SDK session restarted successfully.");
    } catch (error) {
      console.error("Error restarting Azure session:", error);
    } finally {
      // Ensure restart timer resets properly
      this.longTimeoutId = null;
    }
  }


  async startContinuousRecording() {
    // Call function for initial render of display
    this.vis.updateScreen(this.data, false);
    try {
      this.transcriptionStart();
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }

  async handleTranscription(transcription, time, speakerTurns, silenceLength) {
    console.log("analyzing speech");
    console.log(speakerTurns);
    console.log(silenceLength)
    await this.data.update(transcription, time, speakerTurns, this.data, silenceLength);
    // Call function for initial render of display
    console.log("updated screen")
    this.vis.updateScreen(this.data);
  }

  formatTime(date) {
    date.setSeconds(date.getSeconds() - 10);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  }

  scrollUp() {
    this.vis.scrollUp();
  }

  scrollDown() {
    this.vis.scrollDown();
  }

  setSliderZoom(value) {
    this.vis.setSliderZoom(value);
  }

  zoomIn() {
    this.vis.zoomIn();
  }

  zoomOut() {
    this.vis.zoomOut();
  }

  escape() {
    this.vis.escape();
  }

  jumpToCurr() {
    this.vis.jumpToCurr();
  }

  
  timelineView() {
    this.vis.timelineView();
  }
  
  download() {
    this.vis.download();
  }
  
  toggleVis() {
    this.vis.toggleVis()
  }

  preserveSpeakerColors() {
    this.vis.preserveSpeakerColors(true);
  }

  //SDK SETUP*********************************

  async sdkSetup() {
    try {
      // --- Get token + region from backend ---
      const response = await fetch(`${APIURL}/api/speech-token`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to fetch speech token");

      const { token, region } = await response.json();
      if (!token || !region) throw new Error("Missing token or region");

      // --- Create speech + audio configs ---
      const speechConfig = window.SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = "en-US";
      const audioConfig = window.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      this.SpeechSDK = window.SpeechSDK;

      // --- Safety cleanup: ensure no old transcriber persists ---
      if (this.conversationTranscriber) {
        console.warn("Previous transcriber still active — stopping...");
        await new Promise((resolve) =>
          this.conversationTranscriber.stopTranscribingAsync(() => resolve(), () => resolve())
        );
        this.conversationTranscriber = null;
      }

      // --- Create new transcriber instance ---
      this.conversationTranscriber = new this.SpeechSDK.ConversationTranscriber(
        speechConfig,
        audioConfig
      );

      // --- Event Handlers (use arrow functions for proper 'this') ---
      this.conversationTranscriber.sessionStarted = (s, e) => {
        this.time = Date.now();
        this.currentSessionId = e.sessionId;
        console.log("SessionStarted:", e.sessionId);
      };

      this.conversationTranscriber.sessionStopped = (s, e) => {
        console.log("SessionStopped:", e.sessionId);
        if (this.conversationTranscriber) {
          this.conversationTranscriber.stopTranscribingAsync(
            () => console.log("Stopped after sessionStopped event."),
            (err) => console.error("Error stopping after sessionStopped:", err)
          );
        }
      };

      this.conversationTranscriber.canceled = (s, e) => {
        console.warn("Canceled event:", e.errorDetails);
        if (this.conversationTranscriber) {
          this.conversationTranscriber.stopTranscribingAsync(
            () => console.log("Stopped after cancel."),
            (err) => console.error("Error stopping after cancel:", err)
          );
        }
      };

      this.conversationTranscriber.transcribed = (s, e) => {
        if (e.result.text && e.result.speakerId !== "Unknown") {
          console.log(`[${this.currentSessionId}] ${e.result.speakerId}: ${e.result.text}`);
          this.addSegment(e.result);
          this.transcript += e.result.text + " ";
        }
      };
    } catch (err) {
      console.error("Speech SDK setup failed:", err);
    }
  }


  addSegment(result) {
    const guestID = result.speakerId;
    // Calculate sentence length by num words
    const wordsArray = result.text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const newLength = wordsArray.length;

    let guestFound = false;

    console.log(this.speakerTurns.speakers);
    for (let i = 0; i < this.speakerTurns.speakers.length; i++) {
      let speaker = this.speakerTurns.speakers[i];
      if (speaker.speakerId == guestID) {
        // Add to the existing length
        speaker.length += newLength;
        guestFound = true;
        break;
      }
    }

    // If Guest doesn't exist, add it to the array
    if (!guestFound) {
      this.speakerTurns.speakers.push({
        speakerId: guestID,
        length: newLength,
      });
    }

    this.speakerTurns.total += newLength;
    let json = {
      speakerId: guestID,
      speakerSeg: result.text,
      length: newLength,
    };
    this.speakerTurns.turns.push(json);

    console.log(this.speakerTurns);
  }

  //*******************************************
}
