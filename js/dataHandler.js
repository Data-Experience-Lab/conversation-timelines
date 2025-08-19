// Hosted
import { OpenAI } from "/conversation-timelines/js/openaiController.js";

export class DataHandler {
  constructor() {
    this.tree = this.initTree();
    this.openAI = new OpenAI();
    this.lastPostTurn = "";
    this.minSegWithLastTurn = "";
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
    // Create second layer nodes
    // For each new node, check if left neighbour node has child in depth 1
    // (Meaning it has already merged with a root layer node)
    // If left node does not have a child attempt to create a child node

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
            console.log(Object.keys(node1.childNodes[depth]))
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
        speakerTurns = node1.speakerTurn;
    } else {
        parentNodes = (node1.depth==node2.depth) ?  {[node1.depth]: [node1.id, node2.id]} : {[node1.depth]: [node1.id], [node2.depth]: [node2.id]};
        speakerTurns = this.mergeSpeakerTurns(node1.speakerTurns, node2.speakerTurns);
    }

    // Ensure the layer exists in the tree
    if (!this.tree[depth]) {
        this.tree[depth] = [];
    }

    // Create and return new node
    // let parentNodes = (node1.depth==node2.depth) ?  {[node1.depth]: [node1.id, node2.id]} : {[node1.depth]: [node1.id], [node2.depth]: [node2.id]};
    let node = 
        this.createNode(result.topic.toUpperCase(), 
                        result.sentence, 
                        transcript, 
                        node1.time,
                        speakerTurns,
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

   mergeSpeakerTurns(speakerTurns1, speakerTurns2) {
    let speakerTurns = [speakerTurns1, speakerTurns2]

    let combinedTotal = 0;
    // use an object to accumulate speaker lengths by speakerId
    const combinedSpeakers = {};
    const combinedTurns = [];

    speakerTurns.forEach((segment) => {
      combinedTotal += segment.total;
      // process speakers
      segment.speakers.forEach((sp) => {
        if (combinedSpeakers[sp.speakerId] === undefined) {
          combinedSpeakers[sp.speakerId] = sp.length;
        } else {
          combinedSpeakers[sp.speakerId] += sp.length;
        }
      });

      // add turns (order is preserved by concatenation)
      combinedTurns.push(...segment.turns);
    });

    // Convert combinedSpeakers object to an array
    const speakersArray = Object.keys(combinedSpeakers).map((speakerId) => {
      return { speakerId, length: combinedSpeakers[speakerId] };
    });

    return {
      total: combinedTotal,
      speakers: speakersArray,
      turns: combinedTurns,
    };
  }

  mockData() {
    let data = {
    "0": [
        {
            "topic": null,
            "description": null,
            "segment": "Do you favorite life? I think try to bake like a chicken breast and then the the grease is just like watering everywhere. You get it best. ",
            "time": "16:18:03",
            "speakerTurns": {
                "total": 27,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 27
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Do you favorite life? I think try to bake like a chicken breast and then the the grease is just like watering everywhere. You get it best.",
                        "length": 27
                    }
                ]
            },
            "id": "0",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "01"
                ],
                "2": []
            },
            "segments": "0"
        },
        {
            "topic": null,
            "description": null,
            "segment": "So yes, let's just say not the best. Of cooking. That's kind of weird. She. Just she didn't mean it, but like. ",
            "time": "16:18:25",
            "speakerTurns": {
                "total": 22,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 14
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "So yes, let's just say not the best.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Of cooking. That's kind of weird. She.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Just she didn't mean it, but like.",
                        "length": 7
                    }
                ]
            },
            "id": "1",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "01"
                ],
                "2": []
            },
            "segments": "1"
        },
        {
            "topic": null,
            "description": null,
            "segment": "And then she's like, why don't you cook this like? ",
            "time": "16:18:35",
            "speakerTurns": {
                "total": 10,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 10
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "And then she's like, why don't you cook this like?",
                        "length": 10
                    }
                ]
            },
            "id": "2",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "23"
                ],
                "2": []
            },
            "segments": "2"
        },
        {
            "topic": null,
            "description": null,
            "segment": "We're mad. OK, Mom. I'm trying to. ",
            "time": "16:18:46",
            "speakerTurns": {
                "total": 7,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 7
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "We're mad.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "OK, Mom.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "I'm trying to.",
                        "length": 3
                    }
                ]
            },
            "id": "3",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "23"
                ],
                "2": []
            },
            "segments": "3"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Yeah, I started making them. ",
            "time": "16:19:07",
            "speakerTurns": {
                "total": 5,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 5
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Yeah, I started making them.",
                        "length": 5
                    }
                ]
            },
            "id": "4",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "45"
                ],
                "2": []
            },
            "segments": "4"
        },
        {
            "topic": null,
            "description": null,
            "segment": "I I can't eat it, but it's. ",
            "time": "16:19:40",
            "speakerTurns": {
                "total": 7,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 7
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I I can't eat it, but it's.",
                        "length": 7
                    }
                ]
            },
            "id": "5",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "45"
                ],
                "2": []
            },
            "segments": "5"
        },
        {
            "topic": null,
            "description": null,
            "segment": "I like eggs, and very specifically, but I don't like it, Yeah. ",
            "time": "16:20:01",
            "speakerTurns": {
                "total": 12,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 12
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I like eggs, and very specifically, but I don't like it, Yeah.",
                        "length": 12
                    }
                ]
            },
            "id": "6",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "67"
                ],
                "2": []
            },
            "segments": "6"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Lately. ",
            "time": "16:20:55",
            "speakerTurns": {
                "total": 1,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 1
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Lately.",
                        "length": 1
                    }
                ]
            },
            "id": "7",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "67"
                ],
                "2": []
            },
            "segments": "7"
        },
        {
            "topic": null,
            "description": null,
            "segment": "It's like, it's like impressive how much snow it can give off. Yeah, Oh my goodness. ",
            "time": "16:21:06",
            "speakerTurns": {
                "total": 16,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 16
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "It's like, it's like impressive how much snow it can give off. Yeah, Oh my goodness.",
                        "length": 16
                    }
                ]
            },
            "id": "8",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "89"
                ],
                "2": []
            },
            "segments": "8"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Cedar of the sauce. Yeah. ",
            "time": "16:21:27",
            "speakerTurns": {
                "total": 5,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 5
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Cedar of the sauce.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Yeah.",
                        "length": 1
                    }
                ]
            },
            "id": "9",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "89"
                ],
                "2": []
            },
            "segments": "9"
        },
        {
            "topic": null,
            "description": null,
            "segment": "They have a million types of hot socks like this. This is better for them like this and Sasha better for this and then. ",
            "time": "16:21:38",
            "speakerTurns": {
                "total": 24,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 24
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "They have a million types of hot socks like this. This is better for them like this and Sasha better for this and then.",
                        "length": 24
                    }
                ]
            },
            "id": "10",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "1011"
                ],
                "2": []
            },
            "segments": "10"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Julius is better for this. Like I only saw the means. ",
            "time": "16:21:48",
            "speakerTurns": {
                "total": 11,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 11
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Julius is better for this.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Like I only saw the means.",
                        "length": 6
                    }
                ]
            },
            "id": "11",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "1011"
                ],
                "2": []
            },
            "segments": "11"
        },
        {
            "topic": null,
            "description": null,
            "segment": "And I need to have a chili boy with. That's good, I mean. ",
            "time": "16:21:59",
            "speakerTurns": {
                "total": 13,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 9
                    },
                    {
                        "speakerId": "Guest-6",
                        "length": 4
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And I need to have a chili boy with.",
                        "length": 9
                    },
                    {
                        "speakerId": "Guest-6",
                        "speakerSeg": "That's good, I mean.",
                        "length": 4
                    }
                ]
            },
            "id": "12",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "1213"
                ],
                "2": []
            },
            "segments": "12"
        },
        {
            "topic": null,
            "description": null,
            "segment": "We, I think we used to buy it too. So yeah. And I actually. Oh yeah. Yeah, he's my friend. ",
            "time": "16:22:21",
            "speakerTurns": {
                "total": 20,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 2
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "We, I think we used to buy it too. So yeah. And I actually.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh yeah.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Yeah, he's my friend.",
                        "length": 4
                    }
                ]
            },
            "id": "13",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [
                    "1213"
                ],
                "2": []
            },
            "segments": "13"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Later. ",
            "time": "16:22:42",
            "speakerTurns": {
                "total": 1,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 1
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Later.",
                        "length": 1
                    }
                ]
            },
            "id": "14",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [],
                "2": []
            },
            "segments": "14"
        }
    ],
    "1": [
        {
            "topic": "COOKING EXPERIMENT",
            "description": "I think try to bake like a chicken breast and then the the grease is just like watering everywhere.",
            "segment": "Do you favorite life? I think try to bake like a chicken breast and then the the grease is just like watering everywhere. You get it best. So yes, let's just say not the best. Of cooking. That's kind of weird. She. Just she didn't mean it, but like. ",
            "time": "16:18:25",
            "speakerTurns": {
                "total": 49,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 35
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 14
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "So yes, let's just say not the best.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Of cooking. That's kind of weird. She.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Just she didn't mean it, but like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Do you favorite life? I think try to bake like a chicken breast and then the the grease is just like watering everywhere. You get it best.",
                        "length": 27
                    }
                ]
            },
            "id": "01",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "1",
                    "0"
                ]
            },
            "childNodes": {
                "2": [
                    "0123"
                ],
                "3": []
            },
            "segments": "0 1"
        },
        {
            "topic": "COOKING ADVICE",
            "description": "And then she's like, why don't you cook this like?",
            "segment": "And then she's like, why don't you cook this like? We're mad. OK, Mom. I'm trying to. ",
            "time": "16:18:46",
            "speakerTurns": {
                "total": 17,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 17
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "We're mad.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "OK, Mom.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "I'm trying to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "And then she's like, why don't you cook this like?",
                        "length": 10
                    }
                ]
            },
            "id": "23",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "3",
                    "2"
                ]
            },
            "childNodes": {
                "2": [
                    "0123"
                ],
                "3": []
            },
            "segments": "2 3"
        },
        {
            "topic": "MAKING FOOD",
            "description": "Yeah, I started making them.",
            "segment": "Yeah, I started making them. I I can't eat it, but it's. ",
            "time": "16:19:40",
            "speakerTurns": {
                "total": 12,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 12
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I I can't eat it, but it's.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Yeah, I started making them.",
                        "length": 5
                    }
                ]
            },
            "id": "45",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "5",
                    "4"
                ]
            },
            "childNodes": {
                "2": [
                    "4567"
                ],
                "3": []
            },
            "segments": "4 5"
        },
        {
            "topic": "FOOD PREFERENCES",
            "description": "I like eggs, and very specifically, but I don't like it.",
            "segment": "I like eggs, and very specifically, but I don't like it, Yeah. Lately. ",
            "time": "16:20:55",
            "speakerTurns": {
                "total": 13,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 1
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 12
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Lately.",
                        "length": 1
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I like eggs, and very specifically, but I don't like it, Yeah.",
                        "length": 12
                    }
                ]
            },
            "id": "67",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "7",
                    "6"
                ]
            },
            "childNodes": {
                "2": [
                    "4567"
                ],
                "3": []
            },
            "segments": "6 7"
        },
        {
            "topic": "SNOWFALL",
            "description": "It's like impressive how much snow it can give off.",
            "segment": "It's like, it's like impressive how much snow it can give off. Yeah, Oh my goodness. Cedar of the sauce. Yeah. ",
            "time": "16:21:27",
            "speakerTurns": {
                "total": 21,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 16
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Cedar of the sauce.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Yeah.",
                        "length": 1
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "It's like, it's like impressive how much snow it can give off. Yeah, Oh my goodness.",
                        "length": 16
                    }
                ]
            },
            "id": "89",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "9",
                    "8"
                ]
            },
            "childNodes": {
                "2": [
                    "891011"
                ],
                "3": []
            },
            "segments": "8 9"
        },
        {
            "topic": "HOT SOCKS TYPES",
            "description": "They have a million types of hot socks like this.",
            "segment": "They have a million types of hot socks like this. This is better for them like this and Sasha better for this and then. Julius is better for this. Like I only saw the means. ",
            "time": "16:21:48",
            "speakerTurns": {
                "total": 35,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 24
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Julius is better for this.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Like I only saw the means.",
                        "length": 6
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "They have a million types of hot socks like this. This is better for them like this and Sasha better for this and then.",
                        "length": 24
                    }
                ]
            },
            "id": "1011",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "11",
                    "10"
                ]
            },
            "childNodes": {
                "2": [
                    "891011"
                ],
                "3": []
            },
            "segments": "10 11"
        },
        {
            "topic": "CHILI BOY",
            "description": "And I need to have a chili boy with.",
            "segment": "And I need to have a chili boy with. That's good, I mean. We, I think we used to buy it too. So yeah. And I actually. Oh yeah. Yeah, he's my friend. ",
            "time": "16:22:21",
            "speakerTurns": {
                "total": 33,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-6",
                        "length": 4
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "We, I think we used to buy it too. So yeah. And I actually.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh yeah.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Yeah, he's my friend.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And I need to have a chili boy with.",
                        "length": 9
                    },
                    {
                        "speakerId": "Guest-6",
                        "speakerSeg": "That's good, I mean.",
                        "length": 4
                    }
                ]
            },
            "id": "1213",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "13",
                    "12"
                ]
            },
            "childNodes": {
                "2": [],
                "3": []
            },
            "segments": "12 13"
        }
    ],
    "2": [
        {
            "topic": "COOKING MISHAP",
            "description": "I think try to bake like a chicken breast and then the the grease is just like watering everywhere.",
            "segment": "Do you favorite life? I think try to bake like a chicken breast and then the the grease is just like watering everywhere. You get it best. So yes, let's just say not the best. Of cooking. That's kind of weird. She. Just she didn't mean it, but like. And then she's like, why don't you cook this like? We're mad. OK, Mom. I'm trying to. ",
            "time": "16:18:46",
            "speakerTurns": {
                "total": 66,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 52
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 14
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "We're mad.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "OK, Mom.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "I'm trying to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "And then she's like, why don't you cook this like?",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "So yes, let's just say not the best.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Of cooking. That's kind of weird. She.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Just she didn't mean it, but like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Do you favorite life? I think try to bake like a chicken breast and then the the grease is just like watering everywhere. You get it best.",
                        "length": 27
                    }
                ]
            },
            "id": "0123",
            "depth": 2,
            "parentNodes": {
                "1": [
                    "23",
                    "01"
                ]
            },
            "childNodes": {
                "3": [
                    "01234567"
                ],
                "4": []
            },
            "segments": "0 1 2 3"
        },
        {
            "topic": "EGG CRAVINGS",
            "description": "I like eggs, and very specifically, but I don't like it, Yeah.",
            "segment": "Yeah, I started making them. I I can't eat it, but it's. I like eggs, and very specifically, but I don't like it, Yeah. Lately. ",
            "time": "16:20:55",
            "speakerTurns": {
                "total": 25,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 1
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 24
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Lately.",
                        "length": 1
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I like eggs, and very specifically, but I don't like it, Yeah.",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I I can't eat it, but it's.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Yeah, I started making them.",
                        "length": 5
                    }
                ]
            },
            "id": "4567",
            "depth": 2,
            "parentNodes": {
                "1": [
                    "67",
                    "45"
                ]
            },
            "childNodes": {
                "3": [
                    "01234567"
                ],
                "4": []
            },
            "segments": "4 5 6 7"
        },
        {
            "topic": "HOT SAUCE VARIETY",
            "description": "They have a million types of hot socks like this.",
            "segment": "It's like, it's like impressive how much snow it can give off. Yeah, Oh my goodness. Cedar of the sauce. Yeah. They have a million types of hot socks like this. This is better for them like this and Sasha better for this and then. Julius is better for this. Like I only saw the means. ",
            "time": "16:21:48",
            "speakerTurns": {
                "total": 56,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 16
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 40
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Julius is better for this.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Like I only saw the means.",
                        "length": 6
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "They have a million types of hot socks like this. This is better for them like this and Sasha better for this and then.",
                        "length": 24
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Cedar of the sauce.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Yeah.",
                        "length": 1
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "It's like, it's like impressive how much snow it can give off. Yeah, Oh my goodness.",
                        "length": 16
                    }
                ]
            },
            "id": "891011",
            "depth": 2,
            "parentNodes": {
                "1": [
                    "1011",
                    "89"
                ]
            },
            "childNodes": {
                "3": [],
                "4": []
            },
            "segments": "8 9 10 11"
        }
    ],
    "3": [
        {
            "topic": "COOKING EXPERIENCES",
            "description": "I think try to bake like a chicken breast and then the grease is just like watering everywhere.",
            "segment": "Do you favorite life? I think try to bake like a chicken breast and then the the grease is just like watering everywhere. You get it best. So yes, let's just say not the best. Of cooking. That's kind of weird. She. Just she didn't mean it, but like. And then she's like, why don't you cook this like? We're mad. OK, Mom. I'm trying to. Yeah, I started making them. I I can't eat it, but it's. I like eggs, and very specifically, but I don't like it, Yeah. Lately. ",
            "time": "16:20:55",
            "speakerTurns": {
                "total": 91,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 1
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 38
                    },
                    {
                        "speakerId": "Guest-1",
                        "length": 52
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Lately.",
                        "length": 1
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I like eggs, and very specifically, but I don't like it, Yeah.",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I I can't eat it, but it's.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Yeah, I started making them.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "We're mad.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "OK, Mom.",
                        "length": 2
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "I'm trying to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "And then she's like, why don't you cook this like?",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "So yes, let's just say not the best.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Of cooking. That's kind of weird. She.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Just she didn't mean it, but like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "Do you favorite life? I think try to bake like a chicken breast and then the the grease is just like watering everywhere. You get it best.",
                        "length": 27
                    }
                ]
            },
            "id": "01234567",
            "depth": 3,
            "parentNodes": {
                "2": [
                    "4567",
                    "0123"
                ]
            },
            "childNodes": {
                "4": [],
                "5": []
            },
            "segments": "0 1 2 3 4 5 6 7"
        }
    ]
    }
    return data;
  }
}
