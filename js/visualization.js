export class Visualization {
  constructor() {
    this.Data;
    this.currIndex = 0; // change to 0 if you want to go forwards
    this.visTopicIndex = 0;
    this.currViewedTopic;
    this.maxIndex = 0;
    this.numTopicsShown = 3;
    this.data = "";
    this.navMode = false; // When true, this updates the timeline in real time with new topics
    this.levels = ["s10", "s30", "m1", "m5", "topics"];
    this.currLevel = 0;
    this.timelineColour = "";
    this.visibleTopics;
    this.topicHidden = false;
    this.topicsColours = [
      "#E382C3",
      "#BC82E3",
      "#828FE3",
      "#82D6E3",
      "#82E3A9",
      "#A2E382",
      "#E3D282",
      "#E38B82",
    ];
    this.speakerColours = [
      "#648FFF",
      "#FFB000",
      "#785EF0",
      "#FE6100",
      "#DC267F",
    ];
    //  font sizes
    this.topicSize = "";
    this.repSize = "";
    this.timeSize = "";
    const now = new Date();
    const formatted = now.toLocaleString(); // Example: "3/30/2025, 10:30:15 AM"
    this.log = `Start Time: ${formatted}\n\n`;
    console.log(this.log);

    // Parse URL parameters to set the number of topics shown
    let params = new URLSearchParams(document.location.search);
    let numTopicsParam = parseInt(params.get("numtopics"), 10);
    this.numTopicsShown =
      !isNaN(numTopicsParam) && numTopicsParam > 0 ? numTopicsParam : 5;
    if (this.numTopicsShown > 16) {
      this.numTopicsShown = 16;
    }
  }

  // Update the screen with new data
  updateScreen(
    dataobj,
    debug = false,
    numTopics = this.numTopicsShown
  ) {
    this.DataObj = dataobj;
    // console.log(this.DataObj.data);
    this.currLevel = 0;
    this.data = this.DataObj.getData(this.levels[this.currLevel]);
    let lastMax = this.maxIndex;
    console.log(this.numTopicsShown);
    this.maxIndex = this.data.length - this.numTopicsShown;

    if (numTopics != this.numTopicsShown) {
      this.numTopicsShown = numTopics;
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown);
    } else {
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown);
    }

    // document.getElementById("jumpToCurrent").style.display = "none";
    document.getElementById("timeDetails").style.display = "none";

    // Update UI elements based on the current state
    if (this.data.length > 0) {
      if (this.visTopicIndex > this.visibleTopics.length - 1) {
        this.visTopicIndex = this.visibleTopics.length - 1;
      }
      this.currViewedTopic = this.visibleTopics[this.visTopicIndex];
      console.log(this.visTopicIndex);
      console.log(this.visibleTopics);
      console.log(this.currViewedTopic);
      this.handleNavigation(
        this.visibleTopics,
        lastMax,
        this.currViewedTopic.time
      );
      // this.updateTimelineColour();
      this.renderTimeline(this.visibleTopics);
    }

    // if (this.topicHidden) {
    //   this.hideTopics();
    // } else {
    //   this.showTopics();
    // }
  }

  // Handle navigation logic
  handleNavigation(visibleTopics, lastMax, time) {
    if (this.currIndex == lastMax && !this.navMode) {
      this.currIndex = this.maxIndex;
    }

    if (this.currIndex == this.maxIndex && this.visTopicIndex == 0) {
      this.navMode = false;
    } else if (this.data.length > 1) {
      // console.log(this.data.at(-1));
      // If the newest topic isn't at the top of currently visible topics
      // Show the jump to current button
      if (this.data.at(-1).id != this.visibleTopics.at(-1).id) {
        let [hours, minutes, seconds] = "";

        [hours, minutes, seconds] = this.getTimeDiff(time);
        document.getElementById("jumpToCurrent").textContent = "↑ Jump to Now";
        document.getElementById("jumpToCurrent").style.display = "block";
        document.getElementById(
          "timeDetails"
        ).textContent = `Viewing at ${hours} hours, ${minutes} minutes, ${seconds} seconds in the past`;
        document.getElementById("timeDetails").style.display = "flex";
        document.getElementById("timeDetails").style.alignItems = "center";
      }
      this.navMode = true;
    }
  }

  // Render the timeline using D3.js
  renderTimeline(visibleTopics) {
    let container = d3
      .select(".main-container")
      .selectAll(".line")
      .data(visibleTopics, (d) => d.id)
      .join(
        (enter) => this.handleEnter(enter),
        (update) => this.handleUpdate(update),
        (exit) => exit.remove()
      );
  }

  // Handle new elements entering the DOM
  handleEnter(enter) {
    let line = enter
      .append("div")
      .attr("class", "line")
      .style("align-items", "center")
      .style("display", "flex")
      .style("position", "relative")
      .style("padding-right", "12vw");

    let topicBlock = line.append("div").attr("class", "entry")
      .style("flex-grow", "1");
    
    let time = line.append("div").attr("class", `timeDiv`)
      .style("position", "absolute")
      .style("right", "2vw")
      .style("top", "0")
      .style("z-index", "10")
      .style("width", "10vw")
      .style("text-align", "right");

    time
      .append("h1")
      .attr("class", "time")
      .text((d) => d.time);

    setTimeout(() => {
      line.attr("class", "line show");
      topicBlock.attr("class", "entry show");
    }, 10);

    topicBlock
      .append("div")
      .attr("class", "speechBubble")
      .each((d, i, nodes) => {
        const bubble = d3.select(nodes[i]);
        this.renderSpeechBubbles(bubble, d);
      });
  }

  // Handle updates to existing elements in the DOM
  handleUpdate(update) {
    update.select(".speechBubble")
      .each((d, i, nodes) => {
        const bubble = d3.select(nodes[i]);
        bubble.selectAll("*").remove();
        this.renderSpeechBubbles(bubble, d);
      });
  }


  // ************ Button click events ************

  jumpToCurr() {
    this.currIndex = this.maxIndex;
    this.visTopicIndex = 0;
    this.visibleTopics = this.data
      .slice(this.currIndex, this.currIndex + this.numTopicsShown);
    // console.log(this.visibleTopics);
    const timeOnly = this.formatTime(new Date());
    this.log += `${timeOnly}.Action.J\n`;
    console.log(this.log);
    this.updateScreen(this.DataObj, false, true);
  }


  scrollUp(log = true) {
    if (this.visTopicIndex == 0 && this.currIndex < this.maxIndex) {
      this.currIndex = (this.currIndex + 1) % this.data.length;
    } else {
      if (this.visTopicIndex > 0) {
        this.visTopicIndex -= 1;
      }
    }
    if (this.currViewedTopic != this.data.at(-1)) {
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown);

      if (log) {
        const timeOnly = this.formatTime(new Date());
        this.log += `${timeOnly}.Action.↑\n`;
        console.log(this.log);
      }
      this.updateScreen(this.DataObj);
    }
  }

  scrollDown(log = true) {
    if (this.visTopicIndex == this.numTopicsShown - 1 && this.currIndex > 0) {
      this.currIndex = (this.currIndex - 1) % this.data.length;
    } else if (this.DataObj.getData(this.levels[this.currLevel]).length > 1) {
      if (
        this.visTopicIndex < this.numTopicsShown - 1 &&
        this.visTopicIndex <
          this.DataObj.getData(this.levels[this.currLevel]).length - 1
      )
        this.visTopicIndex += 1;
    }
    if (this.currViewedTopic != this.data.at(0)) {
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown);
      if (log) {
        const timeOnly = this.formatTime(new Date());
        this.log += `${timeOnly}.Action.↓\n`;
        console.log(this.log);
      }
      this.updateScreen(this.DataObj);
    }
  }

  // timelineView() {
  //   const timeOnly = this.formatTime(new Date());
  //   let topics = document.querySelector("#topics");
  //   if (!(topics.style.display == "none")) {
  //     if (!this.topicHidden) {
  //       this.hideTopics();
  //       const timeOnly = this.formatTime(new Date());
  //       this.log += `${timeOnly}.Vis.LV\n`;
  //       console.log(this.log);
  //       this.topicHidden = true;
  //     } else {
  //       this.hideTopics();
  //       const timeOnly = this.formatTime(new Date());
  //       this.log += `${timeOnly}.Vis.FV\n`;
  //       console.log(this.log);
  //       this.showTopics();
  //       this.topicHidden = false;
  //     }
  //   }
  // }

  // toggleVis() {
  //   let topics = document.querySelector("#topics");
  //   let top = document.querySelector(".info-container");
  //   let main = document.querySelector(".main");
  //   requestAnimationFrame(() => {
  //     if (topics.style.display == "flex") {
  //       top.style.display = "none";
  //       document.querySelector("#zoom").style.visibility = "hidden";
  //       topics.style.display = "none";
  //       main.style.border = "1vw solid #80808042";
  //       const timeOnly = this.formatTime(new Date());
  //       this.log += `${timeOnly}.Vis.NV\n`;
  //       console.log(this.log);
  //     } else {
  //       topics.style.display = "flex";
  //       top.style.display = "block";
  //       document.querySelector("#zoom").style.visibility = "visible";
  //       main.style.border = "";
  //       const timeOnly = this.formatTime(new Date());
  //       this.log += `${timeOnly}.Vis.FV\n`;
  //       console.log(this.log);
  //     }
  //   });
  // }

  // ************ Utility Functions ************

  showTopics() {
    document.querySelectorAll(".entry").forEach((element) => {
      element.style.visibility = "visible";
    });
  }

  hideTopics() {
    document.querySelectorAll(".entry").forEach((element) => {
      element.style.visibility = "hidden";
    });
  }

  truncateStringAtWord(inputString, maxLength) {
    // If the string is already shorter than the max length, return it as is
    if (inputString.length <= maxLength) {
      return inputString;
    }

    // Truncate the string to the max length
    let truncatedString = inputString.substring(0, maxLength);
    // Find the last space in the truncated string
    const lastSpaceIndex = truncatedString.lastIndexOf(" ");
    // If a space is found, cut off at the last space to avoid cutting a word
    if (lastSpaceIndex !== -1) {
      truncatedString = truncatedString.substring(0, lastSpaceIndex);
    }
    // Append '...' to indicate truncation
    return truncatedString + "...";
  }

  // Helper method to format time as HH:MM:SS
  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  timeDifference(totalSeconds) {
    // Convert the difference back to hours, minutes, and seconds
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600; // Get remaining seconds after removing hours
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else if (seconds > 0) {
      return `${seconds}s`;
    }
  }

  // Helper method to calculate the time difference between the current time and a given time
  getTimeDiff(latestTime) {
    console.log(latestTime);
    let currViewedTime = new Date();
    const [chours, cminutes, cseconds] = latestTime.split(":").map(Number);
    latestTime = new Date();
    latestTime.setHours(chours, cminutes, cseconds, 0);

    let diffMs = Math.abs(latestTime - currViewedTime); // Use Math.abs to handle negative differences
    let diffSeconds = Math.floor(diffMs / 1000);
    let hours = Math.floor(diffSeconds / 3600);
    let minutes = Math.floor((diffSeconds % 3600) / 60);
    let seconds = diffSeconds % 60;

    return [hours, minutes, seconds];
  }


  renderSpeechBubbles(bubble, data) {
    if (data.speakerTurns && data.speakerTurns.turns) {
      if (!this.speakerAlignment) {
        this.speakerAlignment = {};
      }
      
      data.speakerTurns.turns.forEach((turn, index) => {
        const speakerId = parseInt(turn.speakerId.charAt(turn.speakerId.length - 1)) - 1;
        
        if (this.speakerAlignment[speakerId] === undefined) {
          const alignRight = Object.keys(this.speakerAlignment).length > 0;
          this.speakerAlignment[speakerId] = alignRight;
        }
        
        const alignRight = this.speakerAlignment[speakerId];
        
        const bubbleContainer = bubble.append("div")
          .style("display", "flex")
          .style("justify-content", alignRight ? "flex-end" : "flex-start")
          .style("margin", "8px 0");
        
        const bubbleDiv = bubbleContainer.append("div")
          .attr("class", "speechBubbleItem")
          .style("background-color", this.speakerColours[speakerId % 5])
          .style("padding", "12px 18px")
          .style("border-radius", "20px")
          .style("position", "relative")
          .style("max-width", "70%")
          .style("word-wrap", "break-word")
          .style("color", "white")
          .style("font-weight", "500")
          .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
          .style("display", "inline-block");

        if (alignRight) {
          bubbleDiv.style("border-bottom-right-radius", "5px");
        } else {
          bubbleDiv.style("border-bottom-left-radius", "5px");
        }

        const processedText = this.processFillerWords(turn.speakerSeg);
        bubbleDiv.html(processedText);
      });
    }
  }

  processFillerWords(text) {
    const fillerWords = ["umm", "uhh", "uh", "um", "like", "you know", "well", "so", "basically", "actually", "literally"];
    let processedText = text;

    fillerWords.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      processedText = processedText.replace(regex, `<i>${filler}</i>`);
    });

    return processedText;
  }

  setSpeakerTurnColours() {
    
  }
}
