import { DataHandler } from "/conversation-timelines/js/dataHandler.js";
import { Visualization } from "/conversation-timelines/js/visualization.js";

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
    this.subscriptionKey = "5zM4pkL95Eh0TgnAyNxSwZc4aAeKM9zcdJ1OtmhYy99xIkKvwmeSJQQJ99BDAC1i4TkXJ3w3AAAYACOGEFls";
    this.serviceRegion = "centralus";
    this.sdkSetup();
  }

  transcriptionStart() {
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
            this.restartAzureSession();
          }, 9 * 60 * 1000); // 9 minutes (540,000 ms)
        }
      },
      (err) => {
        console.trace("Error starting transcription: " + err);
      }
    );
  }

  transcriptionStop() {
    console.log("Stopping transcription...");

    // Clear only the short 10-second timeout
    clearTimeout(this.shortTimeoutId);

    this.conversationTranscriber.stopTranscribingAsync(
      () => {
        console.log("Transcription stopped.");
        const time = this.formatTime(new Date());

        if (this.transcript.length > 1) {
          this.handleTranscription([this.transcript, time], this.speakerTurns);
        }

        // Reset transcript and speaker turns
        this.transcript = "";
        this.speakerTurns = { total: 0, speakers: [], turns: [] };

        // Immediately restart transcription for the next 10-second cycle
        this.transcriptionStart();
      },
      (err) => {
        console.trace("Error stopping transcription: " + err);
      }
    );
  }

  restartAzureSession() {
    console.log("Restarting Azure Speech SDK session...");

    // Clear both timeouts to prevent multiple scheduled restarts
    clearTimeout(this.shortTimeoutId);
    clearTimeout(this.longTimeoutId);

    // Immediately reset longTimeoutId to ensure proper restart
    this.longTimeoutId = null;

    try {
      // Stop any active transcriber session
      if (this.conversationTranscriber) {
        this.conversationTranscriber.stopTranscribingAsync();
      }
      
      this.sdkSetup();

      console.log("Azure Speech SDK session restarted.");
    } catch (error) {
      console.error("Error restarting Azure session:", error);
    } finally {
      this.longTimeoutId = null; // Ensure it's reset even if an error occurs
    }

    // Start new transcription cycle
    this.transcriptionStart();
  }

  async startContinuousRecording() {
    // Call function for initial render of display
    this.vis.updateScreen(this.data, false, true);
    try {
      this.transcriptionStop();
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }

  async handleTranscription(transcription, speakerTurns) {
    console.log("analyzing speech");
    console.log(speakerTurns);
    await this.data.update(transcription, speakerTurns, this.data);
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

  // scrollUp() {
  //   this.vis.scrollUp();
  // }

  // scrollDown() {
  //   this.vis.scrollDown();
  // }

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

  //SDK SETUP*********************************
  sdkSetup() {
    if (!!window.SpeechSDK) {
      this.SpeechSDK = window.SpeechSDK;
    }

    const speechConfig = this.SpeechSDK.SpeechConfig.fromSubscription(
      this.subscriptionKey,
      this.serviceRegion
    );

    speechConfig.speechRecognitionLanguage = "en-US";
    const audioConfig = this.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

    this.conversationTranscriber = new this.SpeechSDK.ConversationTranscriber(
      speechConfig,
      audioConfig
    );

    this.conversationTranscriber.sessionStarted = function (s, e) {
      this.time = Date.now();
      console.log("SessionStarted event");
      console.log("SessionId:" + e.sessionId);
    };
    this.conversationTranscriber.sessionStopped = function (s, e) {
      console.log("SessionStopped event");
      console.log("SessionId:" + e.sessionId);
      this.conversationTranscriber.stopTranscribingAsync();
    };
    this.conversationTranscriber.canceled = function (s, e) {
      console.log("Canceled event");
      console.log(e.errorDetails);
      this.conversationTranscriber.stopTranscribingAsync();
    };
    this.conversationTranscriber.transcribed = (s, e) => {
      if (e.result.text != undefined && e.result.speakerId != "Unknown") {
        console.log(e.result);
        console.log(
          "TRANSCRIBED: Text=" +
            e.result.text +
            " Speaker ID=" +
            e.result.speakerId
        );
        this.addSegment(e.result);
        this.transcript += e.result.text + " ";
        console.log("transcript = " + this.transcript);
      }
    };
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
