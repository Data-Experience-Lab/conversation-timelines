// Hosted
import { OpenAI } from "/conversation-timelines/js/openaiController.js";
import mockData from "./mockData.js";

export class DataHandler {
  constructor() {  
    this.tree = mockData;
    this.openAI = new OpenAI();
  }

  initTree() {
    return {0: []};
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
  async update(transcription, speakerTurns, data) {
    await this.addToData(transcription, speakerTurns, data);
    return true;
  }

    // Add new data to the appropriate levels
  async addToData(transcription, time, speakerTurns, data) {
    // When new 0 depth node is added
    // Propogate up the last node in all levels

    // Turn transcript into new root node
    let id = Object.keys(this.tree[0]).length
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
            if (node1.childNodes.length == 0) {
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
    let parentNodes, speakerTurns;
    let result = await this.openAI.gptResult(transcript, "");
    console.log("OpenAI result:\t", result)
    if (result == null) {
        numStrings = String(node1.segments).split(' '); // Split by whitespace
        numbers = numStrings.map(Number).filter(num => !isNaN(num));
        for (let i=0; i<numbers.length; i++) {
            transcript += this.tree[0][numbers[i]].segment;
        }
        result = await this.openAI.gptResult(transcript, "");
        parentNodes = {[node1.depth]: [node1.id]};
    } else {
        parentNodes = (node1.depth==node2.depth) ?  {[node1.depth]: [node1.id, node2.id]} : {[node1.depth]: [node1.id], [node2.depth]: [node2.id]};
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
                        node1.time,
                        null,
                        id,
                        depth,
                        parentNodes,
                        segments
                        )

    // Push child node to parent node children
    node1.childNodes.push(node.id)
    node2.childNodes.push(node.id)
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

  createNode(topic, description, segment, time, speakerTurns, id, depth, parentNodes, segments) {
    return {"topic": topic,
          "description": description,
          "segment": segment,
          "time": time,
          "speakerTurns": speakerTurns,
          "id": String(id),
          "depth": depth,
          "parentNodes": parentNodes,
          "childNodes": [],
          "segments": segments
        }
  }
}