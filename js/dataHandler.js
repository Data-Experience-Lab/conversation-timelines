// // Hosted
import { OpenAI } from "/conversation-timelines/js/openaiController.js";
import { localStorageHelper } from "./localStorageHelper.js";
import mockData from "./mockData.js";
//Local
//  import { OpenAI } from "./openaiController.js";
//  import { localStorageHelper } from "./localStorageHelper.js";
// import mockData from "./mockData.js";
// import mockData2 from "./mockData2.js";

export class DataHandler {
  constructor() {  
    this.localStorageHelper = new localStorageHelper();
    this.tree = mockData2;
    this.openAI = new OpenAI();
  }

  initTree() {
    if (localStorage.length>0) {
      let json = this.localStorageHelper.getJSONItem();
      json = (json!=null) ? json : {0: []};
      return json
    } else {
      return {0: []};
    }
    // return {0: []};
  }

  // Get data for a specific level
  getData(treeDepth = "0") {
    console.log(this.tree)
    return this.tree[treeDepth] || [];
  }

  getTreeSize(){
    return Object.keys(this.tree).length;
  }

  // Update data and transcript with new transcription
  async update(transcription, time, speakerTurns, data, silenceLength=0) {
    //Always render silence blocks
    //We can stop showing speaker division at some point
    await this.addToData(transcription, time, speakerTurns, data, silenceLength);
    this.localStorageHelper.addToStorage(data)
    return true;
  }

    // Add new data to the appropriate levels
  async addToData(transcription, time, speakerTurns, data, silenceLength) {
    // When new 0 depth node is added
    // Propogate up the last node in all levels
    console.log("Silence Length: ", silenceLength)
    let newSpeakerTurns = []
    let silenceBlock = {
      "speakerId": "None",
      "speakerSeg": "",
      "length": 0
    }
    for (let i=0; i<silenceLength; i++){
      newSpeakerTurns.push(silenceBlock)
    }
    speakerTurns.turns = newSpeakerTurns.concat(speakerTurns.turns);
    console.log(speakerTurns)

    // Turn transcript into new root node
    let id = Object.keys(this.tree[0]).length;
    this.tree[0].push(this.createNode(null, null, transcription, time, speakerTurns, id, 0, null, String(id))) 
        
    // If this is the first node in the tree, return.
    if (id==0) {
        console.log("Tree:\t", this.tree)
        return;
    }
    
    //***
    // Create child nodes
    let treeHeight = Object.keys(this.tree).length -1;
    for (let i = treeHeight; i >= 0; i--) {
        console.log(i)
        console.log(this.tree[i])

        let depth = i+1;
        console.log(this.tree)
        let node1 = this.tree[i].at(-2);
        let node2 = this.tree[i].at(-1);

        console.log("Node 1\t", node1)
        console.log("Node 2\t", node2)
 
        // If both nodes exist
        if ((node1!=null)&&(node2!=null)) {
        // If node 1 does not already have a child at this depth
            console.log(node1.childNodes)
            if (Object.keys(node1.childNodes[depth]).length == 0) {
                let node = await this.summarizeNodes(node1, node2, depth);
                console.log("New node:\t", node)
                if (node != null) {
                    this.tree[depth].push(node);
                }
            }
        }
    } 

    console.log("Tree:\t", this.tree)
  }

  // Check if two nodes have similar topic. If so, merge into a child node.
  async summarizeNodes(node1, node2, depth) {

    let id, segments;
    let timeDiff;
    [id, segments] = this.getUniqueID(node1.segments + " " + node2.segments);
    console.log(id)
    console.log(segments)
    let transcript = "";
    let numStrings = String(segments).split(' '); // Split by whitespace
    let numbers = numStrings.map(Number).filter(num => !isNaN(num));
    for (let i=0; i<numbers.length; i++) {
        transcript += this.tree[0][numbers[i]].segment;
    }
    
    // OpenAI call
    let parentNodes;
    let result;
    let time = node1.time;
    let twoParents = true;
    let lastTopic = (this.tree[depth]!=null) ? this.tree[depth].at(-1) : "";

    if (this.getTimeDiff(time, "", "totalMin")>30) {
      result=null
    } else {
      result = await this.openAI.gptResult(transcript, lastTopic, "turn");
    }
      // console.log("OpenAI result:\t", result)
    console.log("DH result 1: ", result)
    if (result == null) {
        twoParents = false;
        console.log("DH Turn detected: ", transcript)
        numStrings = String(node1.segments).split(' '); // Split by whitespace
        numbers = numStrings.map(Number).filter(num => !isNaN(num));
        let new_Transcript = "";
        for (let i=0; i<numbers.length; i++) {
            new_Transcript += this.tree[0][numbers[i]].segment;
        }
        result = await this.openAI.gptResult(new_Transcript, lastTopic);
        console.log("DH result 2: ", result)
        parentNodes = {[node1.depth]: [node1.id]};
        id = node1.id;
        segments = node1.segments;
        console.log(node2)
        console.log(node2.time)
        console.log("One node")
        timeDiff = this.getTimeDiff(time, node2.time);
    } else {
      console.log("two nodes")
      parentNodes = (node1.depth==node2.depth) ?  {[node1.depth]: [node1.id, node2.id]} : {[node1.depth]: [node1.id], [node2.depth]: [node2.id]};
      timeDiff = this.getTimeDiff(time, "");
    }

    if (timeDiff == "0s") {
      return null;
    }

    // Ensure the layer exists in the tree
    if (!this.tree[depth]) {
      this.tree[depth] = [];
    }

    // Create and return new node
    let node = 
        this.createNode(result.topic.toUpperCase(), 
                        result.sentence, 
                        transcript, 
                        time,
                        null,
                        id,
                        depth,
                        parentNodes,
                        segments,
                        result.keywords,
                        timeDiff
                        )

    // Push child node to parent node children
    node1.childNodes[depth].push(node.id);
    if (twoParents) node2.childNodes[depth].push(node.id);
    return node;
  }

  getUniqueID(inputString) {
    const numStrings = String(inputString).split(' '); // Split by whitespace
    const numbers = numStrings.map(Number).filter(num => !isNaN(num));
    const segments = [...new Set(numbers)];
    segments.sort((a, b) => a - b);
    let id = [...segments];
    return [id.join(''), segments.join(' ')];
  }

  createNode(topic, description, segment, time, speakerTurns, id, depth, parentNodes, segments, keywords, timeDiff) {
    return {"topic": topic,
          "description": description,
          "segment": segment,
          "time": time,
          "speakerTurns": speakerTurns,
          "id": `${depth}-${String(id)}`,
          "depth": depth,
          "parentNodes": parentNodes,
          "childNodes": {[depth+1]: []},
          "segments": segments,
          "keywords": keywords,
          "totalTime": timeDiff
        }
  }

  getTimeDiff(startTime, endTime="", mode="string") {
    console.log(`Start time 1: ${startTime}`)
    console.log(`End time 1: ${endTime}`)
    let currTime;
    if (endTime==""){
      console.log("create time")
      currTime = new Date();
      console.log(endTime)
    } else {
      const [chours, cminutes, cseconds] = endTime.split(":").map(Number);
      currTime = new Date();
      currTime.setHours(chours, cminutes, cseconds, 0);
    }

    const [chours, cminutes, cseconds] = startTime.split(":").map(Number);
    startTime = new Date();
    startTime.setHours(chours, cminutes, cseconds, 0);

    console.log(`Start time 2: ${startTime}`)
    console.log(`End time 2: ${currTime}`)

    let diffMs = Math.abs(startTime - currTime); // Use Math.abs to handle negative differences
    let diffSeconds = Math.floor(diffMs / 1000);
    let hours = Math.floor(diffSeconds / 3600);
    let minutes = Math.floor((diffSeconds % 3600) / 60);
    let seconds = diffSeconds % 60;

    if (mode=="string"){
      let time = ""
      if (hours>0) time += `${hours}h `
      if (minutes>0) time += `${minutes}m `
      time += `${seconds}s`
      return time;
    } else if (mode=="totalMin"){
      return diffMs
    }
  }
}
