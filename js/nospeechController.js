// Hosted
import { DataHandler } from "/conversation-timelines/js/dataHandler.js";
import { Visualization } from "/conversation-timelines/js/visualization.js";

const APIURL = "https://convtimelines-backend.onrender.com"

export class SpeechToTopic {
  constructor() {
    this.data = new DataHandler();
    this.vis = new Visualization(this.data.getData());
    this.time = "";
    this.transcript = "";
    this.speakerTurns = { total: 0, speakers: [], turns: [] };
  }
  

  async startContinuousRecording() {
    let apiKey = "9950a8d69c85b809b5eef84d2d5fa43f4589bb7e";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    // 2️⃣ Connect to Deepgram live WebSocket
    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?model=nova-3&diarize=true`,
      ["token", apiKey]
    );

    ws.onopen = () => console.log("Connected to Deepgram live");
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.channel?.alternatives?.length) {
        const transcript = data.channel.alternatives[0].transcript;
        const speaker = data.speaker ?? "unknown";
        console.log(`Speaker ${speaker}: ${transcript}`);
      }
    };

    ws.onclose = () => console.log("Deepgram WebSocket closed");
    ws.onerror = (err) => console.error("WebSocket error", err);

    // 3️⃣ Stream mic audio as PCM16 to Deepgram
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const buffer = new ArrayBuffer(inputData.length * 2);
      const view = new DataView(buffer);

      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }

      if (ws.readyState === WebSocket.OPEN) ws.send(buffer);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }

  async handleTranscription(transcription, time, speakerTurns) {
    console.log("analyzing speech");
    console.log(speakerTurns);
    await this.data.update(transcription, time, speakerTurns, this.data);
    // Call function for initial render of display
    console.log("updated screen")
    this.vis.updateScreen(this.data);
  }


  // async handleTranscription(transcription){
  //   // console.log(transcription)
  //   this.data.update(transcription);
  //   // console.log(this.data.getData());
  //   // Call function for initial render of display
  //   this.vis.updateScreen(this.data);
  // }

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

  jumpToCurr() {
    this.vis.jumpToCurr();
  }

  download() {
    this.vis.download();
  }
  
  toggleVis() {
    this.vis.toggleVis()
  }

  //SDK SETUP*********************************


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
