// Hosted
import { OpenAI } from "/conversation-timelines/js/openaiController.js";

export class DataHandler {
  constructor() {
    // this.data = this.mockData();
    this.tree = this.mockData();
    // this.transcript = "";
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
    // this.addToTranscript(transcription[0]);
    return true;
  }

//   // Add a chunk to the transcript
//   addToTranscript(chunk) {
//     this.transcript.push(chunk);
//   }

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
        let node1, node2;
        console.log(this.tree)
        if (depth === 1) {
            node1 = this.tree[0][id - 1];
            node2 = this.tree[0][id];
        } else {
            [node1, node2] = this.getParentNodes(i, id);
        }

        console.log("Node 1\t", node1)
        console.log("Node 2\t", node2)
 
        // If both nodes exist
        if ((node1!=null)&&(node2!=null)) {
        // If node 1 does not already have a child at this depth
            if (Object.keys(node1.childNodes[depth]).length == 0) {
                let node = await this.summarizeNodes(node1, node2, depth);
                console.log("New node:\t", node)
                if (node != null) {
                    this.tree[depth].push(node);
                    // this.tree[0].push(this.createNode(null, null, transcription, time, speakerTurns, id, 0, null)) 
        
                }
            }
        }
    } 

    console.log("Tree:\t", this.tree)
  }

  getParentNodes(depth) {
    // Get the last node in the current depth
    let node1 = this.tree[depth].at(-1);

    let keys = Object.keys(node1.parentNodes);
    let parentNodeDepth = keys.at(-1);
    let parentNodeID = node1.parentNodes[parentNodeDepth].at(-1);

    keys = Object.keys(this.tree[parentNodeDepth]);
    let index;
    for (let i=0; i<keys.length; i++){
        if (this.tree[parentNodeDepth][keys[i]].id == parentNodeID) {
            index = i;
            break;
        }
    }
    let rightKey = keys[index + 1];
    let node2 = rightKey !== undefined ? this.tree[parentNodeDepth][rightKey] : undefined;

    return [node1, node2];
  }

  // Check if two nodes have similar topic. If so, merge into a child node.
  async summarizeNodes(node1, node2, depth) {

    let id, segments;
    [id, segments] = this.getUniqueID(node1.segments + " " + node2.segments);
    console.log(id)
    console.log(segments)
    // let transcript = node1.segment + node2.segment;
    let transcript = "";
    const numStrings = String(segments).split(' '); // Split by whitespace
    const numbers = numStrings.map(Number).filter(num => !isNaN(num));
    for (let i=0; i<numbers.length; i++) {
        transcript += this.tree[0][numbers[i]].segment;
    }
    
    // OpenAI call
    const result = await this.openAI.gptResult(transcript, "");
    console.log("OpenAI result:\t", result)
    if (result == null) {
        return null;
    }

    // Ensure the layer exists in the tree
    if (!this.tree[depth]) {
        this.tree[depth] = [];
    }

    // Create and return new node
    let parentNodes = (node1.depth==node2.depth) ?  {[node1.depth]: [node1.id, node2.id]} : {[node1.depth]: [node1.id], [node2.depth]: [node2.id]};
    let node = 
        this.createNode(result.topic.toUpperCase(), 
                        result.sentence, 
                        transcript, 
                        node1.time,
                        this.mergeSpeakerTurns(node1.speakerTurns, node2.speakerTurns),
                        id,
                        depth,
                        parentNodes,
                        segments
                        )

    // Push child node to parent node children
    node1.childNodes[depth].push(node.id)
    node2.childNodes[depth].push(node.id)
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
          "childNodes": {[depth+1]: [], [depth+2]: []},
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
            "segment": "It's going to. Shanti Kumar, are there any? ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 8,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 5
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
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
            "segment": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. ",
            "time": "12:52:29",
            "speakerTurns": {
                "total": 31,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 31
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
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
            "segment": "Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. ",
            "time": "12:52:40",
            "speakerTurns": {
                "total": 19,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 19
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
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
                "2": [
                    "012"
                ]
            },
            "segments": "2"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. ",
            "time": "12:52:51",
            "speakerTurns": {
                "total": 28,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 28
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
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
            "segment": "It it was like, like I give you that much or a hot dog. But not Yeah, I. ",
            "time": "12:53:02",
            "speakerTurns": {
                "total": 18,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 18
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
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
                "2": [
                    "234"
                ]
            },
            "segments": "4"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. ",
            "time": "12:53:13",
            "speakerTurns": {
                "total": 17,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 17
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
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
            "segment": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. ",
            "time": "12:53:24",
            "speakerTurns": {
                "total": 30,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 30
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
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
                "2": [
                    "456"
                ]
            },
            "segments": "6"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. ",
            "time": "12:53:34",
            "speakerTurns": {
                "total": 24,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 24
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
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
            "segment": "I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. ",
            "time": "12:53:45",
            "speakerTurns": {
                "total": 28,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 28
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
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
                "2": [
                    "678"
                ]
            },
            "segments": "8"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? ",
            "time": "12:53:55",
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
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
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
            "segment": "There's no scorpions here. Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back. ",
            "time": "12:54:06",
            "speakerTurns": {
                "total": 25,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 25
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "There's no scorpions here.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back.",
                        "length": 21
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
                "2": [
                    "8910"
                ]
            },
            "segments": "10"
        },
        {
            "topic": null,
            "description": null,
            "segment": "Like Lollipop for us. Him and my brother ate it. Like those, have you seen those? Like cricket like. ",
            "time": "12:54:17",
            "speakerTurns": {
                "total": 19,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 19
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Like Lollipop for us.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Him and my brother ate it.",
                        "length": 6
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Like those, have you seen those? Like cricket like.",
                        "length": 9
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
            "segment": "Yeah, I've never tried. Yeah, I refuse. Yeah, me too. ",
            "time": "12:54:27",
            "speakerTurns": {
                "total": 10,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 10
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Yeah, I've never tried.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Yeah, I refuse.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Yeah, me too.",
                        "length": 3
                    }
                ]
            },
            "id": "12",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [],
                "2": [
                    "101112"
                ]
            },
            "segments": "12"
        },
        {
            "topic": null,
            "description": null,
            "segment": "I'm like, always curious people. Always. Say it actually doesn't taste that bad. But like, I'm not, I don't really like books in the 1st place. No, that's actually like, you know. ",
            "time": "12:54:38",
            "speakerTurns": {
                "total": 32,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 6
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 26
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm like, always curious people. Always.",
                        "length": 6
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Say it actually doesn't taste that bad.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But like, I'm not, I don't really like books in the 1st place. No, that's actually like, you know.",
                        "length": 19
                    }
                ]
            },
            "id": "13",
            "depth": 0,
            "parentNodes": null,
            "childNodes": {
                "1": [],
                "2": []
            },
            "segments": "13"
        }
    ],
    "1": [
        {
            "topic": "TRYING NEW FOODS",
            "description": "Are you gonna try the cheeseburger?",
            "segment": "It's going to. Shanti Kumar, are there any? Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 39,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 36
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
                    }
                ]
            },
            "id": "01",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "0",
                    "1"
                ]
            },
            "childNodes": {
                "2": [
                    "012"
                ],
                "3": []
            },
            "segments": "0 1"
        },
        {
            "topic": "FOOD SCIENCE",
            "description": "There's a lot of food science they gotta like.",
            "segment": "Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. ",
            "time": "12:52:40",
            "speakerTurns": {
                "total": 47,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 47
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    }
                ]
            },
            "id": "23",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "2",
                    "3"
                ]
            },
            "childNodes": {
                "2": [
                    "234"
                ],
                "3": [
                    "0123"
                ]
            },
            "segments": "2 3"
        },
        {
            "topic": "MEAT-FLAVORED ICE CREAM",
            "description": "Cheeseburger ice cream, apparently it tastes like meat.",
            "segment": "It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. ",
            "time": "12:53:02",
            "speakerTurns": {
                "total": 35,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 35
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    }
                ]
            },
            "id": "45",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "4",
                    "5"
                ]
            },
            "childNodes": {
                "2": [
                    "456"
                ],
                "3": [
                    "2345"
                ]
            },
            "segments": "4 5"
        },
        {
            "topic": "FOOD PREFERENCES",
            "description": "They do not belong together.",
            "segment": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. ",
            "time": "12:53:24",
            "speakerTurns": {
                "total": 54,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 54
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    }
                ]
            },
            "id": "67",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "6",
                    "7"
                ]
            },
            "childNodes": {
                "2": [
                    "678"
                ],
                "3": [
                    "4567"
                ]
            },
            "segments": "6 7"
        },
        {
            "topic": "UNUSUAL FOODS",
            "description": "Remember the scorpion pizza?",
            "segment": "I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? ",
            "time": "12:53:45",
            "speakerTurns": {
                "total": 44,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 28
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 16
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    }
                ]
            },
            "id": "89",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "8",
                    "9"
                ]
            },
            "childNodes": {
                "2": [
                    "8910"
                ],
                "3": [
                    "6789"
                ]
            },
            "segments": "8 9"
        },
        {
            "topic": "SCORPIONS IN TEXAS",
            "description": "One time when my dad works in Texas, he brought back.",
            "segment": "There's no scorpions here. Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back. Like Lollipop for us. Him and my brother ate it. Like those, have you seen those? Like cricket like. ",
            "time": "12:54:06",
            "speakerTurns": {
                "total": 44,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 44
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "There's no scorpions here.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Like Lollipop for us.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Him and my brother ate it.",
                        "length": 6
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Like those, have you seen those? Like cricket like.",
                        "length": 9
                    }
                ]
            },
            "id": "1011",
            "depth": 1,
            "parentNodes": {
                "0": [
                    "10",
                    "11"
                ]
            },
            "childNodes": {
                "2": [
                    "101112"
                ],
                "3": [
                    "891011"
                ]
            },
            "segments": "10 11"
        }
    ],
    "2": [
        {
            "topic": "TRYING NEW FOODS",
            "description": "Are you gonna try the cheeseburger?",
            "segment": "It's going to. Shanti Kumar, are there any? Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 58,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 55
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    }
                ]
            },
            "id": "012",
            "depth": 2,
            "parentNodes": {
                "0": [
                    "2"
                ],
                "1": [
                    "01"
                ]
            },
            "childNodes": {
                "3": [
                    "0123"
                ],
                "4": []
            },
            "segments": "0 1 2"
        },
        {
            "topic": "FOOD SCIENCE",
            "description": "There's a lot of food science they gotta like.",
            "segment": "Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. ",
            "time": "12:52:40",
            "speakerTurns": {
                "total": 65,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 65
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    }
                ]
            },
            "id": "234",
            "depth": 2,
            "parentNodes": {
                "0": [
                    "4"
                ],
                "1": [
                    "23"
                ]
            },
            "childNodes": {
                "3": [
                    "2345"
                ],
                "4": [
                    "01234"
                ]
            },
            "segments": "3 4 5"
        },
        {
            "topic": "FOOD PREFERENCES",
            "description": "Apparently it tastes like meat.",
            "segment": "It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. ",
            "time": "12:53:02",
            "speakerTurns": {
                "total": 65,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 65
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    }
                ]
            },
            "id": "456",
            "depth": 2,
            "parentNodes": {
                "0": [
                    "6"
                ],
                "1": [
                    "45"
                ]
            },
            "childNodes": {
                "3": [
                    "4567"
                ],
                "4": [
                    "23456"
                ]
            },
            "segments": "6 7 8"
        },
        {
            "topic": "UNUSUAL FOOD COMBINATIONS",
            "description": "I like onion rings, I like cheese powders. They do not belong together with ice cream.",
            "segment": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. ",
            "time": "12:53:24",
            "speakerTurns": {
                "total": 82,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 82
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    }
                ]
            },
            "id": "678",
            "depth": 2,
            "parentNodes": {
                "0": [
                    "8"
                ],
                "1": [
                    "67"
                ]
            },
            "childNodes": {
                "3": [
                    "6789"
                ],
                "4": [
                    "45678"
                ]
            },
            "segments": "9 10 11"
        },
        {
            "topic": "UNUSUAL FOODS",
            "description": "Remember the scorpion pizza?",
            "segment": "I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? There's no scorpions here. Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back. ",
            "time": "12:53:45",
            "speakerTurns": {
                "total": 69,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 28
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 41
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "There's no scorpions here.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back.",
                        "length": 21
                    }
                ]
            },
            "id": "8910",
            "depth": 2,
            "parentNodes": {
                "0": [
                    "10"
                ],
                "1": [
                    "89"
                ]
            },
            "childNodes": {
                "3": [
                    "891011"
                ],
                "4": [
                    "678910"
                ]
            },
            "segments": "10 11 12"
        },
        {
            "topic": "EATING INSECTS",
            "description": "Him and my brother ate it.",
            "segment": "There's no scorpions here. Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back. Like Lollipop for us. Him and my brother ate it. Like those, have you seen those? Like cricket like. Yeah, I've never tried. Yeah, I refuse. Yeah, me too. ",
            "time": "12:54:06",
            "speakerTurns": {
                "total": 54,
                "speakers": [
                    {
                        "speakerId": "Guest-3",
                        "length": 54
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "There's no scorpions here.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Like Lollipop for us.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Him and my brother ate it.",
                        "length": 6
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Like those, have you seen those? Like cricket like.",
                        "length": 9
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Yeah, I've never tried.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Yeah, I refuse.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Yeah, me too.",
                        "length": 3
                    }
                ]
            },
            "id": "101112",
            "depth": 2,
            "parentNodes": {
                "0": [
                    "12"
                ],
                "1": [
                    "1011"
                ]
            },
            "childNodes": {
                "3": [],
                "4": []
            },
            "segments": "10 11 12"
        }
    ],
    "3": [
        {
            "topic": "TRYING A NEW CHEESEBURGER",
            "description": "Are you gonna try the cheeseburger?",
            "segment": "It's going to. Shanti Kumar, are there any? Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 105,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 102
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    }
                ]
            },
            "id": "0123",
            "depth": 3,
            "parentNodes": {
                "1": [
                    "23"
                ],
                "2": [
                    "012"
                ]
            },
            "childNodes": {
                "4": [
                    "01234"
                ],
                "5": []
            },
            "segments": "0 1 2 3"
        },
        {
            "topic": "FOOD SCIENCE",
            "description": "Cheeseburger ice cream.",
            "segment": "Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. ",
            "time": "12:52:40",
            "speakerTurns": {
                "total": 100,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 100
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    }
                ]
            },
            "id": "2345",
            "depth": 3,
            "parentNodes": {
                "1": [
                    "45"
                ],
                "2": [
                    "234"
                ]
            },
            "childNodes": {
                "4": [
                    "23456"
                ],
                "5": [
                    "012345"
                ]
            },
            "segments": "2 3 4 5"
        },
        {
            "topic": "ICE CREAM CHEESEBURGER",
            "description": "Cheeseburger ice cream.",
            "segment": "It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. ",
            "time": "12:53:02",
            "speakerTurns": {
                "total": 119,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 119
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    }
                ]
            },
            "id": "4567",
            "depth": 3,
            "parentNodes": {
                "1": [
                    "67"
                ],
                "2": [
                    "456"
                ]
            },
            "childNodes": {
                "4": [
                    "45678"
                ],
                "5": [
                    "234567"
                ]
            },
            "segments": "4 5 6 7"
        },
        {
            "topic": "FOOD COMBINATIONS",
            "description": "They do not belong together.",
            "segment": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? ",
            "time": "12:53:24",
            "speakerTurns": {
                "total": 126,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 110
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 16
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    }
                ]
            },
            "id": "6789",
            "depth": 3,
            "parentNodes": {
                "1": [
                    "89"
                ],
                "2": [
                    "678"
                ]
            },
            "childNodes": {
                "4": [
                    "678910"
                ],
                "5": [
                    "456789"
                ]
            },
            "segments": "6 7 8 9"
        },
        {
            "topic": "EXOTIC FOODS",
            "description": "Remember the scorpion pizza?",
            "segment": "I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? There's no scorpions here. Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back. Like Lollipop for us. Him and my brother ate it. Like those, have you seen those? Like cricket like. ",
            "time": "12:53:45",
            "speakerTurns": {
                "total": 113,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 28
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 85
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "There's no scorpions here.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "There's no scorpions here.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Like Lollipop for us.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Him and my brother ate it.",
                        "length": 6
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Like those, have you seen those? Like cricket like.",
                        "length": 9
                    }
                ]
            },
            "id": "891011",
            "depth": 3,
            "parentNodes": {
                "1": [
                    "1011"
                ],
                "2": [
                    "8910"
                ]
            },
            "childNodes": {
                "4": [],
                "5": []
            },
            "segments": "8 9 10 11"
        }
    ],
    "4": [
        {
            "topic": "PREMIUM FOOD SCIENCE",
            "description": "I think it's like Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
            "segment": "It's going to. Shanti Kumar, are there any? Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 170,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 167
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    }
                ]
            },
            "id": "01234",
            "depth": 4,
            "parentNodes": {
                "2": [
                    "234"
                ],
                "3": [
                    "0123"
                ]
            },
            "childNodes": {
                "5": [
                    "012345"
                ],
                "6": []
            },
            "segments": "0 1 2 3 4"
        },
        {
            "topic": "UNIQUE FOOD FLAVORS",
            "description": "Cheeseburger ice cream, apparently it tastes like meat.",
            "segment": "Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. ",
            "time": "12:52:40",
            "speakerTurns": {
                "total": 165,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 165
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    }
                ]
            },
            "id": "23456",
            "depth": 4,
            "parentNodes": {
                "2": [
                    "456"
                ],
                "3": [
                    "2345"
                ]
            },
            "childNodes": {
                "5": [
                    "234567"
                ],
                "6": [
                    "0123456"
                ]
            },
            "segments": "2 3 4 5 6"
        },
        {
            "topic": "ICE CREAM BURGER",
            "description": "I think the ice cream part makes it a sin.",
            "segment": "It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. ",
            "time": "12:53:02",
            "speakerTurns": {
                "total": 201,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 201
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    }
                ]
            },
            "id": "45678",
            "depth": 4,
            "parentNodes": {
                "2": [
                    "678"
                ],
                "3": [
                    "4567"
                ]
            },
            "childNodes": {
                "5": [
                    "456789"
                ],
                "6": [
                    "2345678"
                ]
            },
            "segments": "4 5 6 7 8"
        },
        {
            "topic": "UNUSUAL FOOD COMBINATIONS",
            "description": "They do not belong together.",
            "segment": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? There's no scorpions here. Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back. ",
            "time": "12:53:24",
            "speakerTurns": {
                "total": 195,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 138
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 57
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "There's no scorpions here.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back.",
                        "length": 21
                    }
                ]
            },
            "id": "678910",
            "depth": 4,
            "parentNodes": {
                "2": [
                    "8910"
                ],
                "3": [
                    "6789"
                ]
            },
            "childNodes": {
                "5": [],
                "6": [
                    "45678910"
                ]
            },
            "segments": "6 7 8 9 10"
        }
    ],
    "5": [
        {
            "topic": "TRYING NEW FOODS",
            "description": "Are you gonna try the cheeseburger?",
            "segment": "It's going to. Shanti Kumar, are there any? Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 270,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 267
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    }
                ]
            },
            "id": "012345",
            "depth": 5,
            "parentNodes": {
                "3": [
                    "2345"
                ],
                "4": [
                    "01234"
                ]
            },
            "childNodes": {
                "6": [
                    "0123456"
                ],
                "7": []
            },
            "segments": "0 1 2 3 4 5"
        },
        {
            "topic": "UNUSUAL FOOD FLAVORS",
            "description": "Cheeseburger ice cream apparently tastes like meat.",
            "segment": "Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. ",
            "time": "12:52:40",
            "speakerTurns": {
                "total": 284,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 284
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    }
                ]
            },
            "id": "234567",
            "depth": 5,
            "parentNodes": {
                "3": [
                    "4567"
                ],
                "4": [
                    "23456"
                ]
            },
            "childNodes": {
                "6": [
                    "2345678"
                ],
                "7": [
                    "01234567"
                ]
            },
            "segments": "2 3 4 5 6 7"
        },
        {
            "topic": "UNUSUAL FOOD COMBINATIONS",
            "description": "Cheeseburger ice cream apparently it tastes like meat.",
            "segment": "It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? ",
            "time": "12:53:02",
            "speakerTurns": {
                "total": 327,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 311
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 16
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    }
                ]
            },
            "id": "456789",
            "depth": 5,
            "parentNodes": {
                "3": [
                    "6789"
                ],
                "4": [
                    "45678"
                ]
            },
            "childNodes": {
                "6": [
                    "45678910"
                ],
                "7": [
                    "23456789"
                ]
            },
            "segments": "4 5 6 7 8 9"
        }
    ],
    "6": [
        {
            "topic": "TRYING CHEESEBURGER ICE CREAM",
            "description": "Cheeseburger ice cream apparently it tastes like meat.",
            "segment": "It's going to. Shanti Kumar, are there any? Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 435,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 432
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    }
                ]
            },
            "id": "0123456",
            "depth": 6,
            "parentNodes": {
                "4": [
                    "23456"
                ],
                "5": [
                    "012345"
                ]
            },
            "childNodes": {
                "7": [
                    "01234567"
                ],
                "8": []
            },
            "segments": "0 1 2 3 4 5 6"
        },
        {
            "topic": "UNUSUAL FOOD COMBINATIONS",
            "description": "Apparently it tastes like meat.",
            "segment": "Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. ",
            "time": "12:52:40",
            "speakerTurns": {
                "total": 485,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 485
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    }
                ]
            },
            "id": "2345678",
            "depth": 6,
            "parentNodes": {
                "4": [
                    "45678"
                ],
                "5": [
                    "234567"
                ]
            },
            "childNodes": {
                "7": [
                    "23456789"
                ],
                "8": [
                    "012345678"
                ]
            },
            "segments": "2 3 4 5 6 7 8"
        },
        {
            "topic": "UNUSUAL FOOD COMBINATIONS",
            "description": "They do not belong together.",
            "segment": "It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? There's no scorpions here. Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back. ",
            "time": "12:53:02",
            "speakerTurns": {
                "total": 522,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 449
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 73
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "There's no scorpions here.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back.",
                        "length": 21
                    }
                ]
            },
            "id": "45678910",
            "depth": 6,
            "parentNodes": {
                "4": [
                    "678910"
                ],
                "5": [
                    "456789"
                ]
            },
            "childNodes": {
                "7": [],
                "8": [
                    "2345678910"
                ]
            },
            "segments": "4 5 6 7 8 9 10"
        }
    ],
    "7": [
        {
            "topic": "CHEESEBURGER ICE CREAM",
            "description": "Cheeseburger ice cream apparently it tastes like meat it makes me sound comfortable.",
            "segment": "It's going to. Shanti Kumar, are there any? Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 719,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 716
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    }
                ]
            },
            "id": "01234567",
            "depth": 7,
            "parentNodes": {
                "5": [
                    "234567"
                ],
                "6": [
                    "0123456"
                ]
            },
            "childNodes": {
                "8": [
                    "012345678"
                ],
                "9": []
            },
            "segments": "0 1 2 3 4 5 6 7"
        },
        {
            "topic": "UNUSUAL ICE CREAM FLAVORS",
            "description": "Apparently it tastes like meat.",
            "segment": "Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? ",
            "time": "12:52:40",
            "speakerTurns": {
                "total": 812,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 796
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 16
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    }
                ]
            },
            "id": "23456789",
            "depth": 7,
            "parentNodes": {
                "5": [
                    "456789"
                ],
                "6": [
                    "2345678"
                ]
            },
            "childNodes": {
                "8": [
                    "2345678910"
                ],
                "9": [
                    "0123456789"
                ]
            },
            "segments": "2 3 4 5 6 7 8 9"
        }
    ],
    "8": [
        {
            "topic": "CHEESEBURGER ICE CREAM",
            "description": "Cheeseburger ice cream, apparently it tastes like meat.",
            "segment": "It's going to. Shanti Kumar, are there any? Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 1204,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 1201
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    }
                ]
            },
            "id": "012345678",
            "depth": 8,
            "parentNodes": {
                "6": [
                    "2345678"
                ],
                "7": [
                    "01234567"
                ]
            },
            "childNodes": {
                "9": [
                    "0123456789"
                ],
                "10": []
            },
            "segments": "0 1 2 3 4 5 6 7 8"
        },
        {
            "topic": "UNUSUAL FOOD COMBINATIONS",
            "description": "They do not belong together.",
            "segment": "Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? There's no scorpions here. Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back. ",
            "time": "12:52:40",
            "speakerTurns": {
                "total": 1334,
                "speakers": [
                    {
                        "speakerId": "Guest-2",
                        "length": 1245
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 89
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "There's no scorpions here.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Oh my gosh, I don't want to think about it. One time when my dad works in Texas, he brought back.",
                        "length": 21
                    }
                ]
            },
            "id": "2345678910",
            "depth": 8,
            "parentNodes": {
                "6": [
                    "45678910"
                ],
                "7": [
                    "23456789"
                ]
            },
            "childNodes": {
                "9": [],
                "10": []
            },
            "segments": "2 3 4 5 6 7 8 9 10"
        }
    ],
    "9": [
        {
            "topic": "CHEESEBURGER ICE CREAM",
            "description": "Apparently it tastes like meat.",
            "segment": "It's going to. Shanti Kumar, are there any? Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger? I'm a little scared. Share dollars, right? Yeah, like $15 like OK. I mean, it's called premium. It's like. I think it's like. Marvel Science where, I don't know, they have, there's a lot of food science they gotta like. Extra creamy. I don't know the science. I don't know scientists. It it was like, like I give you that much or a hot dog. But not Yeah, I. Cheeseburger ice cream. Apparently it tastes like meat. Makes me sound comfortable. And like it's got like. I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like. Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not. Ice cream No. I think the ice cream part makes it a sin. I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know. Remember the scorpion pizza? I'm making someone uncomfortable. That's actually gross. How to get so many? ",
            "time": "12:52:18",
            "speakerTurns": {
                "total": 2016,
                "speakers": [
                    {
                        "speakerId": "Guest-1",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "length": 1997
                    },
                    {
                        "speakerId": "Guest-3",
                        "length": 16
                    }
                ],
                "turns": [
                    {
                        "speakerId": "Guest-1",
                        "speakerSeg": "It's going to.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Shanti Kumar, are there any?",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Are you gonna check the foods or are you just gonna? I'm gonna try some of them, but I don't know. Are you gonna try the cheeseburger?",
                        "length": 27
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm a little scared.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Share dollars, right? Yeah, like $15 like OK.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, it's called premium. It's like.",
                        "length": 7
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think it's like.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Marvel Science where, I don't know, they have, there's a lot of food science they gotta like.",
                        "length": 17
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Extra creamy. I don't know the science. I don't know scientists.",
                        "length": 11
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "It it was like, like I give you that much or a hot dog.",
                        "length": 14
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "But not Yeah, I.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Cheeseburger ice cream. Apparently it tastes like meat.",
                        "length": 8
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Makes me sound comfortable.",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "And like it's got like.",
                        "length": 5
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I'm at home and like an onion ring and a pickle cheese powder is already like, I like all of those things individually. OK, I like onion rings. I like.",
                        "length": 30
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Is cheese powders fine? I like ice cream. I like. They do not. They burgers. They do not belong together. Not.",
                        "length": 21
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "Ice cream No.",
                        "length": 3
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I think the ice cream part makes it a sin.",
                        "length": 10
                    },
                    {
                        "speakerId": "Guest-2",
                        "speakerSeg": "I mean, like, even though the alligator sounds funny, I I saw, I don't know, I don't know.",
                        "length": 18
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "Remember the scorpion pizza?",
                        "length": 4
                    },
                    {
                        "speakerId": "Guest-3",
                        "speakerSeg": "I'm making someone uncomfortable. That's actually gross. How to get so many?",
                        "length": 12
                    }
                ]
            },
            "id": "0123456789",
            "depth": 9,
            "parentNodes": {
                "7": [
                    "23456789"
                ],
                "8": [
                    "012345678"
                ]
            },
            "childNodes": {
                "10": [],
                "11": []
            },
            "segments": "0 1 2 3 4 5 6 7 8 9"
        }
      ]
    }
    return data;
  }
  

  mockData2() {
    let data = {
      s10: [
        {
          topic: "READINESS FOR CHANGE",
          description: "I was not ready when she was ready.",
          segment:
            "It's hard 💪 to mentally prepare. I was not ready when she was ready. Oh my gosh 😱.",
          time: "00:59:36",
          speakerTurns: {
            total: 16,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 16,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "It's hard 💪 to mentally prepare. I was not ready when she was ready. Oh my gosh 😱.",
                length: 16,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-0",
        },
        {
          topic: "SKYDIVING PROPOSAL",
          description:
            "Yeah, she was like, let's go skydiving, like right now.",
          segment: "Yeah, she was like, let's go skydiving ✈️, like right now.",
          time: "00:59:46",
          speakerTurns: {
            total: 10,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 10,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Yeah, she was like, let's go skydiving ✈️, like right now.",
                length: 10,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-1",
        },
        {
          topic: "TRAVEL PLANS",
          description: "I thought that would be more time in between.",
          segment:
            "I've never even thought 🤔 about this before. What do you mean? Yeah, I thought she was like joking 😄 at first, or like by how soon she wanted to go, but then. Pictures of her. And I was like, Oh yeah, OK 👌, yeah, I thought. I thought that would be more time ⏰ in between.",
          time: "00:59:57",
          speakerTurns: {
            total: 53,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 53,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "I've never even thought 🤔 about this before. What do you mean? Yeah, I thought she was like joking 😄 at first, or like by how soon she wanted to go, but then.",
                length: 31,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Pictures of her. And I was like, Oh yeah, OK 👌, yeah, I thought. I thought that would be more time ⏰ in between.",
                length: 22,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-2",
        },
        {
          topic: "PERSONALITY DESCRIPTION",
          description: "Yeah, like she's, she's very much like.",
          segment: "Yeah, like she's, she's very much like 💯.",
          time: "01:00:08",
          speakerTurns: {
            total: 7,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 7,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg: "Yeah, like she's, she's very much like 💯.",
                length: 7,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 1,
          id: "s10-3",
        },
        {
          topic: "DECISION MAKING",
          description: "She just went into this, which is crazy.",
          segment:
            "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
          time: "01:00:19",
          speakerTurns: {
            total: 38,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 38,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
                length: 38,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 1,
          id: "s10-4",
        },
        {
          topic: "ADRENALINE ACTIVITY INTEREST",
          description: "Like he really likes it.",
          segment:
            "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
          time: "01:00:30",
          speakerTurns: {
            total: 28,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 28,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
                length: 28,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 1,
          id: "s10-5",
        },
        {
          topic: "READINESS FOR CHANGE",
          description: "I was not ready when she was ready.",
          segment:
            "It's hard 💪 to mentally prepare. I was not ready when she was ready. Oh my gosh 😱.",
          time: "00:59:36",
          speakerTurns: {
            total: 16,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 16,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "It's hard 💪 to mentally prepare. I was not ready when she was ready. Oh my gosh 😱.",
                length: 16,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-0",
        },
        {
          topic: "SKYDIVING PROPOSAL",
          description:
            "Yeah, she was like, let's go skydiving, like right now.",
          segment: "Yeah, she was like, let's go skydiving ✈️, like right now.",
          time: "00:59:46",
          speakerTurns: {
            total: 10,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 10,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Yeah, she was like, let's go skydiving ✈️, like right now.",
                length: 10,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-1",
        },
        {
          topic: "TRAVEL PLANS",
          description: "I thought that would be more time in between.",
          segment:
            "I've never even thought 🤔 about this before. What do you mean? Yeah, I thought she was like joking 😄 at first, or like by how soon she wanted to go, but then. Pictures of her. And I was like, Oh yeah, OK 👌, yeah, I thought. I thought that would be more time ⏰ in between.",
          time: "00:59:57",
          speakerTurns: {
            total: 53,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 53,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "I've never even thought 🤔 about this before. What do you mean? Yeah, I thought she was like joking 😄 at first, or like by how soon she wanted to go, but then.",
                length: 31,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Pictures of her. And I was like, Oh yeah, OK 👌, yeah, I thought. I thought that would be more time ⏰ in between.",
                length: 22,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-2",
        },
        {
          topic: "PERSONALITY DESCRIPTION",
          description: "Yeah, like she's, she's very much like.",
          segment: "Yeah, like she's, she's very much like 💯.",
          time: "01:00:08",
          speakerTurns: {
            total: 7,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 7,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg: "Yeah, like she's, she's very much like 💯.",
                length: 7,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 1,
          id: "s10-3",
        },
        {
          topic: "DECISION MAKING",
          description: "She just went into this, which is crazy.",
          segment:
            "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
          time: "01:00:19",
          speakerTurns: {
            total: 38,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 38,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
                length: 38,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 1,
          id: "s10-4",
        },
        {
          topic: "ADRENALINE ACTIVITY INTEREST",
          description: "Like he really likes it.",
          segment:
            "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
          time: "01:00:30",
          speakerTurns: {
            total: 28,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 28,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
                length: 28,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 1,
          id: "s10-5",
        },
      ]
    };
    return data;
  }
}