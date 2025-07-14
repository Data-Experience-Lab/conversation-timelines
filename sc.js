import {DataHandler} from '/dataHandler.js'
import {OpenAI} from '/openaiController.js';
import {Visualization} from '/visualization.js';

export class SpeechToTopic {
  constructor(){
    this.openAI = new OpenAI();
    this.data = new DataHandler();
    this.vis = new Visualization(this.data.getData());
  }


  isNewChunk(chunk){
    if (chunk==""){
      return false;
    } else {
      return true;
    }
  }

  async startContinuousRecording() {
    
    // // Call function for initial render of display
    this.vis.updateScreen(this.data, false, true);
    // // Check for and update new speech chunk
    // this.data.update(this.speechController);
    
    if (!navigator.mediaDevices || !window.MediaRecorder) {
        console.error('Browser does not support the necessary APIs.');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const time = this.formatTime(new Date());
            // console.log(time);
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
            // console.log('WAV file created:', file);
            
            // Pass this file to Whisper API or other processing here
            this.openAI.transcribeAudio(file).then(transcription => {
              // console.log('Transcribed Text:', transcription);
              this.handleTranscription([transcription, time]);
            });
          
            audioChunks.length = 0; // Clear the chunks for the next recording
            mediaRecorder.start(); // Start recording again for the next 10 seconds
            // console.log("Starting new recording")
        };

        mediaRecorder.start(); // Start the first recording

        setInterval(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop(); // Stop and automatically restart
            }
        }, 10000); // 10-second interval

    } catch (error) {
        console.error('Error accessing microphone:', error);
    }
  }
  
  async handleTranscription(transcription){
    // console.log(transcription)
    this.data.update(transcription);
    // console.log(this.data.getData());
    // Call function for initial render of display
    this.vis.updateScreen(this.data);
  }
  
  formatTime(date) {
    date.setSeconds(date.getSeconds() - 10);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
  }
  
  // navForward(){
  //   this.vis.navForward();
  // }
  
  // navBack(){
  //   this.vis.navBack();
  // }
  
  scrollUp(){
    this.vis.scrollUp();
  }
  
  scrollDown(){
    this.vis.scrollDown();
  }
  
  escape(){
    this.vis.escape();
  }
  
  jumpToCurr(){
    this.vis.jumpToCurr();
  }

}