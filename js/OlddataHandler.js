// // Hosted
// import { OpenAI } from "/conversation-timelines/js/openaiController.js";

// export class DataHandler {
//   constructor() {
//     this.data = this.mockData2();
//     this.transcript = this.mockTranscript();
//     this.openAI = new OpenAI();
//     this.lastPostTurn = "";
//     this.minSegWithLastTurn = "";
//   }

//   // Initialize data structure
//   initData() {
//     return {
//       s10: [],
//       s30: [],
//       m1: [],
//       m5: [],
//       topics: [],
//     };
//   }

//   // Update data and transcript with new transcription
//   async update(transcription, speakerTurns, data) {
//     await this.addToData(transcription, speakerTurns, data);
//     this.addToTranscript(transcription[0]);
//     console.log(this.data)
//     return true;
//   }

//   // Get data for a specific level
//   getData(level = "s10") {
//     return this.data[level] || [];
//   }

//   // Get the transcript
//   getTranscript() {
//     return this.transcript;
//   }

//   // Add a chunk to the transcript
//   addToTranscript(chunk) {
//     this.transcript.push(chunk);
//   }

//   // Add new data to the appropriate levels
//   async addToData(transcription, speakerTurns, data) {
//     const lastTopic =
//       this.data.s10.length > 0 ? this.data.s10.at(-1).topic : "";
//     const topic = await this.createTimedTopicObject(
//       transcription,
//       "s10",
//       lastTopic,
//       speakerTurns
//     );
//     console.log('updated')
    
//     if (topic.topic) {
//       this.data.s10.push(topic);
//       const currData = structuredClone(this.data);

//       // Update s30 level
//       if (currData.s10.length % 3 === 0) {
//         const s30Topic = await this.mergeTopics(
//           currData,
//           3,
//           "s30",
//           this.data.s30.at(-1)?.topic || "",
//           speakerTurns
//         );
//         this.data.s30.push(s30Topic);
//       }

//       // Update m1 level
//       if (currData.s10.length % 6 === 0) {
//         const m1Topic = await this.mergeTopics(
//           currData,
//           6,
//           "m1",
//           this.data.m1.at(-1)?.topic || "",
//           speakerTurns
//         );
//         this.data.m1.push(m1Topic);

//         // Update topics level
//         console.log(m1Topic)
//         const newTopic =
//           this.data.topics.length === 0
//             ? await this.createTopicObjectFromM1(m1Topic)
//             : await this.createTopicObject(m1Topic);
//         console.log(newTopic)
//         if (newTopic) this.data.topics.push(newTopic);
//       }

//       // Update m5 level
//       if (currData.s10.length % 30 === 0) {
//         const m5Topic = await this.mergeTopics(
//           currData,
//           30,
//           "m5",
//           this.data.m5.at(-1)?.topic || "",
//           speakerTurns
//         );
//         this.data.m5.push(m5Topic);
//       }
//     }
//     return true;
//   }

//   mergeSpeakerTurns(n) {
//     let speakerTurns = this.data.s10.slice(-n).map((item) => item.speakerTurns);
//     console.log(speakerTurns);

//     let combinedTotal = 0;
//     // use an object to accumulate speaker lengths by speakerId
//     const combinedSpeakers = {};
//     const combinedTurns = [];

//     speakerTurns.forEach((segment) => {
//       console.log(segment);
//       combinedTotal += segment.total;
//       console.log(combinedTotal);
//       // process speakers
//       segment.speakers.forEach((sp) => {
//         if (combinedSpeakers[sp.speakerId] === undefined) {
//           combinedSpeakers[sp.speakerId] = sp.length;
//         } else {
//           combinedSpeakers[sp.speakerId] += sp.length;
//         }
//       });

//       // add turns (order is preserved by concatenation)
//       combinedTurns.push(...segment.turns);
//       console.log(combinedTurns);
//     });

//     // Convert combinedSpeakers object to an array
//     const speakersArray = Object.keys(combinedSpeakers).map((speakerId) => {
//       return { speakerId, length: combinedSpeakers[speakerId] };
//     });

//     console.log(speakersArray);

//     return {
//       total: combinedTotal,
//       speakers: speakersArray,
//       turns: combinedTurns,
//     };
//   }

//   // Merge topics for a given level
//   async mergeTopics(currData, n, level, lastTopic) {
//     console.log("Merging topics");
//     const zoomInIndex = currData.s10.length - 1;
//     const newSegment = currData.s10
//       .slice(-n)
//       .map((segment) => segment.segment)
//       .join(" ");
//     const time = currData.s10.at(-n).time;
//     let mergedSpeakerTurns = this.mergeSpeakerTurns(n);
//     console.log(mergedSpeakerTurns);
//     return await this.createTimedTopicObject(
//       [newSegment, time],
//       level,
//       lastTopic,
//       mergedSpeakerTurns
//     );
//   }

//   // Create a timed topic object
//   async createTimedTopicObject(chunk, level, lastTopic, speakerTurns) {
//     const result = await this.openAI.gptResult(chunk[0], lastTopic);
//     return {
//       topic: result.topic.toUpperCase(),
//       description: result.sentence,
//       segment: result.segment,
//       time: chunk[1],
//       speakerTurns: speakerTurns,
//       topicIndex: this.getData("topics").length,
//       zoomInIndex: this.getZoomLevel(level, "in"),
//       zoomOutIndex: this.getZoomLevel(level, "out"),
//       id: `${level}-${this.getData(level).length}`,
//     };
//   }

//   // Create a topic object from m1 data
//   async createTopicObjectFromM1(m1Topic) {
//     const subTopics = await this.openAI.getSubtopics(m1Topic.segment);
//     console.log(subTopics)
//     return {
//       topic: m1Topic.topic,
//       description: subTopics,
//       segment: m1Topic.segment,
//       time: m1Topic.time,
//       speakerTurns: m1Topic.speakerTurns,
//       totalSeconds: 60,
//       zoomInIndex: this.getZoomLevel("topics", "in"),
//       zoomOutIndex: this.getZoomLevel("topics", "out"),
//       id: `topics-${this.getData("topics").length}`,
//     };
//   }

//   combineSpeakerTurns(chunk, turnSentence = "", topicType = "new") {
//     let fullTurnsList = this.data.topics
//       .at(-1)
//       .speakerTurns.turns.concat(chunk.speakerTurns.turns);
//     if (topicType != "new") {
//       console.log(this.data.topics.at(-1).speakerTurns);
//       this.data.topics.at(-1).speakerTurns.turns = fullTurnsList;
//       this.data.topics.at(-1).speakerTurns.total += chunk.speakerTurns.total;
//       const result = {};

//       //Split turns for new topic
//     } else {
//       console.log(this.data.topics.at(-1).speakerTurns);
//       console.log(chunk.speakerTurns);

//       let newSpeakerTurns = {};
//       for (let i = 0; i < fullTurnsList.length; i++) {
//         let turn = fullTurnsList[i].speakerSeg;
//         console.log(turn);
//       }

//       // Look for the speaker turn containing the turn sentence
//       for (let i = 0; i < fullTurnsList.length; i++) {
//         let turn = fullTurnsList[i].speakerSeg;
//         console.log(i, turn);
//         console.log(turnSentence);

//         if (turnSentence.includes(turn) || turn.includes(turnSentence)) {
//           this.data.topics.at(-1).speakerTurns.turns = fullTurnsList.slice(
//             0,
//             i
//           );
//           newSpeakerTurns.turns = fullTurnsList.slice(i, fullTurnsList.length);
//           break;
//         }
//       }

//       let total = 0;
//       for (let i = 0; i < newSpeakerTurns.turns.length; i++) {
//         let length = newSpeakerTurns.turns[i].length;
//         console.log(length);
//         total += length;
//         console.log(total);
//       }
//       newSpeakerTurns.total = total;

//       total = 0;
//       for (let i = 0; i < this.data.topics.at(-1).speakerTurns.turns.length; i++) {
//         let length = this.data.topics.at(-1).speakerTurns.turns[i].length;
//         console.log(length);
//         total += length;
//         console.log(total);
//       }
//       this.data.topics.at(-1).speakerTurns.total = total;

//       console.log(newSpeakerTurns);
//       return newSpeakerTurns;
//     }
//   }

//   // Create a topic object
//   async createTopicObject(chunk) {
//     console.log("checking if new segent changed topic");
//     const segment = this.getSegmentForTopic(chunk);
//     const result = await this.openAI.gptResult(
//       segment,
//       this.data.m1.at(-1).topic,
//       "turn"
//     );

//     console.log(result);
//     // If no result is returned
//     // Then the topic has not changed, so add the
//     // new speech transcript to the topic transcript
//     // and set last postturn to empty (to indicate the postturn
//     // is not recent and using the whole current topic chunk
//     // might be too large)

//     if (!result) {
//       console.log("Same topic");
//       this.data.topics.at(-1).segment += chunk.segment;
//       this.data.topics.at(-1).totalSeconds += 60;
//       this.combineSpeakerTurns(chunk, "", "old");
//       this.lastPostTurn = "";
//       const subTopics = await this.openAI.getSubtopics(this.data.topics.at(-1).segment);
//       this.data.topics.at(-1).description = subTopics;
//       return null;
//     }

//     // Otherwise, store the recent postturn and create a new topic
//     this.lastPostTurn = result[0].segment;
//     if (result[1]) {
//       this.data.topics.at(-1).segment += result[1];
//     }

//     // Combine the new topic string with the last topic string
//     // To get indexOf turn sentence, and calculate proportional time
//     let fullSeg = this.data.topics.at(-1).segment + result[0].segment;
//     let topicTime = "";

//     //If the turn sentence can be found in the segment
//     //Find the proportional start time
//     if (fullSeg.toLowerCase().indexOf(result[0].sentence.toLowerCase()) >= 0) {
//       let indexPercent =
//         fullSeg.toLowerCase().indexOf(result[0].sentence.toLowerCase()) /
//         (fullSeg.length - 1);
//       console.log(indexPercent);
//       console.log(fullSeg.indexOf(result[0].sentence));
//       console.log(fullSeg.length - 1);
//       topicTime = this.getStringTime(indexPercent);
//       // If all else fails set start time to the last minute
//       // classification time
//     } else {
//       topicTime = this.data.m1.at(-1).time;
//     }
//     let seconds = this.getTopicSeconds(topicTime);

//     //Split the speaker turns
//     let newSpeakerTurns = this.combineSpeakerTurns(chunk, result[0].sentence);
//     const subTopics = await this.openAI.getSubtopics(result[0].segment);
//     console.log(subTopics)
    
//     return {
//       topic: result[0].topic.toUpperCase(),
//       description: subTopics,
//       segment: result[0].segment,
//       time: topicTime,
//       totalSeconds: seconds,
//       speakerTurns: newSpeakerTurns,
//       zoomInIndex: this.getZoomLevel("topics", "in"),
//       zoomOutIndex: this.getZoomLevel("topics", "out"),
//       id: `topics-${this.getData("topics").length}`,
//     };
//   }

//   getStringTime(indexPercent) {
//     let currTime = new Date();
//     const [chours, cminutes, cseconds] = this.data.topics
//       .at(-1)
//       .time.split(":")
//       .map(Number);
//     let lastTime = new Date();
//     lastTime.setHours(chours, cminutes, cseconds, 0);
//     let diffMs = Math.abs(lastTime - currTime); // Use Math.abs to handle negative differences
//     let diffSeconds = Math.floor(diffMs / 1000);
//     let proportionSeconds = diffSeconds * indexPercent;
//     console.log(diffSeconds);
//     console.log(proportionSeconds);
//     console.log(lastTime.getSeconds());

//     lastTime.setSeconds(lastTime.getSeconds() + proportionSeconds);
//     console.log(lastTime);
//     const hours = String(lastTime.getHours()).padStart(2, "0");
//     const minutes = String(lastTime.getMinutes()).padStart(2, "0");
//     const seconds = String(lastTime.getSeconds()).padStart(2, "0");

//     return `${hours}:${minutes}:${seconds}`;
//   }

//   getTopicSeconds(startTime) {
//     let currTime = new Date();
//     const [chours, cminutes, cseconds] = startTime.split(":").map(Number);
//     startTime = new Date();
//     startTime.setHours(chours, cminutes, cseconds, 0);
//     let diffMs = Math.abs(startTime - currTime); // Use Math.abs to handle negative differences
//     let diffSeconds = Math.floor(diffMs / 1000);
//     return diffSeconds;
//   }

//   // Get the segment for topic creation
//   getSegmentForTopic(chunk) {
//     if (this.data.m1.length > 1) {
//       // If the last detected postturn is recent (exists), combine
//       // it with the new segment
//       // Otherwise using the transcript from the last postturn is
//       // too big, so just check the last two minutes.
//       return this.lastPostTurn
//         ? this.lastPostTurn + chunk.segment
//         : this.data.m1.at(-2).segment + chunk.segment;
//     }
//     return chunk.segment;
//   }

//   // Get the zoom level index
//   getZoomLevel(level, zoom) {
//     const zoomLevels = {
//       s10: { in: null, out: this.getData("s30").length },
//       s30: { in: this.getData("s10").length, out: this.getData("m1").length },
//       m1: { in: this.getData("s30").length, out: this.getData("m5").length },
//       m5: { in: this.getData("m1").length, out: null },
//       topics: { in: this.getData("m1").length, out: null },
//     };
//     return zoomLevels[level]?.[zoom] ?? null;
//   }

//   mockTranscript() {
//     let transcriptChunks = [
//       "So you're going to Stampede tomorrow. Are there any foods that you're are you going to try the foods or are you just going to I'm going to try some of them, but I don't know.",
//       "Are you going to try the cheeseburger, ice cream cheeseburger? I feel like I'm a little scared to like waste so much money because I mean, I can share $10.00 for it too.",
//       "Yeah, like $13. Like okay, in Japan like we had. It's like really, it's called creamy and it's like, I think it's like some sort of Marvel science where I don't know, I think that's a lot of food science.",
//     ];
//     return transcriptChunks;
//   }

//   mockData2() {
//     let data = {
//       s10: [
//         {
//           topic: "READINESS FOR CHANGE",
//           description: "I was not ready when she was ready.",
//           segment:
//             "It's hard 💪 to mentally prepare. I was not ready when she was ready. Oh my gosh 😱.",
//           time: "00:59:36",
//           speakerTurns: {
//             total: 16,
//             speakers: [
//               {
//                 speakerId: "Guest-1",
//                 length: 16,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg:
//                   "It's hard 💪 to mentally prepare. I was not ready when she was ready. Oh my gosh 😱.",
//                 length: 16,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 0,
//           id: "s10-0",
//         },
//         {
//           topic: "SKYDIVING PROPOSAL",
//           description:
//             "Yeah, she was like, let's go skydiving, like right now.",
//           segment: "Yeah, she was like, let's go skydiving ✈️, like right now.",
//           time: "00:59:46",
//           speakerTurns: {
//             total: 10,
//             speakers: [
//               {
//                 speakerId: "Guest-1",
//                 length: 10,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg:
//                   "Yeah, she was like, let's go skydiving ✈️, like right now.",
//                 length: 10,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 0,
//           id: "s10-1",
//         },
//         {
//           topic: "TRAVEL PLANS",
//           description: "I thought that would be more time in between.",
//           segment:
//             "I've never even thought 🤔 about this before. What do you mean? Yeah, I thought she was like joking 😄 at first, or like by how soon she wanted to go, but then. Pictures of her. And I was like, Oh yeah, OK 👌, yeah, I thought. I thought that would be more time ⏰ in between.",
//           time: "00:59:57",
//           speakerTurns: {
//             total: 53,
//             speakers: [
//               {
//                 speakerId: "Guest-1",
//                 length: 53,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg:
//                   "I've never even thought 🤔 about this before. What do you mean? Yeah, I thought she was like joking 😄 at first, or like by how soon she wanted to go, but then.",
//                 length: 31,
//               },
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg:
//                   "Pictures of her. And I was like, Oh yeah, OK 👌, yeah, I thought. I thought that would be more time ⏰ in between.",
//                 length: 22,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 0,
//           id: "s10-2",
//         },
//         {
//           topic: "PERSONALITY DESCRIPTION",
//           description: "Yeah, like she's, she's very much like.",
//           segment: "Yeah, like she's, she's very much like 💯.",
//           time: "01:00:08",
//           speakerTurns: {
//             total: 7,
//             speakers: [
//               {
//                 speakerId: "Guest-1",
//                 length: 7,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg: "Yeah, like she's, she's very much like 💯.",
//                 length: 7,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 1,
//           id: "s10-3",
//         },
//         {
//           topic: "DECISION MAKING",
//           description: "She just went into this, which is crazy.",
//           segment:
//             "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
//           time: "01:00:19",
//           speakerTurns: {
//             total: 38,
//             speakers: [
//               {
//                 speakerId: "Guest-2",
//                 length: 38,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-2",
//                 speakerSeg:
//                   "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
//                 length: 38,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 1,
//           id: "s10-4",
//         },
//         {
//           topic: "ADRENALINE ACTIVITY INTEREST",
//           description: "Like he really likes it.",
//           segment:
//             "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
//           time: "01:00:30",
//           speakerTurns: {
//             total: 28,
//             speakers: [
//               {
//                 speakerId: "Guest-2",
//                 length: 28,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-2",
//                 speakerSeg:
//                   "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
//                 length: 28,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 1,
//           id: "s10-5",
//         },
//         {
//           topic: "READINESS FOR CHANGE",
//           description: "I was not ready when she was ready.",
//           segment:
//             "It's hard 💪 to mentally prepare. I was not ready when she was ready. Oh my gosh 😱.",
//           time: "00:59:36",
//           speakerTurns: {
//             total: 16,
//             speakers: [
//               {
//                 speakerId: "Guest-1",
//                 length: 16,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg:
//                   "It's hard 💪 to mentally prepare. I was not ready when she was ready. Oh my gosh 😱.",
//                 length: 16,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 0,
//           id: "s10-0",
//         },
//         {
//           topic: "SKYDIVING PROPOSAL",
//           description:
//             "Yeah, she was like, let's go skydiving, like right now.",
//           segment: "Yeah, she was like, let's go skydiving ✈️, like right now.",
//           time: "00:59:46",
//           speakerTurns: {
//             total: 10,
//             speakers: [
//               {
//                 speakerId: "Guest-1",
//                 length: 10,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg:
//                   "Yeah, she was like, let's go skydiving ✈️, like right now.",
//                 length: 10,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 0,
//           id: "s10-1",
//         },
//         {
//           topic: "TRAVEL PLANS",
//           description: "I thought that would be more time in between.",
//           segment:
//             "I've never even thought 🤔 about this before. What do you mean? Yeah, I thought she was like joking 😄 at first, or like by how soon she wanted to go, but then. Pictures of her. And I was like, Oh yeah, OK 👌, yeah, I thought. I thought that would be more time ⏰ in between.",
//           time: "00:59:57",
//           speakerTurns: {
//             total: 53,
//             speakers: [
//               {
//                 speakerId: "Guest-1",
//                 length: 53,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg:
//                   "I've never even thought 🤔 about this before. What do you mean? Yeah, I thought she was like joking 😄 at first, or like by how soon she wanted to go, but then.",
//                 length: 31,
//               },
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg:
//                   "Pictures of her. And I was like, Oh yeah, OK 👌, yeah, I thought. I thought that would be more time ⏰ in between.",
//                 length: 22,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 0,
//           id: "s10-2",
//         },
//         {
//           topic: "PERSONALITY DESCRIPTION",
//           description: "Yeah, like she's, she's very much like.",
//           segment: "Yeah, like she's, she's very much like 💯.",
//           time: "01:00:08",
//           speakerTurns: {
//             total: 7,
//             speakers: [
//               {
//                 speakerId: "Guest-1",
//                 length: 7,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-1",
//                 speakerSeg: "Yeah, like she's, she's very much like 💯.",
//                 length: 7,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 1,
//           id: "s10-3",
//         },
//         {
//           topic: "DECISION MAKING",
//           description: "She just went into this, which is crazy.",
//           segment:
//             "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
//           time: "01:00:19",
//           speakerTurns: {
//             total: 38,
//             speakers: [
//               {
//                 speakerId: "Guest-2",
//                 length: 38,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-2",
//                 speakerSeg:
//                   "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
//                 length: 38,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 1,
//           id: "s10-4",
//         },
//         {
//           topic: "ADRENALINE ACTIVITY INTEREST",
//           description: "Like he really likes it.",
//           segment:
//             "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
//           time: "01:00:30",
//           speakerTurns: {
//             total: 28,
//             speakers: [
//               {
//                 speakerId: "Guest-2",
//                 length: 28,
//               },
//             ],
//             turns: [
//               {
//                 speakerId: "Guest-2",
//                 speakerSeg:
//                   "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
//                 length: 28,
//               },
//             ],
//           },
//           topicIndex: 0,
//           zoomInIndex: null,
//           zoomOutIndex: 1,
//           id: "s10-5",
//         },
//       ]
//     };
//     return data;
//   }
// }
