export class Visualization {
  constructor() {
    this.DataObj;
    this.segments = [];
    this.lastZoomOperation = null;
    this.lastTopics;
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
    this.bubbleFontSize = "10px";

    //  font sizes
    this.topicSize = "";
    this.repSize = "";
    this.timeSize = "";
    const now = new Date();
    const formatted = now.toLocaleString(); // Example: "3/30/2025, 10:30:15 AM"
    this.log = `Start Time: ${formatted}\n\n`;
    console.log(this.log);


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

    // Parse URL parameters to set the number of topics shown
    let params = new URLSearchParams(document.location.search);
    let numTopicsParam = parseInt(params.get("numtopics"), 10);
    this.requestedNum =
      !isNaN(numTopicsParam) && numTopicsParam > 0 ? numTopicsParam : 4;
    if (this.numTopicsShown > 16) {
      this.numTopicsShown = 16;
    }
    this.numTopicsShown = this.requestedNum;
    
    // the mapping we talked about in our convo
    this.bubbleConfig = {
      "speechBubbles": {
        "selector": ".speechBubbleItem",
        "properties": {
          "max-width": ["fit-content"],
          "min-width": ["1.5vw"],
          "max-height": ["fit-content"],
          "min-height": ["0.5vw"],
          "overflow": ["visible", "hidden"],
          "position": ["relative"],
          "word-wrap": ["break-word"],
          "font-weight": ["500", "0"],
          "box-shadow": ["0 2px 8px rgba(0,0,0,0.15)"],
          "display": ["inline-block"]
        }
      },
      "bubbleText": {
        "selector": ".bubbleText",
        "properties": {
          "color": ["white", "rgba(255,255,255,0.0)"],
          "font-size": [() => this.bubbleFontSize, "0px"]
        }
      },
      "speechBubbleSelf": {
        "selector": ".self",
        "properties": {
          "margin": ["0px 0px 8px 60%", "0px 0px 1px 0%"],
          "border-radius": ["30px 30px 5px 30px", "30px 30px 30px 30px"],
          "padding-left": ["10px", "0px"],
          "padding-right": ["10px", "0px"]
        }
      },
      "speechBubbleOther": {
        "selector": ".other",
        "properties": {
          "margin": ["8px 0px 8px 0px", "0px 0px 1px 0px"],
          "border-radius": ["30px 30px 30px 5px", "30px 30px 30px 30px"],
          "padding-left": ["10px", "0px"],
          "padding-right": ["10px", "0px"]
        }
      },
      "speechBubbleGroup": {
        "selector": ".speechBubbleGroup",
        "properties": {
          "padding-left": ["1vw", "0vw"],
        }
      },
      "speechBubbleContainers": {
        "selector": ".speechBubble",
        "properties": {
          "width": ["100%", "2%"]
        }
      },
    }

    this.topicConfig = {
      "topicBlock":{
        "selector": ".entry",
        "properties": {
          "flex-grow": [0, 0.9],
          "display": ["flex"],
          "align-items": ["center"],
        }
      },

      "topics": {
        "selector": ".topicSentences",
        "properties": {
          "display": ["none", null],
          "background": ["rgb(92 92 92 / 0%)", "rgb(92 92 92 / 35%)"],
          "padding": ["15px"],
          "width": ["fit-content"],
          "opacity": [
            0.0, 1.0
          ],
          "transform": [
            "translateX(-800px)", "translateX(0px)"
          ],
          "font-size": ["20px", "32px"]
        }
      },
      "repSentences": {
        "selector": ".repSentences",
        "properties": {
          "display": ["none", "none"]
        }
      },
      "repSentencesSelected": {
        "selector": "#selected-entry",
        "properties": {
          "display": ["none", "block"],
          "opacity": [
            0.0, 1.0
          ],
        "background": ["rgb(92 92 92 / 0%)", "rgb(92 92 92 / 35%)"],
        "padding": ["15px"],
        "width": ["fit-content"],
          "transform": [
            "translateX(-800px)", "translateX(0px)"
          ]
        }
      }
    };
  }

  // Update the screen with new data
  updateScreen(
    dataobj,
    debug = false,
    resize = false,
    numTopics = this.requestedNum
  ) {
    // Full dialogue tree
    this.DataObj = dataobj;
    // console.log(this.DataObj.data);
    this.currLevel = 0;
    this.numTopicsShown = (this.treeDepth==0) ? Math.min(this.requestedNum, 3) : this.requestedNum;
    console.log("Num topics", this.numTopicsShown)
    this.currIndex = Math.max(0, this.currIndex);

    // Only data at current tree depth
    this.data = this.DataObj.getData(this.treeDepth);
    this.segments = this.DataObj.getData(0);
    console.log(this.data);
    let lastMax = this.maxIndex;
    this.maxIndex = this.data.length - this.numTopicsShown;

    if (numTopics != this.numTopicsShown) {
      this.requestedNum =  numTopics;
      this.numTopicsShown = (this.treeDepth==0) ? Math.min(this.requestedNum, 3) : this.requestedNum;
      this.visibleTopics = this.data
        .slice(this.currIndex, this.currIndex + this.numTopicsShown);
    } else {
      if (this.numTopicsShown>this.data.length-1) {
        this.visibleTopics = this.data;
      } else {
        this.visibleTopics = this.data
          .slice(this.currIndex, this.currIndex + this.numTopicsShown);
      }
    }

    document.getElementById("jumpToCurrent").style.display = "none";
    document.getElementById("timeDetails").style.display = "none";

    if (window.slider) {
      this.zoomStep = 1/(this.DataObj.getTreeSize()-1);
      window.slider.step(this.zoomStep); // Change step size
    }

    if (this.DataObj.getTreeSize()==2) {
      document.querySelector("#slider").style.display = "block";
    }

    // Update UI elements based on the current state
    if (this.data.length > 0) {
      if (this.visTopicIndex > this.visibleTopics.length - 1) {
        this.visTopicIndex = this.visibleTopics.length - 1;
      }
      this.currViewedTopic = this.visibleTopics[this.visTopicIndex];

      console.log("Aa ", this.visibleTopics)

      console.log(this.currViewedTopic)
      console.log(this.currViewedTopic.time)
      this.handleNavigation(
        this.visibleTopics,
        lastMax,
        this.currViewedTopic.time
      );

      this.renderTimeline(this.visibleTopics);
      console.log(this.currViewedTopic)
      if (this.visibleTopics[this.visTopicIndex] != null) {
        if (this.treeDepth>0) this.hideRepSentences(this.currViewedTopic.id);
      }
    }

    if (this.topicHidden) {
      this.hideTopics();
    } else {
      this.showTopics();
    }
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
        document.getElementById("jumpToCurrent").textContent = "↓ Jump to Now";
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
      .style("flex-grow", 1)
      .style("margin-bottom", "2%")
      .style("align-items", "center")
      .style("display", "flex")
      .style("position", "relative")
      .style("padding-right", "12vw");

    let topicBlock = line.append("div").attr("class", "entry")

    // Create topic elements
    if (this.treeDepth!=0) 
    {
      console.log('aa aa: ', this.visibleTopics)

      line.style("border", "2px solid white")

      topicBlock
      .style("width", "0vw")
      .attr("id", (d)=>d.id)

      topicBlock
        .append("h1")
        .attr("class", "topicSentences")
        .style("display", "none")
        .text((d) => d.topic || `Topic ${d.id}`);
        
      
      topicBlock
        .append("p")
        .attr("class", "repSentences")
        .style("display", "none")
        .text((d) => d.description || d.repSentence || "Representative sentence...");
    }

    setTimeout(() => {
      line.attr("class", "line show");
      topicBlock.attr("class", "entry show");
    }, 10);

    // Create speech bubbles
    line
      .append("div")
      .attr("class", "speechBubble")
      .each((d, i, nodes) => {
        const bubble = d3.select(nodes[i]);
        this.renderSpeechBubbles(bubble, d);
      });

    let time = line.append("div").attr("class", `timeDiv`)
      .style("position", "absolute")
      .style("right", "3vw")
      .style("width", "10vw")

    time
      .append("h1")
      .attr("class", "time")
      .text((d) => d.time);
  }

  // Handle updates to existing elements in the DOM
  handleUpdate(update) {
    // Update topic text
    if (this.treeDepth!=0) 
    {
      update.select(".line")
        .attr("id", (d) => d.id);

      update.select(".topicSentences")
        .text((d) => d.topic || `Topic ${d.id}`);
      
      update.select(".repSentences")
        .text((d) => d.description || d.repSentence || "Representative sentence...");
    }

    // Update speech bubbles
    update.select(".speechBubble")
      .each((d, i, nodes) => {
        const bubble = d3.select(nodes[i]);
      });

      this.updateZoomStyles();
  }

  renderSpeechBubbles(bubble, data) {
    let segments = data.segments.split(" ").map(Number);

    segments.forEach((int) => {
      let segment = this.segments[int];
      let segmentDiv = d3.select(`#segment-${int}`);
        
      // If segment already exists move it to the right place
      if (!segmentDiv.empty()) {
        bubble.node().appendChild(segmentDiv.node());

      // Otherwise create segment
      } else {
        console.log(int)
        segmentDiv = bubble.append("div")
        .attr("id", `segment-${this.treeDepth}-${int}`)
        .attr("class", "speechBubbleGroup")
        .style("display", "flex")
        .style("flex-direction", "column")

        // Create new bubble for each speaker turn
        segment.speakerTurns.turns.forEach((turn, index) => {
          const speakerId = parseInt(turn.speakerId.charAt(turn.speakerId.length - 1)) - 1;  
          //If speaker is self, align right
          const alignRight = (turn.speakerId == this.selfID);
          let speakerClass = "other";
          if (alignRight) {
            speakerClass = "self";
          }
            
          const bubbleDiv = segmentDiv.append("div")
            .attr("class", "speechBubbleItem")
            .classed(speakerClass, true)
            .style("background-color", this.speakerColours[speakerId % 5])  

          const processedText = this.processFillerWords(turn.speakerSeg);
          bubbleDiv.append("p")
            .attr("class", "bubbleText")
            .html(processedText);
        });
      }
    });

    if (this.treeDepth==0) {
      this.resizeFont();
    } else {
      let el = document.getElementsByClassName('bubbleText')[0];
      let style = window.getComputedStyle(el, null).getPropertyValue('font-size');
      this.bubbleConfig.bubbleText.properties["font-size"][0] = style;
    }
    // Apply styles
    Object.keys(this.bubbleConfig).forEach((key)=> {
      let config = this.bubbleConfig[key];
      this.animateObjects(config.selector, config.properties, 0)
    });
      
    // Apply zoom styling to newly created speech bubbles then see speaker colors are good
    setTimeout(() => {
      this.updateZoomStyles();
      this.preserveSpeakerColors();
    }, 10);
  }

  animateObjects(selector, config, index, animationDuration, delay=0) {
    const elements = d3.selectAll(selector);

    // Then animate to end styles
    const transition = elements.transition()
      .delay(delay)
      .duration(animationDuration)

    Object.entries(config).forEach(([property, values]) => {
      let style = (values.length>index) ? index : 0;
      let value = values[style];
      if (typeof value === "function") value = value();
      if (value !== undefined) {
        if (selector==".bubbleText" && property=="font-size"){
        } 
        transition.style(property, value).on("end", function() {
          d3.select(this).style(property, value);
        });
      }
    });
  }

  // Update all CSS properties based on current zoom value
  updateZoomStyles() {
    //********** Updating speech bubble/speaker turns
    let speechBubbleConfigIndex = (this.treeDepth==0) ? 0 : 1;
    //Only show the animation if switching from 0 to 1
    let animationDuration = ((this.lastZoomOperation!="+") || (this.treeDepth>1)) ? 0 : 1250;

    Object.keys(this.bubbleConfig).forEach((key)=> {
      let config = this.bubbleConfig[key];
      this.animateObjects(config.selector, config.properties, speechBubbleConfigIndex, animationDuration)
    });

    d3.selectAll(".speechBubbleGroup").style("border-left", null)
    if (this.treeDepth==0) {
      d3.select(`.speechBubbleGroup#segment-${this.currViewedTopic.id}`).style("border-left", "2px solid #8a2525");
    }

    //********** Updating topics/rep sentences
    let delay = (this.lastZoomOperation=="+" && this.treeDepth==1) ? 1600 : 0;

    console.log(this.lastZoomOperation)
    console.log(this.treeDepth)
    Object.keys(this.topicConfig).forEach((key)=> {
      let config = this.topicConfig[key];
      this.animateObjects(config.selector, config.properties, speechBubbleConfigIndex, animationDuration, delay)
    });
  }

  // Hide representative sentences for all topics except the selected one
  hideRepSentences(selectedTopic) {
    console.log(this.currViewedTopic)
    const entries = document.querySelectorAll(".line");
    entries.forEach((entry, i) => {
      const repSentence = entry.querySelector(".repSentences");
      const topicSentence = entry.querySelector(".topicSentences");
      const time = entry.querySelector(".time");
      const totalTime = entry.querySelector(".total-time");

      if (selectedTopic === topicSentence.__data__.id) {
        repSentence.style.display = "none";
        repSentence.setAttribute("id", "selected-entry");
        time.style.color = "white";
        if (totalTime != null) {
          totalTime.setAttribute("id", "selected-entry");
          totalTime.style.color = "white";
        }
        repSentence.style.color = "white";
        topicSentence.style.color = "white";
      } else {
        repSentence.removeAttribute("id");
        topicSentence.removeAttribute("id");
        if (totalTime != null) {
          totalTime.removeAttribute("id", "selected-entry");
          totalTime.style.color = "#bfbfbf";
        }
        time.style.color = "#bfbfbf";
        entry.removeAttribute("id");
      }
    });
    // Apply styles
    console.log(this.lastZoomOperation)
    console.log(this.treeDepth)
    if (!(this.lastZoomOperation=="+" && this.treeDepth==1)) {
      console.log("hi")
      Object.keys(this.topicConfig).forEach((key)=> {
        let config = this.topicConfig[key];
        this.animateObjects(config.selector, config.properties, 1)
      });
    }
  }

  

  // ************ Button click events ************

  jumpToCurr() {
    this.lastZoomOperation = "";
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
    this.lastZoomOperation = "";
    if (this.visTopicIndex == 0 && this.currIndex == 0){
      return;
    }
    if (this.visTopicIndex == 0 && this.currIndex > 0) {
      this.currIndex = this.currIndex - 1;
      console.log("New data")
    } else {
      if (this.visTopicIndex > 0) {
        this.visTopicIndex -= 1;
      }
    }
    if (this.currViewedTopic != this.data.at(0)) {
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
    this.lastZoomOperation = "";
    console.log(this.currViewedTopic)
    if (this.currViewedTopic.id == this.data.at(-1).id){
      console.log("At the bottom!")
      return;
    }
    // If at the bottom of visible topics, load new topic
    if (this.visTopicIndex == this.numTopicsShown - 1 && this.currIndex < this.maxIndex){
      this.currIndex = this.currIndex + 1;
    // If there is more than one topic in the list
    } else if (this.DataObj.getData(this.treeDepth).length > 1) {
        this.visTopicIndex += 1;
    }
    if (this.currViewedTopic != this.data.at(-1)) {
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

   // Zoom in (increase zoom value)
  zoomIn() {
    console.log("zoom in")
    if (this.treeDepth<this.DataObj.getTreeSize()-1)
    {
      this.treeDepth += 1;
      let newData = this.DataObj.getData(this.treeDepth);
      console.log(this.currViewedTopic)
      console.log(Object.keys(this.currViewedTopic.childNodes).length)
      if (!(Object.keys(this.currViewedTopic.childNodes[this.treeDepth]).length==0)){
        console.log("children:)")
        let targetId = this.currViewedTopic.childNodes[this.treeDepth][0];
        this.currIndex = newData.findIndex(item => item.id === targetId);
      } else {
        console.log("No children!")
        this.currIndex = newData.length-1;
      }
      console.log(this.currIndex)
      // Ensure currIndex will allow for all topics to be shown
      if ((this.currIndex+this.numTopicsShown)>newData.length){
        let tempIndex = newData.length-this.numTopicsShown;
        this.currIndex = (tempIndex>=0) ? tempIndex : 0;
      }
      this.lastZoomOperation = "+";
      this.setZoomValue(this.zoomValue + this.zoomStep);
      window.slider.value([slider.value() - this.zoomStep]);
      this.updateScreen(this.DataObj)
    }
  }

  // Zoom out (decrease zoom value)
  zoomOut() {
    console.log("zoom out")
    if (this.treeDepth>=1)
    {
      this.treeDepth -= 1;
      let newData = this.DataObj.getData(this.treeDepth);
      if (!this.currViewedTopic.parentNodes[this.treeDepth].length==0){
        let targetId = this.currViewedTopic.parentNodes[this.treeDepth][1];
        this.currIndex = newData.findIndex(item => item.id === targetId);
      } else {
        this.currIndex = newData.length-1;
      }
      // Ensure currIndex will allow for all topics to be
      if ((this.currIndex+this.numTopicsShown)>newData.length){
        let tempIndex = newData.length-this.numTopicsShown;
        this.currIndex = ((tempIndex)>=0) ? tempIndex : 0;
      }
      this.lastZoomOperation = "-";
      this.setZoomValue(this.zoomValue - this.zoomStep);
      window.slider.value([slider.value() + this.zoomStep]);
      this.updateScreen(this.DataObj)
    }
  }

  setSliderZoom(value) {
    if (value<0.01){
      value = 0;
    }
    let depth = parseInt(value/this.zoomStep);
    if (depth!=this.treeDepth) {
      this.lastZoomOperation = (this.treeDepth<depth) ? "+" : "-";
      console.log(this.lastZoomOperation)
      let newData = this.DataObj.getData(depth);

      if (this.lastZoomOperation=="+"){
        this.currIndex = newData.findIndex(item => 
          typeof item.segments === "string" && item.segments.includes(this.currViewedTopic.segments)
        ); 
      } else {
        const target = this.currViewedTopic.segments.split(" ").map(Number);
        this.currIndex = newData.findIndex(item => {
          if (typeof item.segments !== "string") return false;
          const segments = item.segments.split(" ").map(Number);
          // Scan segments to see if target appears as a contiguous subsequence
          for (let i = 0; i <= target.length - segments.length; i++) {
            if (segments.every((val, j) => target[i + j] === val)) {
              return true;
            }
          }
          return false;
        });
      }
      this.visTopicIndex = 0;
      if (((this.currIndex+this.numTopicsShown)>newData.length)||(this.currIndex<0)){
        let tempIndex = newData.length-this.numTopicsShown;
        this.currIndex = ((tempIndex)>=0) ? tempIndex : 0;
      }

      this.treeDepth = depth;
      this.updateScreen(this.DataObj);
    }
    this.setZoomValue(value);
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

   resizeFont() {
    let window = document.getElementById("topics");
    let numBubbles = d3.selectAll(".speechBubbleItem").size();
    console.log(window.offsetHeight)
    console.log(numBubbles)
    if (numBubbles>0 && this.treeDepth==0) {
        this.bubbleFontSize = `clamp(1.5vmin, ${
          (window.offsetHeight / numBubbles) * 0.2
        }px, 20px)`;
    }
    this.topicSize = `clamp(15px, ${
      (window.offsetHeight / this.visibleTopics.length) * 0.4
      }px, 4vmin)`;
    this.repSize = `clamp(10px, ${
      (window.offsetHeight / this.visibleTopics.length) * 0.3
      }px, 2.5vmin)`;
    this.bubbleConfig.bubbleText.properties["font-size"][0] = this.bubbleFontSize;
  }
}
