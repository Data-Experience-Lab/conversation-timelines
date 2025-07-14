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
    resize = false,
    numTopics = this.numTopicsShown
  ) {
    this.DataObj = dataobj;
    // console.log(this.DataObj.data);
    this.data = this.DataObj.getData(this.levels[this.currLevel]);
    let lastMax = this.maxIndex;
    console.log(this.numTopicsShown);
    this.maxIndex = this.data.length - this.numTopicsShown;

    if (numTopics != this.numTopicsShown) {
      this.numTopicsShown = numTopics;
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown)
        .reverse();
    } else {
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown)
        .reverse();
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
      this.updateTimelineColour();
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
    this.calcTimeBlockHeight();
    this.setSpeakerTurnColours();
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
      if (this.data.at(-1).id != this.visibleTopics.at(0).id) {
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
    //     let top = "";
    //     let h1 = document.querySelector(".topicSentences");
    //     if (h1 != null) {
    //       top = h1.textContent;
    //     }

    //     let topicsDisplayed = document.querySelectorAll(".line").length;
    //     if (!(top == this.visibleTopics.at(0).topic) || !(topicsDisplayed == this.numTopicsShown)) {
    //       enter.each(
    //         function (d, i) {
    let line = enter
      .append("div")
      .attr("class", "line")
      .style("align-items", "center");

    let time = line.append("div").attr("class", `timeDiv`);

    time
      .append("h1")
      .attr("class", "time")
      .text((d) => d.time);

    let turnBlock = line
      .append("div")
      .attr("class", "turnBlock")
      .style("height", `100%`)
      .style("background-color", "blue");

    let timeBlock = line
      .append("div")
      .attr("class", "timeBlock")
      .style("height", `100%`)
      .style("background-color", this.timelineColour);

    let topicBlock = line.append("div").attr("class", "entry");

    setTimeout(() => {
      line.attr("class", "line show");
      topicBlock.attr("class", "entry show");
    }, 10);

    topicBlock
      .append("h1")
      .attr("class", "topicSentences")
      .text((d) => d.topic);

    if (this.currLevel == 0) {
      topicBlock
        .append("p")
        .attr("class", "repSentences")
        .text((d) => d.segment);
    } else {
      topicBlock
        .append("p")
        .attr("class", "repSentences")
        .text((d) => this.truncateStringAtWord(d.description, 150));
    }
    // }.bind(this)
    // );
    // }
  }

  // Handle updates to existing elements in the DOM
  handleUpdate(update) {
    update.select("h1.topicSentences").text((d) => d.topic);
    if (this.currLevel == 0) {
      update.select("p.repSentences").text((d) => d.segment);
    } else {
      update
        .select("p.repSentences")
        .text((d) => this.truncateStringAtWord(d.description, 150));
    }
  }
  /**
   * Hide representative sentences for all topics except the selected one
   * REMOVED: do not need this type of navigation anymore (I think)
   * TODO:
  **/
  // hideRepSentences(selectedTopic) {
  //   this.addDurations();

  //   const entries = document.querySelectorAll(".line");
  //   entries.forEach((entry, i) => {
  //     const repSentence = entry.querySelector(".repSentences");
  //     const topicSentence = entry.querySelector(".topicSentences");
  //     const time = entry.querySelector(".time");
  //     const totalTime = entry.querySelector(".total-time");
  //     const bar = entry.querySelector(".turnBlock");

  //     if (this.currLevel == 4) {
  //       repSentence.style.color = this.topicsColours[i % 8];
  //       topicSentence.style.color = this.topicsColours[i % 8];
  //     } else {
  //       topicSentence.style.color = "#bfbfbf";
  //     }

  //     if (selectedTopic === topicSentence.__data__.id) {
  //       repSentence.style.display = "block";
  //       repSentence.setAttribute("id", "selected-entry");
  //       topicSentence.setAttribute("id", "selected-entry");
  //       entry.setAttribute("id", "selected-entry");
  //       time.setAttribute("id", "selected-entry");
  //       time.style.color = "white";
  //       if (totalTime != null) {
  //         totalTime.setAttribute("id", "selected-entry");
  //         totalTime.style.color = "white";
  //       }
  //       bar.style.border = "0.3vw solid white";
  //       repSentence.style.color = "white";
  //       topicSentence.style.color = "white";
  //     } else {
  //       repSentence.style.display = "none";
  //       repSentence.removeAttribute("id");
  //       topicSentence.removeAttribute("id");
  //       if (totalTime != null) {
  //         totalTime.removeAttribute("id", "selected-entry");
  //         totalTime.style.color = "#bfbfbf";
  //       }
  //       time.style.color = "#bfbfbf";
  //       bar.style.border = "0.3vw solid black";
  //       entry.removeAttribute("id");
  //     }
  //   });
  // }

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

  /**
   * Allows user to jump to live transcription/newest summary level
   * TODO: should I leave this here
   */
  jumpToCurr() {
    this.currIndex = this.maxIndex;
    this.visTopicIndex = 0;
    this.visibleTopics = this.data
      .slice(this.currIndex, this.currIndex + this.numTopicsShown)
      .reverse();
    // console.log(this.visibleTopics);
    const timeOnly = this.formatTime(new Date());
    this.log += `${timeOnly}.Action.J\n`;
    console.log(this.log);
    this.updateScreen(this.DataObj, false, true);
  }

  /**
   * Allows user to navigate to a different granularity (smaller granularity)
   * TODO: ask if we shoudl remove
   */
  // navForward() {
  //   let currZoomInd = "";
  //   if (this.currLevel > 0) {
  //     this.currLevel = this.currLevel == 4 ? 2 : this.currLevel - 1;
  //     if (this.currViewedTopic && this.currViewedTopic.zoomInIndex != null) {
  //       currZoomInd = this.currViewedTopic.zoomInIndex;
  //       this.currIndex =
  //         currZoomInd >= this.numTopicsShown
  //           ? currZoomInd - this.numTopicsShown
  //           : 0;
  //     }
  //     this.data = this.DataObj.getData(this.levels[this.currLevel]);
  //     this.visibleTopics = this.data
  //       .slice(this.currIndex, this.currIndex + this.numTopicsShown)
  //       .reverse();

  //     // Find the index of the visible topic that matches currZoomTitle
  //     // Get the title of the current zoomed topic
  //     let currZoomTitle = this.data[currZoomInd]?.topic;
  //     if (currZoomTitle) {
  //       this.visTopicIndex = this.visibleTopics.findIndex(
  //         (topic) => topic.topic === currZoomTitle
  //       );
  //       // If no match is found, default to 0
  //       if (this.visTopicIndex === -1) {
  //         this.visTopicIndex = 0;
  //       }
  //     } else {
  //       this.visTopicIndex = 0; // Default to 0 if currZoomTitle is undefined
  //     }
  //     const timeOnly = this.formatTime(new Date());
  //     this.log += `${timeOnly}.Mode.${this.levels[this.currLevel]}\n`;
  //     console.log(this.log);
  //     // Update the screen
  //     this.updateScreen(this.DataObj, true, true);
  //   }
  // }

  /**
   * Allows user to navigate to a larger granularity/time
   * TODO: ask if need to remove
   */
  // navBack() {
  //   if (
  //     this.currLevel == 2 &&
  //     this.DataObj.getData(this.levels[3]).length == 0
  //   ) {
  //     this.escape();
  //   } else if (
  //     this.currLevel < 4 &&
  //     this.DataObj.getData(this.levels[this.currLevel + 1]).length > 0
  //   ) {
  //     this.currLevel += 1;
  //     this.visTopicIndex = 0;
  //     this.currIndex =
  //       this.currViewedTopic.zoomOutIndex >= this.numTopicsShown
  //         ? this.currViewedTopic.zoomOutIndex - this.numTopicsShown + 1
  //         : 0;
  //     this.data = this.DataObj.getData(this.levels[this.currLevel]);
  //     this.visibleTopics = this.data
  //       .slice(this.currIndex, this.currIndex + this.numTopicsShown)
  //       .reverse();
  //     const timeOnly = this.formatTime(new Date());
  //     this.log += `${timeOnly}.Mode.${this.levels[this.currLevel]}\n`;
  //     console.log(this.log);
  //     this.updateScreen(this.DataObj, true, true);
  //   }
  // }

  /**
   * Allows user to scroll up throughout visualization
   * REMOVED: Transitions will replace this (?)
   * @param {*} log: logs to console 
   */
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
        .slice(this.currIndex, this.currIndex + this.numTopicsShown)
        .reverse();

      // console.log("Debug Up VTI" + this.visTopicIndex);
      // console.log("Debug Up CI " + this.currIndex);
      // console.log("Debug Up MI " + this.maxIndex);
      // console.log("Debug Up: ", this.visibleTopics);
      if (log) {
        const timeOnly = this.formatTime(new Date());
        this.log += `${timeOnly}.Action.↑\n`;
        console.log(this.log);
      }
      this.updateScreen(this.DataObj);
    }
  }

  /**
   * Allows user to scroll down throughout visualization
   * REMOVED: Transitions will replace this (?)
   * @param {*} log: logs to console 
   */
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
        .slice(this.currIndex, this.currIndex + this.numTopicsShown)
        .reverse();

      // console.log("Debug Down VTI " + this.visTopicIndex);
      // console.log("Debug Down CI " + this.currIndex);
      // console.log("Debug Down MI " + this.maxIndex);
      // console.log("Debug Down: ", this.visibleTopics);
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

  /**
   * Allows user to remove topics from view
   */
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

  /**
   * Allows user to add topics to view
   */
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

  calcTimeBlockHeight() {
    // Calculate the height of the timeline bar based on the mode
    if (this.currLevel == 4) {
      let windowHeight = document.getElementById("topics").offsetHeight - 80;

      // Calculate the total duration of all topics
      const totalDuration = this.visibleTopics.reduce(
        (sum, topic, index, topics) => {
          if (index < topics.length) {
            sum += topic.totalSeconds;
          }
          return sum;
        },
        0
      );
      console.log(totalDuration);
      const lines = document.querySelectorAll(".line");

      lines.forEach((line, i) => {
        if (i < this.numTopicsShown) {
          const bar = line.querySelector(".timeBlock");
          const turnBar = line.querySelector(".turnBlock");
          const entry = line.querySelector(".entry");
          const topic = entry.querySelector(".topicSentences");

          bar.style.backgroundColor = this.topicsColours[i % 8];

          const percentage = this.visibleTopics[i].totalSeconds / totalDuration;
          const barHeight = percentage * windowHeight;

          // If the bar height is greater than content height,
          // set the whole div to percentage to account for the
          // margins
          if (barHeight >= topic.offsetHeight) {
            line.style.height = `${percentage * 100}%`;
          } else {
            bar.style.height = `${barHeight}px`;
            turnBar.style.height = `${barHeight}px`;
          }
          bar.style.display = "none";
        }
      });
    } else {
      // document.getElementById("subTopics").style.display = "none";
      // For other modes, evenly split the timeline bars
      const lines = document.querySelectorAll(".line");
      lines.forEach((line) => {
        line.style.flexGrow = 1;
        const bar = line.querySelector(".timeBlock");
        bar.style.display = "none";
      });
    }
  }

  // Update the timeline colour based on the current level
  updateTimelineColour() {
    const levelText = document.getElementById("vis-level-text");
    const textContainer = document.getElementById("text-container");
    if (levelText) {
      let level = this.levels[this.currLevel];
      switch (level) {
        case "s10":
          levelText.textContent = `10s`;
          // levelText.style.backgroundColor = "rgb(211, 33, 45, 0.6)";
          // this.timelineColour = "#D3212D";
          break;
        case "s30":
          levelText.textContent = `30s`;
          // levelText.style.backgroundColor = "rgb(162, 38, 75, 0.6)";
          // this.timelineColour = "#A2264B";
          break;
        case "m1":
          levelText.textContent = `1m`;
          // levelText.style.backgroundColor = "rgb(114, 43, 106, 0.6)";
          // this.timelineColour = "#722B6A";
          break;
        case "m5":
          levelText.textContent = `5m`;
          // levelText.style.backgroundColor = "rgb(65, 47, 136, 0.6)";
          // this.timelineColour = "#412F88";
          break;
        case "topics":
          levelText.textContent = `Topics`;
          // levelText.style.backgroundColor = "rgb(65, 47, 136, 0.6)";
          break;
      }
    }
  }

  setSpeakerTurnColours() {
    const lines = document.querySelectorAll(".line");

    lines.forEach((line, i) => {
      if (i < this.numTopicsShown) {
        const turnBar = line.querySelector(".turnBlock");
        if (this.visibleTopics[i].speakerTurns != null) {
          let speakerTurn = this.visibleTopics[i].speakerTurns;
          let lastSpeaker = "";
          let totalHeight = 0;
          for (var i = speakerTurn.turns.length - 1; i >= 0; i--) {
            let turn = speakerTurn.turns[i];

            let id =
              parseInt(turn.speakerId.charAt(turn.speakerId.length - 1)) - 1;
            if (i == speakerTurn.turns.length - 1) {
              lastSpeaker = id;
              totalHeight += turn.length / speakerTurn.total;
            } else if (lastSpeaker == id) {
              totalHeight += turn.length / speakerTurn.total;
            } else {
              let turndiv = document.createElement("div");
              turnBar.appendChild(turndiv);
              turndiv.style.backgroundColor =
                this.speakerColours[lastSpeaker % 5];
              turndiv.style.height = `${totalHeight * 100}%`;
              lastSpeaker = id;
              totalHeight = turn.length / speakerTurn.total;
            }
            if (i == 0) {
              let turndiv = document.createElement("div");
              turnBar.appendChild(turndiv);
              turndiv.style.backgroundColor = this.speakerColours[id % 5];
              turndiv.style.height = `${totalHeight * 100}%`;
              lastSpeaker = "";
              totalHeight = 0;
            }
          }
        }
      }
    });
  }
}