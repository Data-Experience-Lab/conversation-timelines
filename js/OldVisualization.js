export class Visualization {
  constructor() {
    this.currIndex = 0; // change to 0 if you want to go forwards
    this.visTopicIndex = 0;
    this.currViewedTopic;
    this.maxIndex = 0;
    this.numTopicsShown = 3;
    this.data = "";
    this.navMode = false; // When true, this updates the timeline in real time with new topics
    this.levels = ["s10", "s30", "m1", "m5", "topics"];
    this.currLevel = 0;
    this.zoomValue = 0.0; // Start at speech bubble level
    this.zoomStep = 0.02; // Step size for left/right arrow keys
    this.selfID = "Guest-1";
    
    // the mapping we talked about in our convo
    this.zoomConfig = {
      "speechBubbles": {
        "selector": ".speechBubbleItem",
        "properties": {
          "transform": [[0.0, "scale(1)"], [0.15, "scale(0.4)"], [0.3, "scale(0.2)"]],
          "color": [[0.0, "white"], [0.15, "rgba(255,255,255,0.6)"], [0.25, "rgba(255,255,255,0.2)"], [0.3, "rgba(255,255,255,0.0)"]],
          "font-size": [[0.0, "16px"], [0.15, "8px"], [0.3, "4px"]],
          "width": [[0.0, "auto"], [0.35, "auto"], [0.4, "80px"], [0.6, "60px"]],
          "height": [[0.0, "auto"], [0.35, "auto"], [0.4, "30px"], [0.6, "20px"]],
          "max-width": [[0.0, "70%"], [0.35, "70%"], [0.4, "80px"], [0.6, "60px"]],
          "overflow": [[0.0, "visible"], [0.35, "visible"], [0.4, "hidden"], [0.6, "hidden"]]
        }
      },
      "speechBubbleContainers": {
        "selector": ".speechBubble",
        "properties": {
          "width": [[0.0, "100%"], [0.08, "80%"], [0.15, "25%"], [0.3, "15%"]],
          "margin-left": [[0.0, "0"], [0.08, "20%"], [0.15, "75%"], [0.3, "85%"]],
          "margin-right": [[0.0, "0"], [0.15, "0"], [0.3, "0%"]]
        }
      },
      "speechBubbleItems": {
        "selector": ".speechBubble > div",
        "properties": {
          "justify-content": [[0.08, "flex-end"], [0.15, "flex-end"], [1.0, "flex-end"]]
        }
      },
      "topics": {
        "selector": ".topicSentences",
        "properties": {
          "opacity": [[0.0, 0.0], [0.05, 0.05], [0.08, 0.1], [0.12, 0.2], [0.16, 0.3], [0.2, 0.4], [0.25, 0.5], [0.3, 0.6], [0.35, 0.7], [0.4, 0.8], [0.45, 0.9], [0.5, 1.0], [1.0, 1.0]],
          "transform": [[0.0, "translateX(-800px)"], [0.05, "translateX(-750px)"], [0.08, "translateX(-700px)"], [0.12, "translateX(-650px)"], [0.16, "translateX(-600px)"], [0.2, "translateX(-550px)"], [0.25, "translateX(-500px)"], [0.3, "translateX(-400px)"], [0.35, "translateX(-300px)"], [0.4, "translateX(-200px)"], [0.45, "translateX(-100px)"], [0.5, "translateX(-25px)"], [0.55, "translateX(0px)"]],
          "font-size": [[0.0, "20px"], [0.4, "24px"], [0.7, "28px"], [1.0, "32px"]]
        }
      },
      "repSentences": {
        "selector": ".repSentences",
        "properties": {
          "opacity": [[0.0, 0.0], [0.08, 0.05], [0.12, 0.1], [0.16, 0.15], [0.2, 0.2], [0.25, 0.3], [0.3, 0.4], [0.35, 0.5], [0.4, 0.6], [0.45, 0.7], [0.5, 0.8], [0.55, 0.9], [0.6, 1.0], [1.0, 1.0]],
          "transform": [[0.0, "translateX(-800px)"], [0.08, "translateX(-750px)"], [0.12, "translateX(-700px)"], [0.16, "translateX(-650px)"], [0.2, "translateX(-600px)"], [0.25, "translateX(-550px)"], [0.3, "translateX(-500px)"], [0.35, "translateX(-400px)"], [0.4, "translateX(-300px)"], [0.45, "translateX(-200px)"], [0.5, "translateX(-100px)"], [0.55, "translateX(-25px)"], [0.6, "translateX(0px)"]]
        }
      }
    };
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
      !isNaN(numTopicsParam) && numTopicsParam > 0 ? numTopicsParam : 4;
    if (this.numTopicsShown > 16) {
      this.numTopicsShown = 16;
    }
  }

  // Update the screen with new data
  updateScreen(
    dataobj,
    debug = false,
    resize = false,
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

    document.getElementById("jumpToCurrent").style.display = "none";
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

      this.renderTimeline(this.visibleTopics);
      if (this.visibleTopics[this.visTopicIndex] != null) {
        this.hideRepSentences(this.visibleTopics[this.visTopicIndex].id);
      }
    }

    if (this.topicHidden) {
      this.hideTopics();
    } else {
      this.showTopics();
    }

    if (this.data.length > 0) this.resizeFont(resize);
    if (resize) {
      this.scrollDown(false);
      this.scrollUp(false);
    }

    this.updateZoomStyles();

  }


  // Handle navigation logic
  handleNavigation(visibleTopics, lastMax, time) {
    if (this.currIndex == lastMax && !this.navMode) {
      this.currIndex = this.maxIndex;
    }

    if (this.currIndex == this.maxIndex && this.visTopicIndex == 0) {
      this.navMode = false;
    } else if (this.data.length > 1) {
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

    // Create topic elements
    topicBlock
      .append("h1")
      .attr("class", "topicSentences")
      .text((d) => d.topic || `Topic ${d.id}`);
    
    topicBlock
      .append("p")
      .attr("class", "repSentences")
      .text((d) => d.description || d.repSentence || "Representative sentence...");

    // Create speech bubbles
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
    // Update topic text
    update.select(".topicSentences")
      .text((d) => d.topic || `Topic ${d.id}`);
    
    update.select(".repSentences")
      .text((d) => d.description || d.repSentence || "Representative sentence...");

    // Update speech bubbles
    update.select(".speechBubble")
      .each((d, i, nodes) => {
        const bubble = d3.select(nodes[i]);
        bubble.selectAll("*").remove();
        this.renderSpeechBubbles(bubble, d);
      });
  }

  // Hide representative sentences for all topics except the selected one
  hideRepSentences(selectedTopic) {
    this.addDurations();

    const entries = document.querySelectorAll(".line");
    entries.forEach((entry, i) => {
      const repSentence = entry.querySelector(".repSentences");
      const topicSentence = entry.querySelector(".topicSentences");
      const time = entry.querySelector(".time");
      const totalTime = entry.querySelector(".total-time");
      // const bar = entry.querySelector(".turnBlock");

      if (this.currLevel == 4) {
        repSentence.style.color = this.topicsColours[i % 8];
        topicSentence.style.color = this.topicsColours[i % 8];
      } else {
        topicSentence.style.color = "#bfbfbf";
      }

      if (selectedTopic === topicSentence.__data__.id) {
        repSentence.style.display = "block";
        repSentence.setAttribute("id", "selected-entry");
        topicSentence.setAttribute("id", "selected-entry");
        entry.setAttribute("id", "selected-entry");
        time.setAttribute("id", "selected-entry");
        time.style.color = "white";
        if (totalTime != null) {
          totalTime.setAttribute("id", "selected-entry");
          totalTime.style.color = "white";
        }
        // bar.style.border = "0.3vw solid white";
        repSentence.style.color = "white";
        topicSentence.style.color = "white";
      } else {
        repSentence.style.display = "none";
        repSentence.removeAttribute("id");
        topicSentence.removeAttribute("id");
        if (totalTime != null) {
          totalTime.removeAttribute("id", "selected-entry");
          totalTime.style.color = "#bfbfbf";
        }
        time.style.color = "#bfbfbf";
        // bar.style.border = "0.3vw solid black";
        entry.removeAttribute("id");
      }
    });
  }

  addDurations() {
    // Add duration. This is a stupid way but i am crashing out xxx
    if (this.currLevel == 4) {
      const lines = document.querySelectorAll(".line");
      lines.forEach((line, i) => {
        if (i < this.visibleTopics.length) {
          let div = line.querySelector(".timeDiv");
          let test = div.querySelector(".total-time");

          if (test == null) {
            let topic = this.visibleTopics.at(i);
            console.log(topic);

            let duration = this.timeDifference(
              this.visibleTopics.at(i).totalSeconds
            );
            console.log(duration);

            let newElement = document.createElement("h1");
            newElement.textContent = duration;
            newElement.classList.add("total-time");
            console.log(div.querySelector(".time").offsetWidth);
            newElement.style.maxWidth = `${
              div.querySelector(".time").offsetWidth
            }px`;
            newElement.style.marginTop = "0.5vh";
            div.appendChild(newElement); // Append the new <p> element to the div
          }
        }
      });
    }
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

  navForward() {
    let currZoomInd = "";
    if (this.currLevel > 0) {
      this.currLevel = this.currLevel == 4 ? 2 : this.currLevel - 1;
      if (this.currViewedTopic && this.currViewedTopic.zoomInIndex != null) {
        currZoomInd = this.currViewedTopic.zoomInIndex;
        this.currIndex =
          currZoomInd >= this.numTopicsShown
            ? currZoomInd - this.numTopicsShown
            : 0;
      }
      this.data = this.DataObj.getData(this.levels[this.currLevel]);
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown);

      // Find the index of the visible topic that matches currZoomTitle
      // Get the title of the current zoomed topic
      let currZoomTitle = this.data[currZoomInd]?.topic;
      if (currZoomTitle) {
        this.visTopicIndex = this.visibleTopics.findIndex(
          (topic) => topic.topic === currZoomTitle
        );
        // If no match is found, default to 0
        if (this.visTopicIndex === -1) {
          this.visTopicIndex = 0;
        }
      } else {
        this.visTopicIndex = 0; // Default to 0 if currZoomTitle is undefined
      }
      const timeOnly = this.formatTime(new Date());
      this.log += `${timeOnly}.Mode.${this.levels[this.currLevel]}\n`;
      console.log(this.log);
      // Update the screen
      this.updateScreen(this.DataObj, true, true);
    }
  }

  navBack() {
    if (
      this.currLevel == 2 &&
      this.DataObj.getData(this.levels[3]).length == 0
    ) {
      this.escape();
    } else if (
      this.currLevel < 4 &&
      this.DataObj.getData(this.levels[this.currLevel + 1]).length > 0
    ) {
      this.currLevel += 1;
      this.visTopicIndex = 0;
      this.currIndex =
        this.currViewedTopic.zoomOutIndex >= this.numTopicsShown
          ? this.currViewedTopic.zoomOutIndex - this.numTopicsShown + 1
          : 0;
      this.data = this.DataObj.getData(this.levels[this.currLevel]);
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown);
      const timeOnly = this.formatTime(new Date());
      this.log += `${timeOnly}.Mode.${this.levels[this.currLevel]}\n`;
      console.log(this.log);
      this.updateScreen(this.DataObj, true, true);
    }
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

  escape() {
    if (this.currLevel != 4) {
      if (this.DataObj.getData(this.levels[4]).length > 0) {
        this.currLevel = 4;
        this.visTopicIndex = 0;
        this.currIndex =
          this.currViewedTopic.topicIndex >= this.numTopicsShown
            ? this.currViewedTopic.topicIndex - this.numTopicsShown
            : 0;
        this.data = this.DataObj.getData(this.levels[this.currLevel]);
        this.visibleTopics = this.data
          .slice(this.currIndex, this.currIndex + this.numTopicsShown)
          .reverse();
        const timeOnly = this.formatTime(new Date());
        this.log += `${timeOnly}.Mode.${this.levels[this.currLevel]}\n`;
        console.log(this.log);
        this.updateScreen(this.DataObj, true, true);
      }
    }
  }

  // zoomOut() {
  //   // console.log("Out");
  //   let newNum = this.numTopicsShown + 1;
  //   // console.log(newNum);
  //   if (newNum <= Math.min(16, this.data.length)) {
  //     const timeOnly = this.formatTime(new Date());
  //     this.log += `${timeOnly}.#+.${newNum}\n`;
  //     console.log(this.log);
  //     this.updateScreen(this.DataObj, true, true, newNum);
  //   }
  // }

  // zoomIn() {
  //   // console.log("In");
  //   let newNum = this.numTopicsShown - 1;
  //   // console.log(newNum);
  //   if (newNum >= 1) {
  //     const timeOnly = this.formatTime(new Date());
  //     this.log += `${timeOnly}.#-.${newNum}\n`;
  //     console.log(this.log);
  //     this.updateScreen(this.DataObj, true, true, this.numTopicsShown - 1);
  //   }
  // }

  timelineView() {
    const timeOnly = this.formatTime(new Date());
    let topics = document.querySelector("#topics");
    if (!(topics.style.display == "none")) {
      if (!this.topicHidden) {
        this.hideTopics();
        const timeOnly = this.formatTime(new Date());
        this.log += `${timeOnly}.Vis.LV\n`;
        console.log(this.log);
        this.topicHidden = true;
      } else {
        this.hideTopics();
        const timeOnly = this.formatTime(new Date());
        this.log += `${timeOnly}.Vis.FV\n`;
        console.log(this.log);
        this.showTopics();
        this.topicHidden = false;
      }
    }
  }

  download() {
    const timeOnly = this.formatTime(new Date());
    this.log += `End Time: ${timeOnly}`;
    const blob = new Blob([this.log], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = "sample.txt"; // Change the file name and extension as needed
      document.body.appendChild(a);
      a.click();
      navigator.clipboard.writeText(this.log);
      document.body.removeChild(a);
    } catch (err) {
      console.log(err);
      document.querySelector(".repSentences").textContent = err;
    }
    // Clean up the URL object
    URL.revokeObjectURL(url);
  }

  toggleVis() {
    let topics = document.querySelector("#topics");
    let top = document.querySelector(".info-container");
    let main = document.querySelector(".main");
    requestAnimationFrame(() => {
      if (topics.style.display == "flex") {
        top.style.display = "none";
        document.querySelector("#zoom").style.visibility = "hidden";
        topics.style.display = "none";
        main.style.border = "1vw solid #80808042";
        const timeOnly = this.formatTime(new Date());
        this.log += `${timeOnly}.Vis.NV\n`;
        console.log(this.log);
      } else {
        topics.style.display = "flex";
        top.style.display = "block";
        document.querySelector("#zoom").style.visibility = "visible";
        main.style.border = "";
        const timeOnly = this.formatTime(new Date());
        this.log += `${timeOnly}.Vis.FV\n`;
        console.log(this.log);
      }
    });
  }

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

  resizeFont(checkSize = false) {
    const lines = document.querySelectorAll(".line");
    let entrySize = document.querySelector(".entry:not(#selected-entry)");
    if (entrySize == null) entrySize = document.querySelector(".entry");
    let levelText = document.getElementById("vis-level-text");
    let jumpButton = document.getElementById("jumpToCurrent");
    let jumpLabel = document.getElementById("timeDetails");
    // console.log(entrySize.offsetHeight);

    let window = document.getElementById("topics");

    lines.forEach((line) => {
      let repSentence = line.querySelector(".repSentences");
      let topicSentence = line.querySelector(".topicSentences");
      let time = line.querySelector(".time");
      let totalTime = line.querySelector(".total-time");

      if (checkSize) {
        this.topicSize = `clamp(15px, ${
          (window.offsetHeight / this.visibleTopics.length) * 0.4
        }px, 4vmin)`;
        this.repSize = `clamp(10px, ${
          (window.offsetHeight / this.visibleTopics.length) * 0.3
        }px, 2.5vmin)`;
      }

      topicSentence.style.fontSize = this.topicSize;
      time.style.fontSize = this.repSize;
      if (totalTime != null) {
        let totalTime = line.querySelector(".total-time");
        totalTime.style.fontSize = this.repSize;
      }
      levelText.style.fontSize = this.topicSize;
      jumpButton.style.fontSize = this.repSize;
      jumpLabel.style.fontSize = this.repSize;
      repSentence.style.fontSize = this.repSize;
    });
  }


  renderSpeechBubbles(bubble, data) {
    if (data.speakerTurns && data.speakerTurns.turns) {

      data.speakerTurns.turns.forEach((turn, index) => {
        const speakerId = parseInt(turn.speakerId.charAt(turn.speakerId.length - 1)) - 1;  
        //If speaker is self, align right
        const alignRight = (turn.speakerId == this.selfID);
        let speakerClass = ""
        if (alignRight) {
          speakerClass = "self"
        }
        
        // const bubbleContainer = bubble.append("div")
        //   .attr("class", speakerClass)
        //   .style("display", "flex")
        //   .style("margin", "8px 0")
        //   .style("width", "90%")
        
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
      
      // Apply zoom styling to newly created speech bubbles then see speaker colors are good
      setTimeout(() => {
        this.updateZoomStyles();
        this.preserveSpeakerColors();
      }, 10);
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

  // Ensure speaker colors are preserved after zoom styling
  preserveSpeakerColors() {
    const speechBubbles = document.querySelectorAll('.speechBubbleItem');
    speechBubbles.forEach((bubble, index) => {
      // See if the bubble has a background color, if not, apply default speaker color
      const currentBgColor = bubble.style.backgroundColor;
      if (!currentBgColor || currentBgColor === '' || currentBgColor === 'rgba(0, 0, 0, 0)') {
        // Apply a default speaker color based on index if no color is set
        const speakerId = index % 5;
        bubble.style.backgroundColor = this.speakerColours[speakerId];
        console.log(`Applied speaker color ${this.speakerColours[speakerId]} to bubble ${index}`);
      }
    });
  }

  // Interpolate value between keyframes based on current zoom
  interpolateValue(keyframes, zoomValue) {
    if (keyframes.length === 0) return null;
    if (keyframes.length === 1) return keyframes[0][1];
    
    // Find the two keyframes to interpolate between
    let lower = keyframes[0];
    let upper = keyframes[keyframes.length - 1];
    
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (zoomValue >= keyframes[i][0] && zoomValue <= keyframes[i + 1][0]) {
        lower = keyframes[i];
        upper = keyframes[i + 1];
        break;
      }
    }
    
    // If zoomValue is outside range, return boundary values
    if (zoomValue <= lower[0]) return lower[1];
    if (zoomValue >= upper[0]) return upper[1];
    
    // My way of trying to figure how tf to interpolate between numbers and things like rgb vals
    const t = (zoomValue - lower[0]) / (upper[0] - lower[0]);
    const lowerVal = lower[1];
    const upperVal = upper[1];
    
    // Handle different value types
    if (typeof lowerVal === 'number' && typeof upperVal === 'number') {
      return lowerVal + (upperVal - lowerVal) * t;
    }
    
    // Handle transform strings 
    if (typeof lowerVal === 'string' && lowerVal.includes('scale') && upperVal.includes('scale')) {
      const lowerScale = parseFloat(lowerVal.match(/scale\(([^)]+)\)/)[1]);
      const upperScale = parseFloat(upperVal.match(/scale\(([^)]+)\)/)[1]);
      const lowerTransX = lowerVal.includes('translateX') ? parseFloat(lowerVal.match(/translateX\(([^)]+)/)[1]) : 0;
      const upperTransX = upperVal.includes('translateX') ? parseFloat(upperVal.match(/translateX\(([^)]+)/)[1]) : 0;
      
      const interpScale = lowerScale + (upperScale - lowerScale) * t;
      const interpTransX = lowerTransX + (upperTransX - lowerTransX) * t;
      const unit = upperVal.includes('vw') ? 'vw' : (upperVal.includes('px') ? 'px' : '');
      
      return `scale(${interpScale}) translateX(${interpTransX}${unit})`;
    }
    
    // Handle rgba colors
    if (typeof lowerVal === 'string' && lowerVal.includes('rgba') && typeof upperVal === 'string' && upperVal.includes('rgba')) {
      const lowerMatch = lowerVal.match(/rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/);
      const upperMatch = upperVal.match(/rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/);
      if (lowerMatch && upperMatch) {
        const r = Math.round(parseInt(lowerMatch[1]) + (parseInt(upperMatch[1]) - parseInt(lowerMatch[1])) * t);
        const g = Math.round(parseInt(lowerMatch[2]) + (parseInt(upperMatch[2]) - parseInt(lowerMatch[2])) * t);
        const b = Math.round(parseInt(lowerMatch[3]) + (parseInt(upperMatch[3]) - parseInt(lowerMatch[3])) * t);
        const a = parseFloat(lowerMatch[4]) + (parseFloat(upperMatch[4]) - parseFloat(lowerMatch[4])) * t;
        return `rgba(${r},${g},${b},${a})`;
      }
    }

    // Handle size strings (rem, px, vw, etc.)
    if (typeof lowerVal === 'string' && typeof upperVal === 'string') {
      const lowerNum = parseFloat(lowerVal);
      const upperNum = parseFloat(upperVal);
      const unit = upperVal.replace(/[0-9.-]/g, '');
      const interpNum = lowerNum + (upperNum - lowerNum) * t;
      return `${interpNum}${unit}`;
    }
    
    // For discrete values, use threshold
    return t < 0.5 ? lowerVal : upperVal;
  }

  // Update all CSS properties based on current zoom value
  updateZoomStyles() {
    
    Object.keys(this.zoomConfig).forEach(elementType => {
      const config = this.zoomConfig[elementType];
      const elements = document.querySelectorAll(config.selector);
      // console.log(`Found ${elements.length} elements for ${elementType} (${config.selector})`);
      
      elements.forEach(element => {
        Object.keys(config.properties).forEach(property => {
          const keyframes = config.properties[property];
          const value = this.interpolateValue(keyframes, this.zoomValue);
          
          if (value !== null) {
            if (property === 'transform') {
              element.style.transform = value;
            } else if (property === 'font-size') {
              element.style.fontSize = value;
            } else if (property === 'background-color') {
              return;
            } else if (property === 'margin-left') {
              element.style.marginLeft = value;
            } else if (property === 'margin-right') {
              element.style.marginRight = value;
            } else if (property === 'text-align') {
              element.style.textAlign = value;
            } else if (property === 'color') {
              element.style.color = value;
            } else if (property === 'justify-content') {
              if (this.zoomValue>0.15) {
                element.style.justifyContent = 'flex-end';
              } else {
                let isSelf = (element.getAttribute("class") == "self")
                element.style.justifyContent = (isSelf) ? "flex-end" : "flex-start";
              }
            } else if (property === 'width') {
              element.style.width = value;
            } else if (property === 'height') {
              element.style.height = value;
            } else if (property === 'max-width') {
              element.style.maxWidth = value;
            } else if (property === 'overflow') {
              element.style.overflow = value;
            } else {
              element.style[property] = value;
            }
          }
        });
      });
    });
  }

  // Set zoom value and update styles
  setZoomValue(newZoomValue) {
    this.zoomValue = Math.max(0.0, Math.min(1.0, newZoomValue));
    console.log(`Setting zoom value to: ${this.zoomValue}`);
    this.updateZoomStyles();
    this.preserveSpeakerColors();
    
    // Update level indicator
    const levelText = document.getElementById("vis-level-text");
    if (levelText) {
      if (this.zoomValue < 0.15) {
        levelText.textContent = "Speech Bubbles";
      } else if (this.zoomValue < 0.35) {
        levelText.textContent = "10s Topics";
      } else if (this.zoomValue < 0.55) {
        levelText.textContent = "30s Topics";
      } else if (this.zoomValue < 0.75) {
        levelText.textContent = "1m Topics";
      } else {
        levelText.textContent = "5m Topics";
      }
    }
  }

  setSliderZoom(value) {
    if (value<0.01){
      value = 0;
    }
    this.setZoomValue(value);
  }

  // Zoom in (increase zoom value)
  zoomIn() {
    this.setZoomValue(this.zoomValue + this.zoomStep);
  }

  // Zoom out (decrease zoom value)
  zoomOut() {
    this.setZoomValue(this.zoomValue - this.zoomStep);
  }
}
