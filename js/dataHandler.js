import { OpenAI } from "/conversation-timelines/openaiController.js";

export class DataHandler {
  constructor() {
    this.data = this.mockData2();
    this.transcript = this.mockTranscript();
    this.openAI = new OpenAI();
    this.lastPostTurn = "";
    this.minSegWithLastTurn = "";
  }

  // Initialize data structure
  initData() {
    return {
      s10: [],
      s30: [],
      m1: [],
      m5: [],
      topics: [],
    };
  }

  // Update data and transcript with new transcription
  async update(transcription, speakerTurns, data) {
    await this.addToData(transcription, speakerTurns, data);
    this.addToTranscript(transcription[0]);
    console.log(this.data)
    return true;
  }

  // Get data for a specific level
  getData(level = "s10") {
    return this.data[level] || [];
  }

  // Get the transcript
  getTranscript() {
    return this.transcript;
  }

  // Add a chunk to the transcript
  addToTranscript(chunk) {
    this.transcript.push(chunk);
  }

  // Add new data to the appropriate levels
  async addToData(transcription, speakerTurns, data) {
    const lastTopic =
      this.data.s10.length > 0 ? this.data.s10.at(-1).topic : "";
    const topic = await this.createTimedTopicObject(
      transcription,
      "s10",
      lastTopic,
      speakerTurns
    );
    console.log('updated')
    
    if (topic.topic) {
      this.data.s10.push(topic);
      const currData = structuredClone(this.data);

      // Update s30 level
      if (currData.s10.length % 3 === 0) {
        const s30Topic = await this.mergeTopics(
          currData,
          3,
          "s30",
          this.data.s30.at(-1)?.topic || "",
          speakerTurns
        );
        this.data.s30.push(s30Topic);
      }

      // Update m1 level
      if (currData.s10.length % 6 === 0) {
        const m1Topic = await this.mergeTopics(
          currData,
          6,
          "m1",
          this.data.m1.at(-1)?.topic || "",
          speakerTurns
        );
        this.data.m1.push(m1Topic);

        // Update topics level
        console.log(m1Topic)
        const newTopic =
          this.data.topics.length === 0
            ? await this.createTopicObjectFromM1(m1Topic)
            : await this.createTopicObject(m1Topic);
        console.log(newTopic)
        if (newTopic) this.data.topics.push(newTopic);
      }

      // Update m5 level
      if (currData.s10.length % 30 === 0) {
        const m5Topic = await this.mergeTopics(
          currData,
          30,
          "m5",
          this.data.m5.at(-1)?.topic || "",
          speakerTurns
        );
        this.data.m5.push(m5Topic);
      }
    }
    return true;
  }

  mergeSpeakerTurns(n) {
    let speakerTurns = this.data.s10.slice(-n).map((item) => item.speakerTurns);
    console.log(speakerTurns);

    let combinedTotal = 0;
    // use an object to accumulate speaker lengths by speakerId
    const combinedSpeakers = {};
    const combinedTurns = [];

    speakerTurns.forEach((segment) => {
      console.log(segment);
      combinedTotal += segment.total;
      console.log(combinedTotal);
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
      console.log(combinedTurns);
    });

    // Convert combinedSpeakers object to an array
    const speakersArray = Object.keys(combinedSpeakers).map((speakerId) => {
      return { speakerId, length: combinedSpeakers[speakerId] };
    });

    console.log(speakersArray);

    return {
      total: combinedTotal,
      speakers: speakersArray,
      turns: combinedTurns,
    };
  }

  // Merge topics for a given level
  async mergeTopics(currData, n, level, lastTopic) {
    console.log("Merging topics");
    const zoomInIndex = currData.s10.length - 1;
    const newSegment = currData.s10
      .slice(-n)
      .map((segment) => segment.segment)
      .join(" ");
    const time = currData.s10.at(-n).time;
    let mergedSpeakerTurns = this.mergeSpeakerTurns(n);
    console.log(mergedSpeakerTurns);
    return await this.createTimedTopicObject(
      [newSegment, time],
      level,
      lastTopic,
      mergedSpeakerTurns
    );
  }

  // Create a timed topic object
  async createTimedTopicObject(chunk, level, lastTopic, speakerTurns) {
    const result = await this.openAI.gptResult(chunk[0], lastTopic);
    return {
      topic: result.topic.toUpperCase(),
      description: result.sentence,
      segment: result.segment,
      time: chunk[1],
      speakerTurns: speakerTurns,
      topicIndex: this.getData("topics").length,
      zoomInIndex: this.getZoomLevel(level, "in"),
      zoomOutIndex: this.getZoomLevel(level, "out"),
      id: `${level}-${this.getData(level).length}`,
    };
  }

  // Create a topic object from m1 data
  async createTopicObjectFromM1(m1Topic) {
    const subTopics = await this.openAI.getSubtopics(m1Topic.segment);
    console.log(subTopics)
    return {
      topic: m1Topic.topic,
      description: subTopics,
      segment: m1Topic.segment,
      time: m1Topic.time,
      speakerTurns: m1Topic.speakerTurns,
      totalSeconds: 60,
      zoomInIndex: this.getZoomLevel("topics", "in"),
      zoomOutIndex: this.getZoomLevel("topics", "out"),
      id: `topics-${this.getData("topics").length}`,
    };
  }

  combineSpeakerTurns(chunk, turnSentence = "", topicType = "new") {
    let fullTurnsList = this.data.topics
      .at(-1)
      .speakerTurns.turns.concat(chunk.speakerTurns.turns);
    if (topicType != "new") {
      console.log(this.data.topics.at(-1).speakerTurns);
      this.data.topics.at(-1).speakerTurns.turns = fullTurnsList;
      this.data.topics.at(-1).speakerTurns.total += chunk.speakerTurns.total;
      const result = {};

      //Split turns for new topic
    } else {
      console.log(this.data.topics.at(-1).speakerTurns);
      console.log(chunk.speakerTurns);

      let newSpeakerTurns = {};
      for (let i = 0; i < fullTurnsList.length; i++) {
        let turn = fullTurnsList[i].speakerSeg;
        console.log(turn);
      }

      // Look for the speaker turn containing the turn sentence
      for (let i = 0; i < fullTurnsList.length; i++) {
        let turn = fullTurnsList[i].speakerSeg;
        console.log(i, turn);
        console.log(turnSentence);

        if (turnSentence.includes(turn) || turn.includes(turnSentence)) {
          this.data.topics.at(-1).speakerTurns.turns = fullTurnsList.slice(
            0,
            i
          );
          newSpeakerTurns.turns = fullTurnsList.slice(i, fullTurnsList.length);
          break;
        }
      }

      let total = 0;
      for (let i = 0; i < newSpeakerTurns.turns.length; i++) {
        let length = newSpeakerTurns.turns[i].length;
        console.log(length);
        total += length;
        console.log(total);
      }
      newSpeakerTurns.total = total;

      total = 0;
      for (let i = 0; i < this.data.topics.at(-1).speakerTurns.turns.length; i++) {
        let length = this.data.topics.at(-1).speakerTurns.turns[i].length;
        console.log(length);
        total += length;
        console.log(total);
      }
      this.data.topics.at(-1).speakerTurns.total = total;

      console.log(newSpeakerTurns);
      return newSpeakerTurns;
    }
  }

  // Create a topic object
  async createTopicObject(chunk) {
    console.log("checking if new segent changed topic");
    const segment = this.getSegmentForTopic(chunk);
    const result = await this.openAI.gptResult(
      segment,
      this.data.m1.at(-1).topic,
      "turn"
    );

    console.log(result);
    // If no result is returned
    // Then the topic has not changed, so add the
    // new speech transcript to the topic transcript
    // and set last postturn to empty (to indicate the postturn
    // is not recent and using the whole current topic chunk
    // might be too large)

    if (!result) {
      console.log("Same topic");
      this.data.topics.at(-1).segment += chunk.segment;
      this.data.topics.at(-1).totalSeconds += 60;
      this.combineSpeakerTurns(chunk, "", "old");
      this.lastPostTurn = "";
      const subTopics = await this.openAI.getSubtopics(this.data.topics.at(-1).segment);
      this.data.topics.at(-1).description = subTopics;
      return null;
    }

    // Otherwise, store the recent postturn and create a new topic
    this.lastPostTurn = result[0].segment;
    if (result[1]) {
      this.data.topics.at(-1).segment += result[1];
    }

    // Combine the new topic string with the last topic string
    // To get indexOf turn sentence, and calculate proportional time
    let fullSeg = this.data.topics.at(-1).segment + result[0].segment;
    let topicTime = "";

    //If the turn sentence can be found in the segment
    //Find the proportional start time
    if (fullSeg.toLowerCase().indexOf(result[0].sentence.toLowerCase()) >= 0) {
      let indexPercent =
        fullSeg.toLowerCase().indexOf(result[0].sentence.toLowerCase()) /
        (fullSeg.length - 1);
      console.log(indexPercent);
      console.log(fullSeg.indexOf(result[0].sentence));
      console.log(fullSeg.length - 1);
      topicTime = this.getStringTime(indexPercent);
      // If all else fails set start time to the last minute
      // classification time
    } else {
      topicTime = this.data.m1.at(-1).time;
    }
    let seconds = this.getTopicSeconds(topicTime);

    //Split the speaker turns
    let newSpeakerTurns = this.combineSpeakerTurns(chunk, result[0].sentence);
    const subTopics = await this.openAI.getSubtopics(result[0].segment);
    console.log(subTopics)
    
    return {
      topic: result[0].topic.toUpperCase(),
      description: subTopics,
      segment: result[0].segment,
      time: topicTime,
      totalSeconds: seconds,
      speakerTurns: newSpeakerTurns,
      zoomInIndex: this.getZoomLevel("topics", "in"),
      zoomOutIndex: this.getZoomLevel("topics", "out"),
      id: `topics-${this.getData("topics").length}`,
    };
  }

  getStringTime(indexPercent) {
    let currTime = new Date();
    const [chours, cminutes, cseconds] = this.data.topics
      .at(-1)
      .time.split(":")
      .map(Number);
    let lastTime = new Date();
    lastTime.setHours(chours, cminutes, cseconds, 0);
    let diffMs = Math.abs(lastTime - currTime); // Use Math.abs to handle negative differences
    let diffSeconds = Math.floor(diffMs / 1000);
    let proportionSeconds = diffSeconds * indexPercent;
    console.log(diffSeconds);
    console.log(proportionSeconds);
    console.log(lastTime.getSeconds());

    lastTime.setSeconds(lastTime.getSeconds() + proportionSeconds);
    console.log(lastTime);
    const hours = String(lastTime.getHours()).padStart(2, "0");
    const minutes = String(lastTime.getMinutes()).padStart(2, "0");
    const seconds = String(lastTime.getSeconds()).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  }

  getTopicSeconds(startTime) {
    let currTime = new Date();
    const [chours, cminutes, cseconds] = startTime.split(":").map(Number);
    startTime = new Date();
    startTime.setHours(chours, cminutes, cseconds, 0);
    let diffMs = Math.abs(startTime - currTime); // Use Math.abs to handle negative differences
    let diffSeconds = Math.floor(diffMs / 1000);
    return diffSeconds;
  }

  // Get the segment for topic creation
  getSegmentForTopic(chunk) {
    if (this.data.m1.length > 1) {
      // If the last detected postturn is recent (exists), combine
      // it with the new segment
      // Otherwise using the transcript from the last postturn is
      // too big, so just check the last two minutes.
      return this.lastPostTurn
        ? this.lastPostTurn + chunk.segment
        : this.data.m1.at(-2).segment + chunk.segment;
    }
    return chunk.segment;
  }

  // Get the zoom level index
  getZoomLevel(level, zoom) {
    const zoomLevels = {
      s10: { in: null, out: this.getData("s30").length },
      s30: { in: this.getData("s10").length, out: this.getData("m1").length },
      m1: { in: this.getData("s30").length, out: this.getData("m5").length },
      m5: { in: this.getData("m1").length, out: null },
      topics: { in: this.getData("m1").length, out: null },
    };
    return zoomLevels[level]?.[zoom] ?? null;
  }

  mockTranscript() {
    let transcriptChunks = [
      "So you're going to Stampede tomorrow. Are there any foods that you're are you going to try the foods or are you just going to I'm going to try some of them, but I don't know.",
      "Are you going to try the cheeseburger, ice cream cheeseburger? I feel like I'm a little scared to like waste so much money because I mean, I can share $10.00 for it too.",
      "Yeah, like $13. Like okay, in Japan like we had. It's like really, it's called creamy and it's like, I think it's like some sort of Marvel science where I don't know, I think that's a lot of food science.",
    ];
    return transcriptChunks;
  }

  mockData() {
    let data = {
      s10: [
        {
          topic: "SKYDIVING",
          description: "She was ready to go skydiving.",
          segment:
            "time to mentally prepare i was not ready but she was ready oh my gosh um yeah no she was like let's go skydiving like",
          time: "17:14:05",
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-0",
        },
        {
          topic: "SURPRISE RESPONSE",
          description: "I've never even thought about this before.",
          segment:
            "right now and I was just like I've never even thought about this before what do you mean? Yeah I thought she was like joking at first or like by how soon she wanted to go.",
          time: "17:14:16",
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-1",
        },
        {
          topic: "CONVERSATION GAP",
          description: "And I. In between to.",
          segment: "And I. In between to.",
          time: "17:14:26",
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-2",
        },
        {
          topic: "DECISIVENESS",
          description: "She just went and did it which is crazy.",
          segment:
            "She's very much like that, like she asked me a couple times and I was always like oh like I'll think about it whatever and then she's like okay enough is enough and she just went and did it which is crazy I was",
          time: "17:14:36",
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 0,
          id: "s10-3",
        },
        {
          topic: "ADVENTURE PLANS",
          description: "Do you think Emmanuel would go with you?",
          segment:
            "Oh, do you think Emmanuel would go with you? Well, I don't know cuz like he's I I think he would cuz he's definitely like an adrenaline junkie",
          time: "17:14:46",
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 1,
          id: "s10-4",
        },
        {
          topic: "PREFERENCES",
          description: "He really likes to do that type of stuff.",
          segment:
            "to a certain extent, like he really likes to do that type of stuff, but I mean honestly, yeah probably.",
          time: "17:14:56",
          topicIndex: 0,
          zoomInIndex: null,
          zoomOutIndex: 1,
          id: "s10-5",
        },
        {
          topic: "TRAVEL PLANNING",
          description: "There are just so many implications of going.",
          segment:
            "together then. That'd be cute. Bro, I, the thing is like I want to but I'm also like there's just so many implications of going because it's like",
          time: "17:15:06",
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 2,
          id: "s10-6",
        },
        {
          topic: "LEARNING EXPERIENCE",
          description:
            "Like, yeah, you're with the instructor, but like, things can always go wrong, you know what I mean?",
          segment:
            "Like, yeah, you're with the instructor, but like, things can always go wrong, you know what I mean? Yeah. But, um, another thing is like, I want to get",
          time: "17:15:16",
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 2,
          id: "s10-7",
        },
        {
          topic: "MOTORCYCLE LICENSE",
          description: "My actual motorcycle license.",
          segment:
            "My actual motorcycle license. I'm gonna be one of those girls. You've been talking about that for so long. Sorry? I said you've been talking about that for like two years.",
          time: "17:15:26",
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 2,
          id: "s10-8",
        },
        {
          topic: "LEARNING BARRIERS",
          description:
            "But the thing is, like, you can't practice without a license.",
          segment:
            "Let me tell you why. Okay, because I did do the lessons, right? And like, it was fine, whatever. But the thing is, like, you can't practice without a license.",
          time: "17:15:36",
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 3,
          id: "s10-9",
        },
        {
          topic: "DRIVER'S LICENSE PROCESS",
          description: "The way you get the license is with a driven test.",
          segment:
            "And like, the way you get the license is with a driven test. So it's not like where you can get a learner's and have someone that you can drive with someone is there with you. Right?",
          time: "17:15:46",
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 3,
          id: "s10-10",
        },
        {
          topic: "MOTORCYCLE INVESTMENT CONCERNS",
          description:
            "Do I really want to invest like 3-4k in a bike and I'm still learning?",
          segment:
            "fully lengthened you can't do that with a motorcycle right and then it's also like do I really want to invest like 3-4k in a bike and I'm still learning and like what happens if I drop it or like",
          time: "17:15:55",
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 3,
          id: "s10-11",
        },
        {
          topic: "BIKE RENTAL OPTIONS",
          description: "I need to either be able to rent one at my...",
          segment:
            "You know, there's like lots of things that can ruin a bike. Yeah. So, you know what I mean? So it's like, I need to either be able to rent one at my...",
          time: "17:16:05",
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 4,
          id: "s10-12",
        },
        {
          topic: "INSTRUMENT CARE",
          description:
            "I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet.",
          segment:
            "lessons place and like be able to get decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet because even",
          time: "17:16:15",
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 4,
          id: "s10-13",
        },
        {
          topic: "RENTAL AGREEMENT",
          description: "If you rent one and you damage it, that's still okay.",
          segment:
            "if you rent one and you damage it, that's still okay. I feel like that would still cost you money, right? Well, it's a little different, because like when I did",
          time: "17:16:25",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 4,
          id: "s10-14",
        },
        {
          topic: "BIKE LESSONS",
          description:
            "I did drop two bikes but they couldn't charge me because it's included in the fee.",
          segment:
            "lessons I did end up like crashing or not crashing but I did drop two bikes but they couldn't charge me because it's included in the fee.",
          time: "17:16:35",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 5,
          id: "s10-15",
        },
        {
          topic: "PROTECTIVE MEASURES",
          description:
            "You guys could probably put some like guards on there and stuff too to make sure that it doesn't get completely busted.",
          segment:
            "You guys could probably put some like guards on there and stuff too to make sure that it doesn't get completely busted, yeah.",
          time: "17:16:45",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 5,
          id: "s10-16",
        },
        {
          topic: "BUCKET LIST",
          description: "What would be on your bucket list?",
          segment:
            "What would be on your bucket list? Me? Uh-huh. Honestly, I feel like I've achieved a lot of those things in the past year.",
          time: "17:16:55",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 5,
          id: "s10-17",
        },
        {
          topic: "TRAVEL EXPERIENCES",
          description:
            "The one thing that was on my bucket list for a really long time, but I did it when I was in Singapore.",
          segment:
            "couple years. Okay. I see you. I haven't really, I mean, the one thing that was on my bucket list for a really long time, but I did it when I was in Singapore. No, when I went to",
          time: "17:17:06",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 6,
          id: "s10-18",
        },
        {
          topic: "TRAVEL DESTINATIONS",
          description:
            "Was I always really wanted to go like, you know in those caves behind the waterfalls?",
          segment:
            "Indonesia. Um, yeah. Was I always really wanted to go like, you know in those caves behind the waterfalls? Oh, yeah, yeah.",
          time: "17:17:15",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 6,
          id: "s10-19",
        },
        {
          topic: "PERSONAL EXPERIENCE",
          description:
            "Yeah, I always wanted to do that, and then I got to do it when I was in Indonesia.",
          segment:
            "Yeah, I always wanted to do that, and then I got to do it when I was in Indonesia. It was kind of must-see, to be honest, but it was so cool.",
          time: "17:17:25",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 6,
          id: "s10-20",
        },
        {
          topic: "CAVE DESCRIPTION",
          description:
            "It's a big cave with, like, an eternal flow of water coming down and splashing into the dark, damp cave.",
          segment:
            "I didn't know it was, like, this big, musty cave hole. I mean, it's a big cave with, like, an eternal flow of water coming down and splashing into the dark, damp cave.",
          time: "17:17:35",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 7,
          id: "s10-21",
        },
        {
          topic: "UNCERTAINTY",
          description: "I don't really know what I was expecting.",
          segment:
            "Okay, yeah, well you put it like that. Honestly, okay, to be fair, I kind of didn't expect it either, but then I was like, yeah, I don't really know what I was expecting.",
          time: "17:17:45",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 7,
          id: "s10-22",
        },
        {
          topic: "TRAVEL",
          description: "Would you ever go to Egypt?",
          segment:
            "Yeah, I know. What about like, traveling? Like, would you ever go to Egypt? Egypt? Yes. I would want to go to Egypt.",
          time: "17:17:55",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 7,
          id: "s10-23",
        },
        {
          topic: "SAFETY CONCERNS",
          description:
            "Going to those parts of the world, especially as a woman, you have to take more precautions.",
          segment:
            "yeah I feel like going to those parts of the world especially like as a woman you kind of have to take more precautions okay yeah that's true",
          time: "17:18:05",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 8,
          id: "s10-24",
        },
        {
          topic: "TRAVEL PLANS",
          description: "I want to go back to Europe.",
          segment:
            "But, it's definitely something I want to do eventually. I want to go back to Europe. Oh, yeah. Oh, I want to go to, um, like, Germany or like those...",
          time: "17:18:15",
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 8,
          id: "s10-25",
        },
        {
          topic: "FRENCH PROVINCES",
          description:
            "Little provinces in France that are Paris and like I just want to go to like those.",
          segment:
            "Little provinces in France that are Paris and like I just want to go to like those.",
          time: "17:18:25",
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 8,
          id: "s10-26",
        },
        {
          topic: "FAIRY TALES",
          description: "That'd be dope if we did a fairytale theme.",
          segment:
            "is that like fairy tales are mixed off of like the castles and everything oh that's cute i like that yeah because yeah that'd be dope we did a very",
          time: "17:18:35",
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 9,
          id: "s10-27",
        },
        {
          topic: "TRAVEL EXPERIENCE",
          description: "We kind of just threw Paris in there because we could.",
          segment:
            "like when we went to Europe it was we kind of just threw Paris in there because we could but it was very like",
          time: "17:18:45",
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 9,
          id: "s10-28",
        },
        {
          topic: "ANCIENT HISTORY",
          description:
            "Greece, Italy, and like all of the very historical stuff like Greek Roman mythology or like sort of those empires, those times.",
          segment:
            "greece italy and like all of the very historical stuff like right greek roman mythology or like sort of those empires those times which was great like",
          time: "17:18:55",
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 9,
          id: "s10-29",
        },
        {
          topic: "BUCKET LIST",
          description:
            "That was also on my bucket list, so I'm not upset about that.",
          segment:
            "That was also on my bucket list, so I'm not upset about that, but the next thing I'd want to do is kind of see some of that more.",
          time: "17:19:05",
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 10,
          id: "s10-30",
        },
        {
          topic: "ROMANTIC HISTORY",
          description: "I guess what we would consider like romantic history.",
          segment:
            "I guess what we would consider like romantic history. Right. Yeah, that would be really cool.",
          time: "17:19:15",
          topicIndex: 4,
          zoomInIndex: null,
          zoomOutIndex: 10,
          id: "s10-31",
        },
        {
          topic: "ART MUSEUM VISIT",
          description:
            "I think you already got to see like you went to the Louvre and everything, right?",
          segment:
            "I think you already got to see like you went to the Louvre and everything, right? Yeah",
          time: "17:19:25",
          topicIndex: 4,
          zoomInIndex: null,
          zoomOutIndex: 10,
          id: "s10-32",
        },
        {
          topic: "TRAVEL RECOMMENDATION",
          description:
            "Honestly, I'd say Paris is worth going to if you just want to go for the tourist attractions.",
          segment:
            "Honestly, I'd say Paris is worth going to if you just want to go for the tourist attractions. And I heard it's like open to the public.",
          time: "17:19:35",
          topicIndex: 4,
          zoomInIndex: null,
          zoomOutIndex: 11,
          id: "s10-33",
        },
        {
          topic: "PARIS ROMANCE",
          description:
            "Like in terms of like Paris being the most romantic city in the world, I think.",
          segment:
            "if you live there but like in terms of like Paris being the most romantic city in the world I think",
          time: "17:19:45",
          topicIndex: 4,
          zoomInIndex: null,
          zoomOutIndex: 11,
          id: "s10-34",
        },
        {
          topic: "TOURIST EXPERIENCE",
          description: "They're root to tourists, I think.",
          segment:
            "If you go on with that mindset, you're going to be disappointed. Yeah, I've heard it's actually like really, like, kind of dirty, everyone. Kind of. They're root to tourists, I think.",
          time: "17:19:55",
          topicIndex: 4,
          zoomInIndex: null,
          zoomOutIndex: 11,
          id: "s10-35",
        },
        {
          topic: "CULTURAL ATTITUDES",
          description: "They don't like tourists.",
          segment:
            "They don't like tourists. Yeah, that's what I heard. Which is fair, but then it's also like, you've never been a tourist anywhere, like, I don't know.",
          time: "17:20:05",
          topicIndex: 4,
          zoomInIndex: null,
          zoomOutIndex: 12,
          id: "s10-36",
        },
        {
          topic: "TRAVEL",
          description:
            "I want to go back to Australia so badly; it was so cool.",
          segment:
            "mm-hmm I also want to go to Australia oh my god I want to go back to Australia so badly it was so cool I loved it",
          time: "17:20:15",
          topicIndex: 4,
          zoomInIndex: null,
          zoomOutIndex: 12,
          id: "s10-37",
        },
        {
          topic: "SOUVENIRS",
          description:
            "Have I given you any of the postcards or anything that I've collected for you?",
          segment:
            "Yeah, it sounds so cool, it looks so beautiful. Have I given you any of the postcards or anything that I've collected for you?",
          time: "17:20:25",
          topicIndex: 5,
          zoomInIndex: null,
          zoomOutIndex: 12,
          id: "s10-38",
        },
        {
          topic: "GIFT EXCHANGE",
          description: "I'm pretty sure I grabbed some stuff for you.",
          segment:
            "Um, I, I remember you gave me the one. Yeah. I, but I'm pretty sure I grabbed some stuff for you when I was.",
          time: "17:20:35",
          topicIndex: 5,
          zoomInIndex: null,
          zoomOutIndex: 13,
          id: "s10-39",
        },
        {
          topic: "CRUSH REVELATION",
          description:
            "But I love that you think of me, like that's so cute because now I just have a crush on",
          segment:
            "But I love that you think of me, like that's so cute because now I just have a crush on.",
          time: "17:20:45",
          topicIndex: 5,
          zoomInIndex: null,
          zoomOutIndex: 13,
          id: "s10-40",
        },
        {
          topic: "POSTCARD COLLECTION",
          description:
            "I have a collection of postcards of places I've never been.",
          segment:
            "I have a collection of postcards of places I've never been, but I will go.",
          time: "17:20:55",
          topicIndex: 5,
          zoomInIndex: null,
          zoomOutIndex: 13,
          id: "s10-41",
        },
        {
          topic: "TRAVEL MEMORABILIA",
          description:
            "I try to get the like ones that are very specific to like the places that I see.",
          segment:
            "oh this is so pretty i gotta go now and it's also i try to get the like ones that are very specific to like the places that i see i guess that are",
          time: "17:21:05",
          speakerTurns: {
            total: 22,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 9,
              },
              {
                speakerId: "Guest-2",
                length: 13,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg: "oh this is so pretty i gotta go now",
                length: 9,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "and it's also i try to get the like ones that are very specific to like the places that i see i guess that are",
                length: 13,
              },
            ],
          },
          topicIndex: 5,
          zoomInIndex: null,
          zoomOutIndex: 14,
          id: "s10-42",
        },
        {
          topic: "METEOR JEWELRY",
          description: "The meteor one once I thought were really pretty.",
          segment:
            "just like Australia or like whatever looks perfect yeah so like the meteor one once I thought were really pretty so now you can look at that be like",
          time: "17:21:15",
          speakerTurns: {
            total: 22,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 11,
              },
              {
                speakerId: "Guest-2",
                length: 11,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "just like Australia or like whatever looks perfect yeah so",
                length: 11,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "like the meteor one once I thought were really pretty so now you can look at that be like",
                length: 11,
              },
            ],
          },
          topicIndex: 6,
          zoomInIndex: null,
          zoomOutIndex: 14,
          id: "s10-43",
        },
        {
          topic: "TRAVEL PLANS",
          description: "I want to like travel I want.",
          segment:
            "know this place existed but it's super pretty so I'm going to go here because I have a postcard of the ocean yeah I totally want to do that I want to like travel I want",
          time: "17:21:25",
          speakerTurns: {
            total: 26,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 20,
              },
              {
                speakerId: "Guest-2",
                length: 6,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg: "that I want to like travel I want",
                length: 6,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "know this place existed but it's super pretty so I'm going to go here because I have a postcard of the ocean yeah I totally want to do ",
                length: 20,
              },
            ],
          },
          topicIndex: 6,
          zoomInIndex: null,
          zoomOutIndex: 14,
          id: "s10-44",
        },
        {
          topic: "ADVENTURE ACTIVITIES",
          description: "I do want to try both skydiving and bungee jumping.",
          segment:
            "do all these okay what do you think about like bungee jumping so let's not think about doing that but again i okay okay i do want to try both skydiving and bungee jumping",
          time: "17:21:35",
          speakerTurns: {
            total: 30,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 14,
              },
              {
                speakerId: "Guest-2",
                length: 16,
              },
              {
                speakerId: "Guest-3",
                length: 16,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "do all these okay what do you think about like bungee jumping so let's not think about doing that",
                length: 8,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "but again i okay okay i do want to try both skydiving and bungee jumping",
                length: 12,
              },
              {
                speakerId: "Guest-3",
                speakerSeg:
                  "but again i okay okay i do want to try both skydiving and bungee jumping",
                length: 10,
              },
            ],
          },
          topicIndex: 6,
          zoomInIndex: null,
          zoomOutIndex: 15,
          id: "s10-45",
        },
        {
          topic: "FEAR OF FAINTING",
          description: "I'm worried I faint.",
          segment:
            "okay but I'm just a little scared yeah right because it's like I'm worried I faint like",
          time: "17:21:45",
          speakerTurns: {
            total: 18,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 18,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg: "okay but I'm just a little scared yeah right",
                length: 8,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "because it's like I'm worried I faint like",
                length: 10,
              },
            ],
          },
          topicIndex: 6,
          zoomInIndex: null,
          zoomOutIndex: 15,
          id: "s10-46",
        },
      ],
      s30: [
        {
          topic: "SKYDIVING",
          description:
            "Yeah no she was like let's go skydiving like right now.",
          segment:
            "time to mentally prepare i was not ready but she was ready oh my gosh um yeah no she was like let's go skydiving like right now and I was just like I've never even thought about this before what do you mean? Yeah I thought she was like joking at first or like by how soon she wanted to go. And I. In between to.",
          time: "17:14:26",
          topicIndex: 0,
          zoomInIndex: 4,
          zoomOutIndex: 0,
          id: "s30-0",
        },
        {
          topic: "ADVENTUROUS PLANS",
          description: "Oh, do you think Emmanuel would go with you?",
          segment:
            "She's very much like that, like she asked me a couple times and I was always like oh like I'll think about it whatever and then she's like okay enough is enough and she just went and did it which is crazy I was Oh, do you think Emmanuel would go with you? Well, I don't know cuz like he's I I think he would cuz he's definitely like an adrenaline junkie to a certain extent, like he really likes to do that type of stuff, but I mean honestly, yeah probably.",
          time: "17:14:56",
          topicIndex: 0,
          zoomInIndex: 6,
          zoomOutIndex: 0,
          id: "s30-1",
        },
        {
          topic: "MOTORCYCLE LICENSE",
          description: "I want to get my actual motorcycle license.",
          segment:
            "But, um, another thing is like, I want to get My actual motorcycle license. I'm gonna be one of those girls. You've been talking about that for so long. Sorry? I said you've been talking about that for like two years.",
          time: "17:15:26",
          topicIndex: 1,
          zoomInIndex: 9,
          zoomOutIndex: 1,
          id: "s30-2",
        },
        {
          topic: "MOTORCYCLE LICENSING",
          description:
            "But the thing is, like, you can't practice without a license.",
          segment:
            "Let me tell you why. Okay, because I did do the lessons, right? And like, it was fine, whatever. But the thing is, like, you can't practice without a license. And like, the way you get the license is with a driven test. So it's not like where you can get a learner's and have someone that you can drive with someone is there with you. Right? fully lengthened you can't do that with a motorcycle right and then it's also like do I really want to invest like 3-4k in a bike and I'm still learning and like what happens if I drop it or like",
          time: "17:15:55",
          topicIndex: 1,
          zoomInIndex: 12,
          zoomOutIndex: 1,
          id: "s30-3",
        },
        {
          topic: "BIKE RENTAL",
          description: "So, you know what I mean?",
          segment:
            "You know, there's like lots of things that can ruin a bike. Yeah. So, you know what I mean? So it's like, I need to either be able to rent one at my... lessons place and like be able to get decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet because even if you rent one and you damage it, that's still okay. I feel like that would still cost you money, right? Well, it's a little different, because like when I did",
          time: "17:16:25",
          topicIndex: 2,
          zoomInIndex: 15,
          zoomOutIndex: 2,
          id: "s30-4",
        },
        {
          topic: "MOTORCYCLE LESSONS",
          description:
            "I did drop two bikes but they couldn't charge me because it's included in the fee.",
          segment:
            "lessons I did end up like crashing or not crashing but I did drop two bikes but they couldn't charge me because it's included in the fee. You guys could probably put some like guards on there and stuff too to make sure that it doesn't get completely busted, yeah.",
          time: "17:16:55",
          topicIndex: 2,
          zoomInIndex: 18,
          zoomOutIndex: 2,
          id: "s30-5",
        },
        {
          topic: "BUCKET LIST ADVENTURE",
          description:
            "I always really wanted to go like, you know in those caves behind the waterfalls.",
          segment:
            "couple years. Okay. I see you. I haven't really, I mean, the one thing that was on my bucket list for a really long time, but I did it when I was in Singapore. No, when I went to Indonesia. Um, yeah. Was I always really wanted to go like, you know in those caves behind the waterfalls? Oh, yeah, yeah. Yeah, I always wanted to do that, and then I got to do it when I was in Indonesia. It was kind of must-see, to be honest, but it was so cool.",
          time: "17:17:25",
          topicIndex: 2,
          zoomInIndex: 21,
          zoomOutIndex: 3,
          id: "s30-6",
        },
        {
          topic: "TRAVEL",
          description: "What about like, traveling?",
          segment:
            "I didn't know it was, like, this big, musty cave hole. I mean, it's a big cave with, like, an eternal flow of water coming down and splashing into the dark, damp cave. Okay, yeah, well you put it like that. Honestly, okay, to be fair, I kind of didn't expect it either, but then I was like, yeah, I don't really know what I was expecting. Yeah, I know. What about like, traveling? Like, would you ever go to Egypt? Egypt? Yes. I would want to go to Egypt.",
          time: "17:17:55",
          topicIndex: 2,
          zoomInIndex: 24,
          zoomOutIndex: 3,
          id: "s30-7",
        },
        {
          topic: "TRAVEL",
          description: "I want to go back to Europe.",
          segment:
            "yeah I feel like going to those parts of the world especially like as a woman you kind of have to take more precautions okay yeah that's true But, it's definitely something I want to do eventually. I want to go back to Europe. Oh, yeah. Oh, I want to go to, um, like, Germany or like those... Little provinces in France that are Paris and like I just want to go to like those.",
          time: "17:18:25",
          topicIndex: 3,
          zoomInIndex: 27,
          zoomOutIndex: 4,
          id: "s30-8",
        },
        {
          topic: "TRAVEL TO EUROPE",
          description:
            "When we went to Europe, it was very like Greece, Italy, and all of the very historical stuff.",
          segment:
            "is that like fairy tales are mixed off of like the castles and everything oh that's cute i like that yeah because yeah that'd be dope we did a very like when we went to Europe it was we kind of just threw Paris in there because we could but it was very like greece italy and like all of the very historical stuff like right greek roman mythology or like sort of those empires those times which was great like",
          time: "17:18:55",
          topicIndex: 3,
          zoomInIndex: 30,
          zoomOutIndex: 4,
          id: "s30-9",
        },
        {
          topic: "TRAVEL WISHLIST",
          description:
            "That was also on my bucket list, so I'm not upset about that.",
          segment:
            "That was also on my bucket list, so I'm not upset about that, but the next thing I'd want to do is kind of see some of that more. I guess what we would consider like romantic history. Right. Yeah, that would be really cool. I think you already got to see like you went to the Louvre and everything, right? Yeah",
          time: "17:19:25",
          topicIndex: 4,
          zoomInIndex: 33,
          zoomOutIndex: 5,
          id: "s30-10",
        },
        {
          topic: "PARIS TOURISM",
          description:
            "Honestly, I'd say Paris is worth going to if you just want to go for the tourist attractions.",
          segment:
            "Honestly, I'd say Paris is worth going to if you just want to go for the tourist attractions. And I heard it's like open to the public. if you live there but like in terms of like Paris being the most romantic city in the world I think If you go on with that mindset, you're going to be disappointed. Yeah, I've heard it's actually like really, like, kind of dirty, everyone. Kind of. They're root to tourists, I think.",
          time: "17:19:55",
          topicIndex: 4,
          zoomInIndex: 36,
          zoomOutIndex: 5,
          id: "s30-11",
        },
        {
          topic: "TRAVEL",
          description:
            "Oh my god I want to go back to Australia so badly it was so cool I loved it.",
          segment:
            "They don't like tourists. Yeah, that's what I heard. Which is fair, but then it's also like, you've never been a tourist anywhere, like, I don't know. mm-hmm I also want to go to Australia oh my god I want to go back to Australia so badly it was so cool I loved it Yeah, it sounds so cool, it looks so beautiful. Have I given you any of the postcards or anything that I've collected for you?",
          time: "17:20:25",
          topicIndex: 5,
          zoomInIndex: 39,
          zoomOutIndex: 6,
          id: "s30-12",
        },
        {
          topic: "POSTCARD COLLECTION",
          description:
            "I have a collection of postcards of places I've never been, but I will go.",
          segment:
            "Um, I, I remember you gave me the one. Yeah. I, but I'm pretty sure I grabbed some stuff for you when I was. But I love that you think of me, like that's so cute because now I just have a crush on. I have a collection of postcards of places I've never been, but I will go.",
          time: "17:20:55",
          topicIndex: 5,
          zoomInIndex: 42,
          zoomOutIndex: 6,
          id: "s30-13",
        },
        {
          topic: "TRAVEL INSPIRATION",
          description:
            "Now you can look at that and be like, 'I didn't know this place existed, but it's super pretty, so I'm going to go here.'",
          segment:
            "oh this is so pretty i gotta go now and it's also i try to get the like ones that are very specific to like the places that i see i guess that are just like Australia or like whatever looks perfect yeah so like the meteor one once I thought were really pretty so now you can look at that be like know this place existed but it's super pretty so I'm going to go here because I have a postcard of the ocean yeah I totally want to do that I want to like travel I want",
          time: "17:21:25",
          topicIndex: 6,
          zoomInIndex: 45,
          zoomOutIndex: 7,
          id: "s30-14",
        },
      ],
      m1: [
        {
          topic: "SKYDIVING",
          description:
            "Yeah no she was like let's go skydiving like right now and I was just like I've never even thought about this before what do you mean?",
          segment:
            "time to mentally prepare i was not ready but she was ready oh my gosh um yeah no she was like let's go skydiving like right now and I was just like I've never even thought about this before what do you mean? Yeah I thought she was like joking at first or like by how soon she wanted to go. And I. In between to. She's very much like that, like she asked me a couple times and I was always like oh like I'll think about it whatever and then she's like okay enough is enough and she just went and did it which is crazy I was Oh, do you think Emmanuel would go with you? Well, I don't know cuz like he's I I think he would cuz he's definitely like an adrenaline junkie to a certain extent, like he really likes to do that type of stuff, but I mean honestly, yeah probably.time to mentally prepare i was not ready but she was ready oh my gosh um yeah no she was like let's go skydiving like right now and i was just like i've never even thought about this before what do you mean? yeah i thought she was like joking at first or like by how soon she wanted to go. and i. in between to. she's very much like that, like she asked me a couple times and i was always like oh like i'll think about it whatever and then she's like okay enough is enough and she just went and did it which is crazy i was oh, do you think emmanuel would go with you? well, i don't know cuz like he's i i think he would cuz he's definitely like an adrenaline junkie to a certain extent, like he really likes to do that type of stuff, but i mean honestly, yeah probably.bro, i, the thing is like i want to but i'm also like there's just so many implications of going because it's like like, yeah, you're with the instructor, but like, things can always go wrong, you know what i mean? yeah. ",
          time: "17:14:05",
          topicIndex: 0,
          zoomInIndex: 2,
          zoomOutIndex: 0,
          id: "m1-0",
        },
        {
          topic: "MOTORCYCLE LICENSE",
          description: "I want to get my actual motorcycle license.",
          segment:
            "Bro, I, the thing is like I want to but I'm also like there's just so many implications of going because it's like Like, yeah, you're with the instructor, but like, things can always go wrong, you know what I mean? Yeah. But, um, another thing is like, I want to get My actual motorcycle license. I'm gonna be one of those girls. You've been talking about that for so long. Sorry? I said you've been talking about that for like two years. Let me tell you why. Okay, because I did do the lessons, right? And like, it was fine, whatever. But the thing is, like, you can't practice without a license. And like, the way you get the license is with a driven test. So it's not like where you can get a learner's and have someone that you can drive with someone is there with you. Right? fully lengthened you can't do that with a motorcycle right and then it's also like do I really want to invest like 3-4k in a bike and I'm still learning and like what happens if I drop it or like",
          time: "17:15:55",
          topicIndex: 1,
          zoomInIndex: 4,
          zoomOutIndex: 0,
          id: "m1-1",
        },
        {
          topic: "BIKING CONCERNS",
          description:
            "I need to either rent one at my lessons place and like be able to get decent or I have to buy one and be like incredibly careful.",
          segment:
            "You know, there's like lots of things that can ruin a bike. Yeah. So, you know what I mean? So it's like, I need to either be able to rent one at my... lessons place and like be able to get decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet because even if you rent one and you damage it, that's still okay. I feel like that would still cost you money, right? Well, it's a little different, because like when I did lessons I did end up like crashing or not crashing but I did drop two bikes but they couldn't charge me because it's included in the fee. You guys could probably put some like guards on there and stuff too to make sure that it doesn't get completely busted, yeah.",
          time: "17:16:55",
          topicIndex: 2,
          zoomInIndex: 6,
          zoomOutIndex: 0,
          id: "m1-2",
        },
        {
          topic: "TRAVEL EXPERIENCES",
          description:
            "I always really wanted to go like, you know in those caves behind the waterfalls.",
          segment:
            "couple years. Okay. I see you. I haven't really, I mean, the one thing that was on my bucket list for a really long time, but I did it when I was in Singapore. No, when I went to Indonesia. Um, yeah. Was I always really wanted to go like, you know in those caves behind the waterfalls? Oh, yeah, yeah. Yeah, I always wanted to do that, and then I got to do it when I was in Indonesia. It was kind of must-see, to be honest, but it was so cool. I didn't know it was, like, this big, musty cave hole. I mean, it's a big cave with, like, an eternal flow of water coming down and splashing into the dark, damp cave. Okay, yeah, well you put it like that. Honestly, okay, to be fair, I kind of didn't expect it either, but then I was like, yeah, I don't really know what I was expecting. Yeah, I know. What about like, traveling? Like, would you ever go to Egypt? Egypt? Yes. I would want to go to Egypt.",
          time: "17:17:55",
          topicIndex: 2,
          zoomInIndex: 8,
          zoomOutIndex: 0,
          id: "m1-3",
        },
        {
          topic: "TRAVEL TO EUROPE",
          description:
            "But, it's definitely something I want to do eventually.",
          segment:
            "yeah I feel like going to those parts of the world especially like as a woman you kind of have to take more precautions okay yeah that's true But, it's definitely something I want to do eventually. I want to go back to Europe. Oh, yeah. Oh, I want to go to, um, like, Germany or like those... Little provinces in France that are Paris and like I just want to go to like those. is that like fairy tales are mixed off of like the castles and everything oh that's cute i like that yeah because yeah that'd be dope we did a very like when we went to Europe it was we kind of just threw Paris in there because we could but it was very like greece italy and like all of the very historical stuff like right greek roman mythology or like sort of those empires those times which was great like",
          time: "17:18:55",
          topicIndex: 3,
          zoomInIndex: 10,
          zoomOutIndex: 0,
          id: "m1-4",
        },
        {
          topic: "PARIS TOURISM",
          description:
            "Honestly, I'd say Paris is worth going to if you just want to go for the tourist attractions.",
          segment:
            "That was also on my bucket list, so I'm not upset about that, but the next thing I'd want to do is kind of see some of that more. I guess what we would consider, like romantic history. Right. Yeah, that would be really cool. I think you already got to see like you went to the Louvre and everything, right? Yeah. Honestly, I'd say Paris is worth going to if you just want to go for the tourist attractions. And I heard it's like open to the public. if you live there but like in terms of like Paris being the most romantic city in the world I think If you go on with that mindset, you're going to be disappointed. Yeah, I've heard it's actually like really, like, kind of dirty, everyone. Kind of. They're rude to tourists, I think.",
          time: "17:19:55",
          topicIndex: 4,
          zoomInIndex: 12,
          zoomOutIndex: 1,
          id: "m1-5",
        },
        {
          topic: "TRAVEL",
          description:
            "I also want to go to Australia oh my god I want to go back to Australia so badly it was so cool I loved it.",
          segment:
            "They don't like tourists. Yeah, that's what I heard. Which is fair, but then it's also like, you've never been a tourist anywhere, like, I don't know. mm-hmm I also want to go to Australia oh my god I want to go back to Australia so badly it was so cool I loved it Yeah, it sounds so cool, it looks so beautiful. Have I given you any of the postcards or anything that I've collected for you? Um, I, I remember you gave me the one. Yeah. I, but I'm pretty sure I grabbed some stuff for you when I was. But I love that you think of me, like that's so cute because now I just have a crush on. I have a collection of postcards of places I've never been, but I will go.",
          time: "17:20:55",
          topicIndex: 5,
          zoomInIndex: 14,
          zoomOutIndex: 1,
          id: "m1-6",
        },
      ],
      m5: [
        {
          topic: "SKYDIVING READINESS",
          description:
            "She was like let's go skydiving like right now and I was just like I've never even thought about this before.",
          segment:
            "time to mentally prepare i was not ready but she was ready oh my gosh um yeah no she was like let's go skydiving like right now and I was just like I've never even thought about this before what do you mean? Yeah I thought she was like joking at first or like by how soon she wanted to go. And I. In between to. She's very much like that, like she asked me a couple times and I was always like oh like I'll think about it whatever and then she's like okay enough is enough and she just went and did it which is crazy I was Oh, do you think Emmanuel would go with you? Well, I don't know cuz like he's I I think he would cuz he's definitely like an adrenaline junkie to a certain extent, like he really likes to do that type of stuff, but I mean honestly, yeah probably.",
          time: "17:18:55",
          topicIndex: 4,
          zoomInIndex: 5,
          zoomOutIndex: null,
          id: "m5-0",
        },
      ],
      topics: [
        {
          topic: "SKYDIVING",
          description: "Skydiving -> Adrenaline Junkie -> Risk Assessment",
          segment:
            "time to mentally prepare i was not ready but she was ready oh my gosh um yeah no she was like let's go skydiving like right now and I was just like I've never even thought about this before what do you mean? Yeah I thought she was like joking at first or like by how soon she wanted to go. And I. In between to. She's very much like that, like she asked me a couple times and I was always like oh like I'll think about it whatever and then she's like okay enough is enough and she just went and did it which is crazy I was Oh, do you think Emmanuel would go with you? Well, I don't know cuz like he's I I think he would cuz he's definitely like an adrenaline junkie to a certain extent, like he really likes to do that type of stuff, but I mean honestly, yeah probably.time to mentally prepare i was not ready but she was ready oh my gosh um yeah no she was like let's go skydiving like right now and i was just like i've never even thought about this before what do you mean? yeah i thought she was like joking at first or like by how soon she wanted to go. and i. in between to. she's very much like that, like she asked me a couple times and i was always like oh like i'll think about it whatever and then she's like okay enough is enough and she just went and did it which is crazy i was oh, do you think emmanuel would go with you? well, i don't know cuz like he's i i think he would cuz he's definitely like an adrenaline junkie to a certain extent, like he really likes to do that type of stuff, but i mean honestly, yeah probably.bro, i, the thing is like i want to but i'm also like there's just so many implications of going because it's like like, yeah, you're with the instructor, but like, things can always go wrong, you know what i mean? yeah. ",
          time: "17:14:05",
          totalSeconds: 97,
          subTopics: ["Skydiving", "Adrenaline Junkie", "Risk Assessment"],
          zoomInIndex: 0,
          zoomOutIndex: 0,
          id: "topics-0",
        },
        {
          topic: "MOTORCYCLE LICENSING CHALLENGES",
          description:
            "Motorcycle License -> Riding Lessons -> Bike Investment -> Rental vs. Ownership",
          segment:
            "but, um, another thing is like, i want to get my actual motorcycle license. i'm gonna be one of those girls. you've been talking about that for so long. sorry? i said you've been talking about that for like two years. let me tell you why. okay, because i did do the lessons, right? and like, it was fine, whatever. but the thing is, like, you can't practice without a license. and like, the way you get the license is with a driven test. so it's not like where you can get a learner's and have someone that you can drive with someone is there with you. right? fully lengthened you can't do that with a motorcycle right and then it's also like do i really want to invest like 3-4k in a bike and i'm still learning and like what happens if i drop it or likeYou know, there's like lots of things that can ruin a bike. Yeah. So, you know what I mean? So it's like, I need to either be able to rent one at my... lessons place and like be able to get decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet because even if you rent one and you damage it, that's still okay. I feel like that would still cost you money, right? Well, it's a little different, because like when I did lessons I did end up like crashing or not crashing but I did drop two bikes but they couldn't charge me because it's included in the fee. You guys could probably put some like guards on there and stuff too to make sure that it doesn't get completely busted, yeah.you know, there's like lots of things that can ruin a bike. yeah. so, you know what i mean? so it's like, i need to either be able to rent one at my... lessons place and like be able to get decent or i have to buy one and be like incredibly careful but i don't know if i trust myself enough yet because even if you rent one and you damage it, that's still okay. i feel like that would still cost you money, right? well, it's a little different, because like when i did lessons i did end up like crashing or not crashing but i did drop two bikes but they couldn't charge me because it's included in the fee. you guys could probably put some like guards on there and stuff too to make sure that it doesn't get completely busted, yeah.couple years. okay. i see you. ",
          time: "17:15:42",
          totalSeconds: 161,
          subTopics: [
            "Motorcycle License",
            "Riding Lessons",
            "Bike Investment",
            "Rental vs. Ownership",
          ],
          zoomInIndex: 1,
          zoomOutIndex: null,
          id: "topics-1",
        },
        {
          topic: "CAVE EXPLORATION",
          description: "Bucket List -> Waterfall Caves -> Indonesian Adventure",
          segment:
            "i haven't really, i mean, the one thing that was on my bucket list for a really long time, but i did it when i was in singapore. no, when i went to indonesia. um, yeah. was i always really wanted to go like, you know in those caves behind the waterfalls? oh, yeah, yeah. yeah, i always wanted to do that, and then i got to do it when i was in indonesia. it was kind of must-see, to be honest, but it was so cool. i didn't know it was, like, this big, musty cave hole. i mean, it's a big cave with, like, an eternal flow of water coming down and splashing into the dark, damp cave. okay, yeah, well you put it like that. honestly, okay, to be fair, i kind of didn't expect it either, but then i was like, yeah, i don't really know what i was expecting.i haven't really, i mean, the one thing that was on my bucket list for a really long time, but i did it when i was in singapore. no, when i went to indonesia. um, yeah. was i always really wanted to go like, you know in those caves behind the waterfalls? oh, yeah, yeah. yeah, i always wanted to do that, and then i got to do it when i was in indonesia. it was kind of must-see, to be honest, but it was so cool. i didn't know it was, like, this big, musty cave hole. i mean, it's a big cave with, like, an eternal flow of water coming down and splashing into the dark, damp cave. okay, yeah, well you put it like that. honestly, okay, to be fair, i kind of didn't expect it either, but then i was like, yeah, i don't really know what i was expecting.",
          time: "17:18:23",
          totalSeconds: 22,
          subTopics: ["Bucket List", "Waterfall Caves", "Indonesian Adventure"],
          zoomInIndex: 3,
          zoomOutIndex: null,
          id: "topics-2",
        },
        {
          topic: "TRAVEL DESTINATIONS",
          description:
            "Travel Precautions -> Europe Destinations -> Castles and Fairy Tales -> Greek and Roman Mythology",
          segment:
            "yeah i feel like going to those parts of the world especially like as a woman you kind of have to take more precautions okay yeah that's true but, it's definitely something i want to do eventually. i want to go back to europe. oh, yeah. oh, i want to go to, um, like, germany or like those... little provinces in france that are paris and like i just want to go to like those. is that like fairy tales are mixed off of like the castles and everything oh that's cute i like that yeah because yeah that'd be dope we did a very like when we went to europe it was we kind of just threw paris in there because we could but it was very like greece italy and like all of the very historical stuff like right greek roman mythology or like sort of those empires those times which was great likeyeah i feel like going to those parts of the world especially like as a woman you kind of have to take more precautions okay yeah that's true but, it's definitely something i want to do eventually. ",
          time: "17:18:45",
          totalSeconds: 70,
          subTopics: [
            "Travel Precautions",
            "Europe Destinations",
            "Castles and Fairy Tales",
            "Greek and Roman Mythology",
          ],
          zoomInIndex: 4,
          zoomOutIndex: null,
          id: "topics-3",
        },
        {
          topic: "EUROPEAN TRAVEL",
          description:
            "European travel -> Romantic history -> Castles and fairy tales -> Greek and Roman history -> Tourist perceptions",
          segment:
            "i want to go back to europe. oh, yeah. oh, i want to go to, um, like, germany or like those... little provinces in france that are paris and like i just want to go to like those. is that like fairy tales are mixed off of like the castles and everything oh that's cute i like that yeah because yeah that'd be dope we did a very like when we went to europe it was we kind of just threw paris in there because we could but it was very like greece italy and like all of the very historical stuff like right greek roman mythology or like sort of those empires those times which was great likethat was also on my bucket list, so i'm not upset about that, but the next thing i'd want to do is kind of see some of that more. i guess what we would consider, like romantic history. right. yeah, that would be really cool.i want to go back to europe. oh, yeah. oh, i want to go to, um, like, germany or like those... little provinces in france that are paris and like i just want to go to like those. is that like fairy tales are mixed off of like the castles and everything oh that's cute i like that yeah because yeah that'd be dope we did a very like when we went to europe it was we kind of just threw paris in there because we could but it was very like greece italy and like all of the very historical stuff like right greek roman mythology or like sort of those empires those times which was great likethat was also on my bucket list, so i'm not upset about that, but the next thing i'd want to do is kind of see some of that more. i guess what we would consider, like romantic history. right. yeah, that would be really cool.they don't like tourists. yeah, that's what i heard. which is fair, but then it's also like, you've never been a tourist anywhere, like, i don't know. mm-hmm ",
          time: "17:19:55",
          totalSeconds: 232,
          subTopics: [
            "European travel",
            "Romantic history",
            "Castles and fairy tales",
            "Greek and Roman history",
            "Tourist perceptions",
          ],
          zoomInIndex: 6,
          zoomOutIndex: null,
          id: "topics-4",
        },
        {
          topic: "POSTCARDS",
          // description:
          //   "have i given you any of the postcards or anything that i've collected for you?",
          segment:
            "have i given you any of the postcards or anything that i've collected for you? um, i, i remember you gave me the one. yeah. i, but i'm pretty sure i grabbed some stuff for you when i was. but i love that you think of me, like that's so cute because now i just have a crush on. i have a collection of postcards of places i've never been, but i will go.",
          description:
            "Postcard Collection -> Gift Giving -> Future Travel Plans",
          time: "17:23:47",
          totalSeconds: 150,
          subTopics: [
            "Postcard collection",
            "Gift-giving",
            "Future travel plans",
          ],
          zoomInIndex: 7,
          zoomOutIndex: null,
          id: "topics-5",
        },
      ],
    };
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
          topic: "ATTENDING AN EVENT TOGETHER",
          description: "I feel like you guys could go together then.",
          segment:
            "That type of stuff. But I mean, honestly, yeah, probably. I feel like you guys could go together then. That'd be cute.",
          time: "01:00:41",
          speakerTurns: {
            total: 22,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 22,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "That type of stuff. But I mean, honestly, yeah, probably. I feel like you guys could go together then. That'd be cute.",
                length: 22,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 2,
          id: "s10-6",
        },
        {
          topic: "MOTORCYCLE ASPIRATIONS",
          description:
            "I want to get my actual motorcycle license, maybe one of those for so long.",
          segment:
            "Want to, But I'm also like, there's just so many implications going and it's like like, yeah, you're with the instructor, but like things can always go. Yeah. But another thing is like I want to get my actual motorcycle license, maybe one of those for so long.",
          time: "01:00:52",
          speakerTurns: {
            total: 48,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 48,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Want to, But I'm also like, there's just so many implications going and it's like like, yeah, you're with the instructor, but like things can always go.",
                length: 27,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Yeah. But another thing is like I want to get my actual motorcycle license, maybe one of those for so long.",
                length: 21,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 2,
          id: "s10-7",
        },
        {
          topic: "APOLOGY",
          description: "Sorry.",
          segment: "Sorry.",
          time: "01:01:03",
          speakerTurns: {
            total: 1,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 1,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg: "Sorry.",
                length: 1,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 2,
          id: "s10-8",
        },
        {
          topic: "DRIVER'S LICENSE PROCESS",
          description:
            "Practice without a license and like the the way you get the license is with a driven test.",
          segment:
            "Practice without a license and like the the way you get the license is with a driven test. So it's like it's not like where you can get a learner's trip like.",
          time: "01:01:25",
          speakerTurns: {
            total: 32,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 32,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Practice without a license and like the the way you get the license is with a driven test. So it's like it's not like where you can get a learner's trip like.",
                length: 32,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 3,
          id: "s10-9",
        },
        {
          topic: "MOTORCYCLE INVESTMENT CONCERNS",
          description:
            "Do I really want to invest like 3-4 K in a bike and I'm still learning?",
          segment:
            "Is there with you, right, that's fully licensed. You can't do that with the motorcycle, right? And then it's also like, do I really want to invest like 3-4 K in a bike and I'm still learning and like what happens if I drop it or?",
          time: "01:01:36",
          speakerTurns: {
            total: 46,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 46,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Is there with you, right, that's fully licensed. You can't do that with the motorcycle, right? And then it's also like, do I really want to invest like 3-4 K in a bike and I'm still learning and like what happens if I drop it or?",
                length: 46,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 3,
          id: "s10-10",
        },
        {
          topic: "BIKE RENTAL",
          description:
            "So it's like I need to either be able to rent one at my lessons place.",
          segment:
            "Like lots of things that can ruin a bike. Yeah. So you know what I mean? So it's like I need to either be able to rent one at my lessons place.",
          time: "01:01:47",
          speakerTurns: {
            total: 32,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 32,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Like lots of things that can ruin a bike. Yeah. So you know what I mean? So it's like I need to either be able to rent one at my lessons place.",
                length: 32,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 3,
          id: "s10-11",
        },
        {
          topic: "SELF-DOUBT",
          description: "I don't know if I trust myself enough yet.",
          segment:
            "Decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet 'cause I feel like even if you rent one then that's. I feel like that would still cost you money, right?",
          time: "01:01:58",
          speakerTurns: {
            total: 43,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 43,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet 'cause I feel like even if you rent one then that's.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "I feel like that would still cost you money, right?",
                length: 10,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: null,
          zoomOutIndex: 4,
          id: "s10-12",
        },
        {
          topic: "LESSON EXPERIENCE",
          description:
            "Well, it's a little different 'cause like when I did my lessons I did end up like crashing.",
          segment:
            "Well, it's a little different 'cause like when I did my lessons I did end up like crashing.",
          time: "01:02:09",
          speakerTurns: {
            total: 18,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 18,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Well, it's a little different 'cause like when I did my lessons I did end up like crashing.",
                length: 18,
              },
            ],
          },
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 4,
          id: "s10-13",
        },
        {
          topic: "BIKE RENTAL FEE",
          description:
            "Drop 2 bikes, but they couldn't charge me because it's included in the fee.",
          segment:
            "Drop 2 bikes, but they couldn't charge me because it's included in the fee. Yeah, I mean, I guess they're probably somewhere on there and stuff to make sure that. It doesn't get completely.",
          time: "01:02:20",
          speakerTurns: {
            total: 34,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 30,
              },
              {
                speakerId: "Guest-3",
                length: 4,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Drop 2 bikes, but they couldn't charge me because it's included in the fee. Yeah, I mean, I guess they're probably somewhere on there and stuff to make sure that.",
                length: 30,
              },
              {
                speakerId: "Guest-3",
                speakerSeg: "It doesn't get completely.",
                length: 4,
              },
            ],
          },
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 4,
          id: "s10-14",
        },
        {
          topic: "BUCKET LIST ACHIEVEMENTS",
          description:
            "That was on my bucket list for a really long time, but I did it when I was in the same before, no when I went to Indonesia.",
          segment:
            "Honestly, I feel like I've achieved a lot of those things in the past couple of years. OK, that'll flex. I see you. I haven't really, I mean. That was on my bucket list for a really long time, but I did it when I was in the same before, no when I went to Indonesia.",
          time: "01:02:42",
          speakerTurns: {
            total: 56,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 28,
              },
              {
                speakerId: "Guest-3",
                length: 28,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Honestly, I feel like I've achieved a lot of those things in the past couple of years. OK, that'll flex. I see you. I haven't really, I mean.",
                length: 28,
              },
              {
                speakerId: "Guest-3",
                speakerSeg:
                  "That was on my bucket list for a really long time, but I did it when I was in the same before, no when I went to Indonesia.",
                length: 28,
              },
            ],
          },
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 5,
          id: "s10-15",
        },
        {
          topic: "TRAVEL AMBITIONS",
          description:
            "Was I always really wanted to go like, you know what, those caves.",
          segment:
            "Was I always really wanted to go like, you know what, those caves.",
          time: "01:02:53",
          speakerTurns: {
            total: 13,
            speakers: [
              {
                speakerId: "Guest-3",
                length: 13,
              },
            ],
            turns: [
              {
                speakerId: "Guest-3",
                speakerSeg:
                  "Was I always really wanted to go like, you know what, those caves.",
                length: 13,
              },
            ],
          },
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 5,
          id: "s10-16",
        },
        {
          topic: "MOVIE EXPERIENCE",
          description:
            "The movies I was kind of must need to be honest, but it was so cool.",
          segment:
            "Oh yeah, yeah, yeah. I always wanted to do that. And then I got to do. When I was. In the. The movies I was kind of must. Need to be honest, but it was so cool.",
          time: "01:03:04",
          speakerTurns: {
            total: 37,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 32,
              },
              {
                speakerId: "Guest-2",
                length: 5,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Oh yeah, yeah, yeah. I always wanted to do that. And then I got to do.",
                length: 16,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "When I was.",
                length: 3,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "In the.",
                length: 2,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "The movies I was kind of must.",
                length: 7,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Need to be honest, but it was so cool.",
                length: 9,
              },
            ],
          },
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 5,
          id: "s10-17",
        },
        {
          topic: "CAVE DESCRIPTION",
          description:
            "Oh, I mean it's a big cave with like an eternal flow of water coming down and splashing into the.",
          segment:
            "Please yes, I didn't know it was like it'd be musty. Oh, I mean it's a big cave with like an eternal flow of water coming down and splashing into the.",
          time: "01:03:15",
          speakerTurns: {
            total: 31,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 31,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Please yes, I didn't know it was like it'd be musty. Oh, I mean it's a big cave with like an eternal flow of water coming down and splashing into the.",
                length: 31,
              },
            ],
          },
          topicIndex: 2,
          zoomInIndex: null,
          zoomOutIndex: 6,
          id: "s10-18",
        },
        {
          topic: "UNEXPECTED REALIZATION",
          description:
            "But then I was like, yeah, I don't really know what I was doing.",
          segment:
            "OK, yeah, when you put it like that, honestly, OK, to be fair, I kind of didn't expect it either. But then I was like, yeah, I don't really know what I was doing.",
          time: "01:03:26",
          speakerTurns: {
            total: 34,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 34,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "OK, yeah, when you put it like that, honestly, OK, to be fair, I kind of didn't expect it either. But then I was like, yeah, I don't really know what I was doing.",
                length: 34,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 6,
          id: "s10-19",
        },
        {
          topic: "TRAVELING TO EGYPT",
          description: "What about, like traveling?",
          segment:
            "Yeah, I know. What about, like traveling? Like, would you ever go to Egypt? Egypt. You would want to go to Egypt, I feel like.",
          time: "01:03:37",
          speakerTurns: {
            total: 25,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 25,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Yeah, I know. What about, like traveling? Like, would you ever go to Egypt? Egypt. You would want to go to Egypt, I feel like.",
                length: 25,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 6,
          id: "s10-20",
        },
        {
          topic: "TRAVEL PRECAUTIONS FOR WOMEN",
          description:
            "Going to those parts of the world, especially, like as a woman, you kind of have to take more precautions.",
          segment:
            "Going to those parts of the world, especially, like as a woman, you kind of have to take more precautions. OK, yeah, that's true. Umm, that's true. But it's definitely something I wanted. Ohh yeah. Ohh I wanna go. To umm like.",
          time: "01:03:48",
          speakerTurns: {
            total: 42,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 35,
              },
              {
                speakerId: "Guest-1",
                length: 7,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Going to those parts of the world, especially, like as a woman, you kind of have to take more precautions. OK, yeah, that's true. Umm, that's true. But it's definitely something I wanted.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "Ohh yeah.",
                length: 2,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Ohh I wanna go.",
                length: 4,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "To umm like.",
                length: 3,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 7,
          id: "s10-21",
        },
        {
          topic: "EUROPEAN REGIONS",
          description:
            "Germany or like those little provinces in France that aren't Paris.",
          segment:
            "Germany. Or like those little provinces in France that aren't Paris.",
          time: "01:03:59",
          speakerTurns: {
            total: 11,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 11,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Germany. Or like those little provinces in France that aren't Paris.",
                length: 11,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 7,
          id: "s10-22",
        },
        {
          topic: "FAIRYTALE CITIES",
          description:
            "I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
          segment:
            "I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
          time: "01:04:09",
          speakerTurns: {
            total: 22,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 22,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
                length: 22,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 7,
          id: "s10-23",
        },
        {
          topic: "EUROPEAN TRAVEL",
          description:
            "Greece, Italy, and like all of the very historical stuff.",
          segment:
            "It's cute. I like that. Yeah, 'cause yeah, that'd be dope. We did a very like. When we went to Europe, it was we kind of just. But it was very late. Greece, Italy, and like all of the very historical stuff.",
          time: "01:04:20",
          speakerTurns: {
            total: 42,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 11,
              },
              {
                speakerId: "Guest-1",
                length: 31,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "It's cute. I like that. Yeah, 'cause yeah, that'd be dope.",
                length: 11,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "We did a very like.",
                length: 5,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "When we went to Europe, it was we kind of just.",
                length: 11,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "But it was very late.",
                length: 5,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Greece, Italy, and like all of the very historical stuff.",
                length: 10,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 8,
          id: "s10-24",
        },
        {
          topic: "PERSONAL BUCKET LIST",
          description:
            "Like that was also on my bucket list, so I'm not upset about that.",
          segment:
            "Like sort of those empires, those times, which was great. Like that was also on my bucket list, so I'm not upset about that. But the next thing I want to do is. To see some of that more I guess. What we?",
          time: "01:04:42",
          speakerTurns: {
            total: 43,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                length: 10,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Like sort of those empires, those times, which was great. Like that was also on my bucket list, so I'm not upset about that. But the next thing I want to do is.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "To see some of that more I guess.",
                length: 8,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "What we?",
                length: 2,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 8,
          id: "s10-25",
        },
        {
          topic: "PERSONAL REFLECTION",
          description: "My shadow, right?",
          segment: "My shadow, right?",
          time: "01:04:52",
          speakerTurns: {
            total: 3,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 3,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg: "My shadow, right?",
                length: 3,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 8,
          id: "s10-26",
        },
        {
          topic: "CHICAGO VISIT",
          description:
            "I think you already got to see like you went to the loop and everything, right?",
          segment:
            "Yeah, that, that'd be really cool. I think you already got to see like you went to the loop and everything, right? Yeah. So you also like, that's something.",
          time: "01:05:03",
          speakerTurns: {
            total: 29,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 29,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Yeah, that, that'd be really cool. I think you already got to see like you went to the loop and everything, right? Yeah. So you also like, that's something.",
                length: 29,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 9,
          id: "s10-27",
        },
        {
          topic: "PARIS TRAVEL OPINION",
          description:
            "Honestly I'd say Paris is worth going to if you just want to.",
          segment:
            "Honestly I'd say Paris is worth going to if you just want to. And I heard it's like OK if we live there but like.",
          time: "01:05:13",
          speakerTurns: {
            total: 25,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 25,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Honestly I'd say Paris is worth going to if you just want to.",
                length: 13,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "And I heard it's like OK if we live there but like.",
                length: 12,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: null,
          zoomOutIndex: 9,
          id: "s10-28",
        },
        
      ],
      s30: [
        {
          topic: "SPONTANEOUS SKYDIVING PLAN",
          description:
            "Yeah, she was like, let's go skydiving, like right now.",
          segment:
            "It's hard to mentally prepare. I was not ready when she was ready. Oh my gosh. Yeah, she was like, let's go skydiving, like right now. I've never even thought about this before. What do you mean? Yeah, I thought she was like joking at first, or like by how soon she wanted to go, but then. Pictures of her. And I was like, Oh yeah, OK, yeah, I thought. I thought that would be more time in between.",
          time: "00:59:36",
          speakerTurns: {
            total: 79,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 79,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "It's hard to mentally prepare. I was not ready when she was ready. Oh my gosh.",
                length: 16,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Yeah, she was like, let's go skydiving, like right now.",
                length: 10,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "I've never even thought about this before. What do you mean? Yeah, I thought she was like joking at first, or like by how soon she wanted to go, but then.",
                length: 31,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Pictures of her. And I was like, Oh yeah, OK, yeah, I thought. I thought that would be more time in between.",
                length: 22,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: 3,
          zoomOutIndex: 0,
          id: "s30-0",
        },
        {
          topic: "ADRENALINE ACTIVITY TALK",
          description:
            "I think he would 'cause he's definitely like an adrenaline junkie to a certain extent.",
          segment:
            "Yeah, like she's, she's very much like. Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think? Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
          time: "01:00:08",
          speakerTurns: {
            total: 73,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 7,
              },
              {
                speakerId: "Guest-2",
                length: 66,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg: "Yeah, like she's, she's very much like.",
                length: 7,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
                length: 38,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
                length: 28,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: 6,
          zoomOutIndex: 0,
          id: "s30-1",
        },
        {
          topic: "MOTORCYCLE LICENSE",
          description:
            "I want to get my actual motorcycle license, maybe one of those for so long.",
          segment:
            "That type of stuff. But I mean, honestly, yeah, probably. I feel like you guys could go together then. That'd be cute. Want to, But I'm also like, there's just so many implications going and it's like like, yeah, you're with the instructor, but like things can always go. Yeah. But another thing is like I want to get my actual motorcycle license, maybe one of those for so long. Sorry.",
          time: "01:00:41",
          speakerTurns: {
            total: 71,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 71,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "That type of stuff. But I mean, honestly, yeah, probably. I feel like you guys could go together then. That'd be cute.",
                length: 22,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Want to, But I'm also like, there's just so many implications going and it's like like, yeah, you're with the instructor, but like things can always go.",
                length: 27,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Yeah. But another thing is like I want to get my actual motorcycle license, maybe one of those for so long.",
                length: 21,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "Sorry.",
                length: 1,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: 9,
          zoomOutIndex: 1,
          id: "s30-2",
        },
        {
          topic: "MOTORCYCLE RIDING CHALLENGES",
          description:
            "Practice without a license and like the way you get the license is with a driven test.",
          segment:
            "Practice without a license and like the the way you get the license is with a driven test. So it's like it's not like where you can get a learner's trip like. Is there with you, right, that's fully licensed. You can't do that with the motorcycle, right? And then it's also like, do I really want to invest like 3-4 K in a bike and I'm still learning and like what happens if I drop it or? Like lots of things that can ruin a bike. Yeah. So you know what I mean? So it's like I need to either be able to rent one at my lessons place.",
          time: "01:01:25",
          speakerTurns: {
            total: 110,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 110,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Practice without a license and like the the way you get the license is with a driven test. So it's like it's not like where you can get a learner's trip like.",
                length: 32,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Is there with you, right, that's fully licensed. You can't do that with the motorcycle, right? And then it's also like, do I really want to invest like 3-4 K in a bike and I'm still learning and like what happens if I drop it or?",
                length: 46,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Like lots of things that can ruin a bike. Yeah. So you know what I mean? So it's like I need to either be able to rent one at my lessons place.",
                length: 32,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: 12,
          zoomOutIndex: 1,
          id: "s30-3",
        },
        {
          topic: "MOTORCYCLE LESSONS",
          description:
            "Well, it's a little different 'cause like when I did my lessons I did end up like crashing.",
          segment:
            "Decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet 'cause I feel like even if you rent one then that's. I feel like that would still cost you money, right? Well, it's a little different 'cause like when I did my lessons I did end up like crashing. Drop 2 bikes, but they couldn't charge me because it's included in the fee.",
          time: "01:01:58",
          speakerTurns: {
            total: 95,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 91,
              },
              {
                speakerId: "Guest-3",
                length: 4,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet 'cause I feel like even if you rent one then that's.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "I feel like that would still cost you money, right?",
                length: 10,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Well, it's a little different 'cause like when I did my lessons I did end up like crashing.",
                length: 18,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Drop 2 bikes, but they couldn't charge me because it's included in the fee. Yeah, I mean, I guess they're probably somewhere on there and stuff to make sure that.",
                length: 30,
              },
              {
                speakerId: "Guest-3",
                speakerSeg: "It doesn't get completely.",
                length: 4,
              },
            ],
          },
          topicIndex: 2,
          zoomInIndex: 15,
          zoomOutIndex: 2,
          id: "s30-4",
        },
        {
          topic: "TRAVEL EXPERIENCES",
          description: "I always wanted to do that, and then I got to do.",
          segment:
            "Honestly, I feel like I've achieved a lot of those things in the past couple of years. OK, that'll flex. I see you. I haven't really, I mean. That was on my bucket list for a really long time, but I did it when I was in the same before, no when I went to Indonesia. Was I always really wanted to go like, you know what, those caves. Oh yeah, yeah, yeah. I always wanted to do that. And then I got to do. When I was. In the. The movies I was kind of must. Need to be honest, but it was so cool.",
          time: "01:02:42",
          speakerTurns: {
            total: 106,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 33,
              },
              {
                speakerId: "Guest-3",
                length: 41,
              },
              {
                speakerId: "Guest-1",
                length: 32,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Honestly, I feel like I've achieved a lot of those things in the past couple of years. OK, that'll flex. I see you. I haven't really, I mean.",
                length: 28,
              },
              {
                speakerId: "Guest-3",
                speakerSeg:
                  "That was on my bucket list for a really long time, but I did it when I was in the same before, no when I went to Indonesia.",
                length: 28,
              },
              {
                speakerId: "Guest-3",
                speakerSeg:
                  "Was I always really wanted to go like, you know what, those caves.",
                length: 13,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Oh yeah, yeah, yeah. I always wanted to do that. And then I got to do.",
                length: 16,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "When I was.",
                length: 3,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "In the.",
                length: 2,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "The movies I was kind of must.",
                length: 7,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Need to be honest, but it was so cool.",
                length: 9,
              },
            ],
          },
          topicIndex: 2,
          zoomInIndex: 18,
          zoomOutIndex: 2,
          id: "s30-5",
        },
        {
          topic: "CAVE DESCRIPTION",
          description:
            "It's a big cave with like an eternal flow of water coming down and splashing into the.",
          segment:
            "Please yes, I didn't know it was like it'd be musty. Oh, I mean it's a big cave with like an eternal flow of water coming down and splashing into the. OK, yeah, when you put it like that, honestly, OK, to be fair, I kind of didn't expect it either. But then I was like, yeah, I don't really know what I was doing.",
          time: "01:03:15",
          speakerTurns: {
            total: 90,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 31,
              },
              {
                speakerId: "Guest-2",
                length: 59,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Please yes, I didn't know it was like it'd be musty. Oh, I mean it's a big cave with like an eternal flow of water coming down and splashing into the.",
                length: 31,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "OK, yeah, when you put it like that, honestly, OK, to be fair, I kind of didn't expect it either. But then I was like, yeah, I don't really know what I was doing.",
                length: 34,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Yeah, I know. What about, like traveling? Like, would you ever go to Egypt? Egypt. You would want to go to Egypt, I feel like.",
                length: 25,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: 21,
          zoomOutIndex: 3,
          id: "s30-6",
        },
        {
          topic: "TRAVEL DESTINATIONS",
          description:
            "I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
          segment:
            "To umm like. Germany. Or like those little provinces in France that aren't Paris. I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
          time: "01:03:48",
          speakerTurns: {
            total: 75,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 35,
              },
              {
                speakerId: "Guest-1",
                length: 40,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Going to those parts of the world, especially, like as a woman, you kind of have to take more precautions. OK, yeah, that's true. Umm, that's true. But it's definitely something I wanted.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "Ohh yeah.",
                length: 2,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Ohh I wanna go.",
                length: 4,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "To umm like.",
                length: 3,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Germany. Or like those little provinces in France that aren't Paris.",
                length: 11,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
                length: 22,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: 24,
          zoomOutIndex: 3,
          id: "s30-7",
        },
        {
          topic: "TRAVEL EXPERIENCES",
          description: "We did a very like.",
          segment:
            "It's cute. I like that. Yeah, 'cause yeah, that'd be dope. We did a very like. When we went to Europe, it was we kind of just. But it was very late. Greece, Italy, and like all of the very historical stuff. Like sort of those empires, those times, which was great. Like that was also on my bucket list, so I'm not upset about that.",
          time: "01:04:20",
          speakerTurns: {
            total: 88,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 24,
              },
              {
                speakerId: "Guest-1",
                length: 64,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "It's cute. I like that. Yeah, 'cause yeah, that'd be dope.",
                length: 11,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "We did a very like.",
                length: 5,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "When we went to Europe, it was we kind of just.",
                length: 11,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "But it was very late.",
                length: 5,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Greece, Italy, and like all of the very historical stuff.",
                length: 10,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Like sort of those empires, those times, which was great. Like that was also on my bucket list, so I'm not upset about that. But the next thing I want to do is.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "To see some of that more I guess.",
                length: 8,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "What we?",
                length: 2,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "My shadow, right?",
                length: 3,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: 27,
          zoomOutIndex: 4,
          id: "s30-8",
        },
      ],
      m1: [
        {
          topic: "SKYDIVING INVITATION",
          description:
            "Yeah, she was like, let's go skydiving, like right now.",
          segment:
            "It's hard to mentally prepare. I was not ready when she was ready. Oh my gosh. Yeah, she was like, let's go skydiving, like right now. I've never even thought about this before. What do you mean? Yeah, I thought she was like joking at first, or like by how soon she wanted to go, but then. Pictures of her. And I was like, Oh yeah, OK, yeah, I thought. I thought that would be more time in between. Yeah, like she's, she's very much like. Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think? Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
          time: "00:59:36",
          speakerTurns: {
            total: 152,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 86,
              },
              {
                speakerId: "Guest-2",
                length: 66,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "It's hard to mentally prepare. I was not ready when she was ready. Oh my gosh.",
                length: 16,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Yeah, she was like, let's go skydiving, like right now.",
                length: 10,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "I've never even thought about this before. What do you mean? Yeah, I thought she was like joking at first, or like by how soon she wanted to go, but then.",
                length: 31,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Pictures of her. And I was like, Oh yeah, OK, yeah, I thought. I thought that would be more time in between.",
                length: 22,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Yeah, like she's, she's very much like.",
                length: 7,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
                length: 38,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
                length: 28,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "That type of stuff. But I mean, honestly, yeah, probably. I feel like you guys could go together then. That'd be cute.",
                length: 22,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Want to, But I'm also like, there's just so many implications going and it's like like, yeah, you're with the instructor, but like things can always go.",
                length: 27,
              },
            ],
          },
          topicIndex: 0,
          zoomInIndex: 2,
          zoomOutIndex: 0,
          id: "m1-0",
        },
        {
          topic: "MOTORCYCLE LICENSING AND RENTAL",
          description:
            "I want to get my actual motorcycle license, maybe one of those for so long.",
          segment:
            "Want to, but I'm also like, there's just so many implications going and it's like like, yeah, you're with the instructor, but like things can always go. Yeah. But another thing is like I want to get my actual motorcycle license, maybe one of those for so long. Sorry. Practice without a license and like the the way you get the license is with a driven test. So it's like it's not like where you can get a learner's trip like. Is there with you, right, that's fully licensed. You can't do that with the motorcycle, right? And then it's also like, do I really want to invest like 3-4 K in a bike and I'm still learning and like what happens if I drop it or? Like lots of things that can ruin a bike. Yeah. So you know what I mean? So it's like I need to either be able to rent one at my lessons place.",
          time: "01:00:41",
          speakerTurns: {
            total: 181,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 181,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "That type of stuff. But I mean, honestly, yeah, probably. I feel like you guys could go together then. That'd be cute.",
                length: 22,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Want to, But I'm also like, there's just so many implications going and it's like like, yeah, you're with the instructor, but like things can always go.",
                length: 27,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Yeah. But another thing is like I want to get my actual motorcycle license, maybe one of those for so long.",
                length: 21,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "Sorry.",
                length: 1,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Practice without a license and like the the way you get the license is with a driven test. So it's like it's not like where you can get a learner's trip like.",
                length: 32,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Is there with you, right, that's fully licensed. You can't do that with the motorcycle, right? And then it's also like, do I really want to invest like 3-4 K in a bike and I'm still learning and like what happens if I drop it or?",
                length: 46,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Like lots of things that can ruin a bike. Yeah. So you know what I mean? So it's like I need to either be able to rent one at my lessons place.",
                length: 32,
              },
            ],
          },
          topicIndex: 1,
          zoomInIndex: 4,
          zoomOutIndex: 0,
          id: "m1-1",
        },
        {
          topic: "ACHIEVEMENTS",
          description:
            "Honestly, I feel like I've achieved a lot of those things in the past couple of years.",
          segment:
            "Honestly, I feel like I've achieved a lot of those things in the past couple of years. OK, that'll flex. I see you. I haven't really, I mean. That was on my bucket list for a really long time, but I did it when I was in the same before, no when I went to Indonesia. Was I always really wanted to go like, you know what, those caves. Oh yeah, yeah, yeah. I always wanted to do that. And then I got to do. When I was. In the. The movies I was kind of must. Need to be honest, but it was so cool.",
          time: "01:01:58",
          speakerTurns: {
            total: 201,
            speakers: [
              {
                speakerId: "Guest-2",
                length: 124,
              },
              {
                speakerId: "Guest-3",
                length: 45,
              },
              {
                speakerId: "Guest-1",
                length: 32,
              },
            ],
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet 'cause I feel like even if you rent one then that's.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "I feel like that would still cost you money, right?",
                length: 10,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Well, it's a little different 'cause like when I did my lessons I did end up like crashing.",
                length: 18,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Drop 2 bikes, but they couldn't charge me because it's included in the fee. Yeah, I mean, I guess they're probably somewhere on there and stuff to make sure that.",
                length: 30,
              },
              {
                speakerId: "Guest-3",
                speakerSeg: "It doesn't get completely.",
                length: 4,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Honestly, I feel like I've achieved a lot of those things in the past couple of years. OK, that'll flex. I see you. I haven't really, I mean.",
                length: 28,
              },
              {
                speakerId: "Guest-3",
                speakerSeg:
                  "That was on my bucket list for a really long time, but I did it when I was in the same before, no when I went to Indonesia.",
                length: 28,
              },
              {
                speakerId: "Guest-3",
                speakerSeg:
                  "Was I always really wanted to go like, you know what, those caves.",
                length: 13,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Oh yeah, yeah, yeah. I always wanted to do that. And then I got to do.",
                length: 16,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "When I was.",
                length: 3,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "In the.",
                length: 2,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "The movies I was kind of must.",
                length: 7,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Need to be honest, but it was so cool.",
                length: 9,
              },
            ],
          },
          topicIndex: 2,
          zoomInIndex: 6,
          zoomOutIndex: 0,
          id: "m1-2",
        },
        {
          topic: "TRAVEL DESIRES",
          description:
            "What about, like traveling? Like, would you ever go to Egypt?",
          segment:
            "What about, like traveling? Like, would you ever go to Egypt? Egypt. You would want to go to Egypt, I feel like. Going to those parts of the world, especially, like as a woman, you kind of have to take more precautions. OK, yeah, that's true. Umm, that's true. But it's definitely something I wanted. Ohh yeah. Ohh I wanna go. To umm like. Germany. Or like those little provinces in France that aren't Paris. I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
          time: "01:03:15",
          speakerTurns: {
            total: 165,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 71,
              },
              {
                speakerId: "Guest-2",
                length: 94,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Please yes, I didn't know it was like it'd be musty. Oh, I mean it's a big cave with like an eternal flow of water coming down and splashing into the.",
                length: 31,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "OK, yeah, when you put it like that, honestly, OK, to be fair, I kind of didn't expect it either. But then I was like, yeah, I don't really know what I was doing.",
                length: 34,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Yeah, I know. What about, like traveling? Like, would you ever go to Egypt? Egypt. You would want to go to Egypt, I feel like.",
                length: 25,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Going to those parts of the world, especially, like as a woman, you kind of have to take more precautions. OK, yeah, that's true. Umm, that's true. But it's definitely something I wanted.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "Ohh yeah.",
                length: 2,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Ohh I wanna go.",
                length: 4,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "To umm like.",
                length: 3,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Germany. Or like those little provinces in France that aren't Paris.",
                length: 11,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
                length: 22,
              },
            ],
          },
          topicIndex: 3,
          zoomInIndex: 8,
          zoomOutIndex: 0,
          id: "m1-3",
        },
      ],
      m5: [],
      topics: [
        {
          topic: "SKYDIVING INVITATION",
          description:
            "Unplanned Skydiving Proposal -> Initial Shock and Hesitation -> Adrenaline Junkie's Perspective -> Safety Concerns",
          segment:
            "It's hard to mentally prepare. I was not ready when she was ready. Oh my gosh. Yeah, she was like, let's go skydiving, like right now. I've never even thought about this before. What do you mean? Yeah, I thought she was like joking at first, or like by how soon she wanted to go, but then. Pictures of her. And I was like, Oh yeah, OK, yeah, I thought. I thought that would be more time in between. Yeah, like she's, she's very much like. Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think? Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.it's hard to mentally prepare. i was not ready when she was ready. oh my gosh. yeah, she was like, let's go skydiving, like right now. i've never even thought about this before. what do you mean? yeah, i thought she was like joking at first, or like by how soon she wanted to go, but then. pictures of her. and i was like, oh yeah, ok, yeah, i thought. i thought that would be more time in between. yeah, like she's, she's very much like. couple times and i was always like, oh, like i'll think about it, whatever. and then she's like ok, enough is enough. and she just went into this, which is crazy. i was like, oh, do you think? bro, i don't know, 'cause like he's i, i think he would 'cause he's definitely like an adrenaline junkie to a certain extent. like he really likes it.want to, but i'm also like, there's just so many implications going and it's like like, yeah, you're with the instructor, but like things can always go. yeah. ",
          time: "00:59:36",
          speakerTurns: {
            total: 207,
            speakers: [
              {
                speakerId: "Guest-1",
                length: 86,
              },
              {
                speakerId: "Guest-2",
                length: 66,
              },
            ],
            turns: [
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "It's hard to mentally prepare. I was not ready when she was ready. Oh my gosh.",
                length: 16,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Yeah, she was like, let's go skydiving, like right now.",
                length: 10,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "I've never even thought about this before. What do you mean? Yeah, I thought she was like joking at first, or like by how soon she wanted to go, but then.",
                length: 31,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Pictures of her. And I was like, Oh yeah, OK, yeah, I thought. I thought that would be more time in between.",
                length: 22,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Yeah, like she's, she's very much like.",
                length: 7,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Couple times and I was always like, oh, like I'll think about it, whatever. And then she's like OK, enough is enough. And she just went into this, which is crazy. I was like, oh, do you think?",
                length: 38,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Bro, I don't know, 'cause like he's I, I think he would 'cause he's definitely like an adrenaline junkie to a certain extent. Like he really likes it.",
                length: 28,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "That type of stuff. But I mean, honestly, yeah, probably. I feel like you guys could go together then. That'd be cute.",
                length: 22,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Want to, But I'm also like, there's just so many implications going and it's like like, yeah, you're with the instructor, but like things can always go.",
                length: 27,
              },
            ],
          },
          totalSeconds: 60,
          zoomInIndex: 1,
          zoomOutIndex: null,
          id: "topics-0",
        },
        {
          topic: "MOTORCYCLE LICENSE CHALLENGES",
          description:
            "Motorcycle License Aspiration -> License Practice Challenges -> Driven Test Requirement",
          segment:
            "but another thing is like i want to get my actual motorcycle license, maybe one of those for so long. sorry. practice without a license and like the the way you get the license is with a driven test. so it's like it's not like where you can get a learner's trip like. is there with you, right, that's fully licensed. you can't do that with the motorcycle, right?but another thing is like i want to get my actual motorcycle license, maybe one of those for so long. sorry. practice without a license and like the the way you get the license is with a driven test. so it's like it's not like where you can get a learner's trip like. is there with you, right, that's fully licensed. you can't do that with the motorcycle, right?",
          time: "01:01:50",
          totalSeconds: 29,
          speakerTurns: {
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Yeah. But another thing is like I want to get my actual motorcycle license, maybe one of those for so long.",
                length: 21,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "Sorry.",
                length: 1,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Practice without a license and like the the way you get the license is with a driven test. So it's like it's not like where you can get a learner's trip like.",
                length: 32,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Is there with you, right, that's fully licensed. You can't do that with the motorcycle, right? And then it's also like, do I really want to invest like 3-4 K in a bike and I'm still learning and like what happens if I drop it or?",
                length: 46,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Like lots of things that can ruin a bike. Yeah. So you know what I mean? So it's like I need to either be able to rent one at my lessons place.",
                length: 32,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Decent or I have to buy one and be like incredibly careful but I don't know if I trust myself enough yet 'cause I feel like even if you rent one then that's.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "I feel like that would still cost you money, right?",
                length: 10,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Well, it's a little different 'cause like when I did my lessons I did end up like crashing.",
                length: 18,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Drop 2 bikes, but they couldn't charge me because it's included in the fee. Yeah, I mean, I guess they're probably somewhere on there and stuff to make sure that.",
                length: 30,
              },
              {
                speakerId: "Guest-3",
                speakerSeg: "It doesn't get completely.",
                length: 4,
              },
            ],
            total: 233,
          },
          zoomInIndex: 2,
          zoomOutIndex: null,
          id: "topics-1",
        },
        {
          topic: "BUCKET LIST TRAVEL EXPERIENCES",
          description:
            "Recent Achievements -> Indonesia Caves -> Egypt Travel Interest -> Germany and France Desires",
          segment:
            "honestly, i feel like i've achieved a lot of those things in the past couple of years. ok, that'll flex. i see you. i haven't really, i mean. that was on my bucket list for a really long time, but i did it when i was in the same before, no when i went to indonesia. was i always really wanted to go like, you know what, those caves. oh yeah, yeah, yeah. i always wanted to do that. and then i got to do. when i was. in the. the movies i was kind of must. need to be honest, but it was so cool.What about, like traveling? Like, would you ever go to Egypt? Egypt. You would want to go to Egypt, I feel like. Going to those parts of the world, especially, like as a woman, you kind of have to take more precautions. OK, yeah, that's true. Umm, that's true. But it's definitely something I wanted. Ohh yeah. Ohh I wanna go. To umm like. Germany. Or like those little provinces in France that aren't Paris. I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
          time: "01:02:54",
          totalSeconds: 104,
          speakerTurns: {
            turns: [
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Honestly, I feel like I've achieved a lot of those things in the past couple of years. OK, that'll flex. I see you. I haven't really, I mean.",
                length: 28,
              },
              {
                speakerId: "Guest-3",
                speakerSeg:
                  "That was on my bucket list for a really long time, but I did it when I was in the same before, no when I went to Indonesia.",
                length: 28,
              },
              {
                speakerId: "Guest-3",
                speakerSeg:
                  "Was I always really wanted to go like, you know what, those caves.",
                length: 13,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Oh yeah, yeah, yeah. I always wanted to do that. And then I got to do.",
                length: 16,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "When I was.",
                length: 3,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "In the.",
                length: 2,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "The movies I was kind of must.",
                length: 7,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Need to be honest, but it was so cool.",
                length: 9,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Please yes, I didn't know it was like it'd be musty. Oh, I mean it's a big cave with like an eternal flow of water coming down and splashing into the.",
                length: 31,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "OK, yeah, when you put it like that, honestly, OK, to be fair, I kind of didn't expect it either. But then I was like, yeah, I don't really know what I was doing.",
                length: 34,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Yeah, I know. What about, like traveling? Like, would you ever go to Egypt? Egypt. You would want to go to Egypt, I feel like.",
                length: 25,
              },
              {
                speakerId: "Guest-2",
                speakerSeg:
                  "Going to those parts of the world, especially, like as a woman, you kind of have to take more precautions. OK, yeah, that's true. Umm, that's true. But it's definitely something I wanted.",
                length: 33,
              },
              {
                speakerId: "Guest-2",
                speakerSeg: "Ohh yeah.",
                length: 2,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "Ohh I wanna go.",
                length: 4,
              },
              {
                speakerId: "Guest-1",
                speakerSeg: "To umm like.",
                length: 3,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "Germany. Or like those little provinces in France that aren't Paris.",
                length: 11,
              },
              {
                speakerId: "Guest-1",
                speakerSeg:
                  "I just want to go to like those cities that like fairy tales are based off of like the castles and everything.",
                length: 22,
              },
            ],
            total: 271,
          },
          zoomInIndex: 3,
          zoomOutIndex: null,
          id: "topics-2",
        },
      ],
    };
    return data;
  }
}
