export class Visualization {
  constructor() {
    this.DataObj;
    this.onBoot = true;
    this.currIndex = 0; // change to 0 if you want to go forwards
    this.visTopicIndex = 0;
    this.currViewedTopic;
    this.maxIndex = 0;
    this.numTopicsShown = 3;
    this.data = "";
    this.navMode = false; // When true, this updates the timeline in real time with new topics
    this.treeDepth = 0;
    this.zoomValue = 0.0; // Start at speech bubble level
    this.zoomStep = 0.02; // Step size for left/right arrow keys
    this.selfID = "Guest-1";
    
    this.speakerColours = [
      "#648FFF",
      "#FFB000",
      "#785EF0",
      "#FE6100",
      "#DC267F",
    ];

    // the mapping we talked about in our convo
    this.zoomConfig = {
      "speechBubbles": {
        "selector": ".speechBubbleItem",
        "properties": {
          "transform": ["scale(1)", "scale(0.2)"],
          "color": ["white", "rgba(255,255,255,0.0)"],
          "font-size": ["16px", "4px"],
          "width": ["auto", "60px"],
          "max-width": ["50%", "10%"],
          "height": ["auto", "20px"],
          "overflow": ["visible", "hidden"]
        }
      },
      "speechBubbleContainers": {
        "selector": ".speechBubble",
        "properties": {
          "width": ["70%", "15%"],
          "margin-left": ["0", "85%"],
          "margin-right": ["0", "0%"],
        }
      },
      "speechBubbleItems": {
        "selector": ".speechBubbleItem",
        "properties": {
          "padding": ["12px 18px", "12px 18px"],
          "border-radius": ["20px", "20px"],
          "margin-bottom": ["8px", "2px"],
          "border-bottom-left-radius": ["5px", "20px"],
          "max-width": ["70%", "70%"],
          "word-wrap": ["break-word", "break-word"],
          "color": ["white", "white"],
          "font-weight": ["500", "500"],
          "box-shadow": ["0 2px 8px rgba(0,0,0,0.15)", "0 2px 8px rgba(0,0,0,0.15)"],
          "display": ["inline-block", "inline-block"],
        }
      },
      "speechBubbleSelf": {
        "selector": ".self",
        "properties": {
          "margin-left": ["80%", "0%"],
          "border-bottom-right-radius": ["5px", "20px"],
          "border-bottom-left-radius": ["20px", "20px"]
        }
      },
      "topics": {
        "selector": ".topicSentences",
        "properties": {
          "opacity": [
            0.0, 0.05, 0.1, 0.2, 0.3, 0.4,
            0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.0
          ],
          "transform": [
            "translateX(-800px)", "translateX(-750px)", "translateX(-700px)",
            "translateX(-650px)", "translateX(-600px)", "translateX(-550px)",
            "translateX(-500px)", "translateX(-400px)", "translateX(-300px)",
            "translateX(-200px)", "translateX(-100px)", "translateX(-25px)", "translateX(0px)"
          ],
          "font-size": ["20px", "24px", "28px", "32px"]
        }
      },
      "repSentences": {
        "selector": ".repSentences",
        "properties": {
          "opacity": [
            0.0, 0.05, 0.1, 0.15, 0.2, 0.3,
            0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.0
          ],
          "transform": [
            "translateX(-800px)", "translateX(-750px)", "translateX(-700px)",
            "translateX(-650px)", "translateX(-600px)", "translateX(-550px)",
            "translateX(-500px)", "translateX(-400px)", "translateX(-300px)",
            "translateX(-200px)", "translateX(-100px)", "translateX(-25px)", "translateX(0px)"
          ]
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
    // Full dialogue tree
    this.DataObj = dataobj;
    // console.log(this.DataObj.data);
    this.currLevel = 0;

    // Only data at current tree depth
    this.data = this.DataObj.getData(this.treeDepth);
    console.log(this.data);
    let lastMax = this.maxIndex;
    this.maxIndex = this.data.length - this.numTopicsShown;

    if (numTopics != this.numTopicsShown) {
      this.numTopicsShown = numTopics;
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown);
    } else {
      console.log(this.currIndex)
      // this.visibleTopics = this.data
      //   .slice(this.currIndex, this.currIndex + this.numTopicsShown);
      this.visibleTopics = this.data
        .slice(0, 0 + this.numTopicsShown);
    }

    document.getElementById("jumpToCurrent").style.display = "none";
    document.getElementById("timeDetails").style.display = "none";

    
    if (window.slider) {
      this.zoomStep = 1/(this.DataObj.getTreeSize()-1);
      window.slider.step(this.zoomStep); // Change step size
    }

    // Update UI elements based on the current state
    if (this.data.length > 0) {
      if (this.visTopicIndex > this.visibleTopics.length - 1) {
        this.visTopicIndex = this.visibleTopics.length - 1;
      }
      this.currViewedTopic = this.visibleTopics[this.visTopicIndex];
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
    console.log(visibleTopics)
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

            let duration = this.timeDifference(
              this.visibleTopics.at(i).totalSeconds
            );

            let newElement = document.createElement("h1");
            newElement.textContent = duration;
            newElement.classList.add("total-time");
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
    } else if (this.DataObj.getData(this.treeDepth).length > 1) {
      if (
        this.visTopicIndex < this.numTopicsShown - 1 &&
        this.visTopicIndex <
          this.DataObj.getData(this.treeDepth).length - 1
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
    bubble.attr("id", data.id)
    if (data.speakerTurns && data.speakerTurns.turns) {

      data.speakerTurns.turns.forEach((turn, index) => {
        const speakerId = parseInt(turn.speakerId.charAt(turn.speakerId.length - 1)) - 1;  
        //If speaker is self, align right
        const alignRight = (turn.speakerId == this.selfID);
        
        let speakerClass = ""
        if (alignRight) {
          speakerClass = "self"
        }
        
        const bubbleContainer = bubble.append("div")
          .attr("class", speakerClass)
          .style("display", "flex");

        console.log(turn)
        console.log(alignRight)
        
        const bubbleDiv = bubbleContainer.append("div")
          .attr("class", "speechBubbleItem")
          .style("background-color", this.speakerColours[speakerId % 5]);

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

  animateObjects(selector, config, index, animationDuration) {
    const selection = d3.selectAll(selector)
        .transition()
        .duration(animationDuration);

    if (this.treeDepth == 1){
      Object.entries(config).forEach(([property, values]) => {
          selection.style(property, values[0]);
        if (values[index] !== undefined) {
          selection.style(property, values[index]);
        }
      });
    } else {
      Object.entries(config).forEach(([property, values]) => {
        if (values[index] !== undefined) {
          selection.style(property, values[index]);
        }
      });
    }
      
  }

  // Update all CSS properties based on current zoom value
  updateZoomStyles() {
    let speechBubbleConfigIndex = (this.treeDepth==0) ? 0 : 1;
    let animationDuration = (this.onBoot || this.treeDepth>1) ? 0 : 1500;
    this.onBoot = false;
    if (true) {
      let speechBubbleConfig = this.zoomConfig.speechBubbles.properties;
      this.animateObjects(this.zoomConfig.speechBubbles.selector, speechBubbleConfig, speechBubbleConfigIndex, animationDuration)

      speechBubbleConfig = this.zoomConfig.speechBubbleContainers.properties;
      this.animateObjects(this.zoomConfig.speechBubbleContainers.selector, speechBubbleConfig, speechBubbleConfigIndex, animationDuration)
    
      speechBubbleConfig = this.zoomConfig.speechBubbleItems.properties;
      this.animateObjects(this.zoomConfig.speechBubbleItems.selector, speechBubbleConfig, speechBubbleConfigIndex, animationDuration)

      speechBubbleConfig = this.zoomConfig.speechBubbleSelf.properties;
      this.animateObjects(this.zoomConfig.speechBubbleSelf.selector, speechBubbleConfig, speechBubbleConfigIndex, animationDuration)
    }

    // Object.keys(this.zoomConfig).forEach(elementType => {
    //   const config = this.zoomConfig[elementType];
    //   const elements = document.querySelectorAll(config.selector);
    //   // console.log(`Found ${elements.length} elements for ${elementType} (${config.selector})`);
      
    //   elements.forEach(element => {
    //     Object.keys(config.properties).forEach(property => {
    //       const keyframes = config.properties[property];
    //       const value = this.interpolateValue(keyframes, this.zoomValue);
          
    //       if (value !== null) {
    //         if (property === 'transform') {
    //           element.style.transform = value;
    //         } else if (property === 'font-size') {
    //           element.style.fontSize = value;
    //         } else if (property === 'background-color') {
    //           return;
    //         } else if (property === 'margin-left') {
    //           element.style.marginLeft = value;
    //         } else if (property === 'margin-right') {
    //           element.style.marginRight = value;
    //         } else if (property === 'text-align') {
    //           element.style.textAlign = value;
    //         } else if (property === 'color') {
    //           element.style.color = value;
    //         } else if (property === 'justify-content') {
    //           if (this.zoomValue>0.15) {
    //             element.style.justifyContent = 'flex-end';
    //           } else {
    //             let isSelf = (element.getAttribute("class") == "self")
    //             element.style.justifyContent = (isSelf) ? "flex-end" : "flex-start";
    //           }
    //         } else if (property === 'width') {
    //           element.style.width = value;
    //         } else if (property === 'height') {
    //           element.style.height = value;
    //         } else if (property === 'max-width') {
    //           element.style.maxWidth = value;
    //         } else if (property === 'overflow') {
    //           element.style.overflow = value;
    //         } else {
    //           element.style[property] = value;
    //         }
    //       }
    //     });
    //   });
    // });
  }

  // Set zoom value and update styles
  setZoomValue(newZoomValue) {
    this.zoomValue = Math.max(0.0, Math.min(1.0, newZoomValue));
    console.log(this.treeDepth)
    if (this.treeDepth > 0){
      this.zoomValue = 1.0;
    } else {
      this.zoomValue = 0;
    }
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
    console.log("zoom in")
    if (this.treeDepth<this.DataObj.getTreeSize())
    {
      this.treeDepth += 1;
      this.updateScreen(this.DataObj)
      this.setZoomValue(this.zoomValue + this.zoomStep);
      window.slider.value([slider.value() - this.zoomStep]);
    }
  }

  // Zoom out (decrease zoom value)
  zoomOut() {
    console.log("zoom out")
    if (this.treeDepth>=1)
    {
      this.treeDepth -= 1;
      this.updateScreen(this.DataObj)
      this.setZoomValue(this.zoomValue - this.zoomStep);
      window.slider.value([slider.value() + this.zoomStep]);
    }
  }
}
