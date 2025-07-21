export class OpenAI {
  constructor(){};
  
  
  // Get response from openAI
  async topicClassify(speech, lastTopic) {
      console.log("getting topic" + speech);
      let resultText = "";

      try {
        const response = await fetch("https://convtimelines-backend.onrender.com/api/chat", {

            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: `Classify the provided transcript and output the topic, sentence and segment using the specified format. Transcript: ${speech}`
                }
              ],
              temperature: 1,
              max_tokens: 15000,
              top_p: 1,
              frequency_penalty: 0,
              presence_penalty: 0,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "transcript_classification",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      topic: {
                        type: "string",
                        description: `1-3 words succinctly describing the overarching conversation topic of the segment. It should not use any of the following words: ${lastTopic}). It should be as specific as possible; rather than simply broadly classifying a topic about trying new foods as 'culinary experience', personalize the topic with words from the transcript as much as possible where it makes sense to do so.`
                      },
                      sentence: {
                        type: "string",
                        description: "One sentence from the segment that best represents the topic defined."
                      },
                      segment: {
                        type: "string",
                        description: "The segment of text for the detected topic, exactly as it was inputted to you. Do not change or drop a single word. However, add punctuation where necessary."
                      }
                    },
                    required: ["topic", "sentence", "segment"],
                    additionalProperties: false
                  }
                }
              }
            })
          });
          const data = await response.json();
          resultText = JSON.parse(data.choices[0].message.content);
        } catch (error) {
        console.error("Error:", error);
        resultText = "Error occurred while generating.";
      }
      console.log("openai response", resultText);
      return resultText;
  };
  
  async subTopicClassify(speech) {
    // console.log("topicClassify topic:" + lastTopic);
      let resultText = "";

      try {
        // Fetch the response from the OpenAI API with the signal from AbortController
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: `Split the provided text segment into 2-5 chronological subtopics. Transcript: ${speech}`
                }
              ],
              temperature: 1,
              max_tokens: 15000,
              top_p: 1,
              frequency_penalty: 0,
              presence_penalty: 0,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "subtopics",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      subtopics: {
                        type: "array",
                        items: {
                          type: "string"
                        },  
                        description: `2-5 chronological subtopics. Each subtopic must contain between 1 and 3 words and be as specific as possible. Only output as many subtopics as is needed to encompass the segment.`
                      },
                    },
                    required: ["subtopics"],
                    additionalProperties: false
                  }
                }
              }
            })
          });
          const data = await response.json();
          resultText = JSON.parse(data.choices[0].message.content);
        } catch (error) {
        console.error("Error:", error);
        resultText = "Error occurred while generating.";
      }
      console.log("openai response", resultText.topic);
      return resultText.subtopics;
  };
  
  async checkForTopicTurn(speech, lastTopic) {
    // console.log("last topic:" + lastTopic);
      let resultText = "";

      try {
        // Fetch the response from the OpenAI API with the signal from AbortController
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: `Given the following conversation transcript, analyze whether a clear turn sentence exists which creates two distinct topics in the conversation. For example, a conversation about Skydiving which shifts to discussion about a motorcycle license is two distinct topics. However, discussion about travel destinations and then a more specific conversation about travel in europe or collecting postcards is one cohesive topic; travel. If so, return the turn sentence. Otherwise, if the entire transcript encompasses a singular cohesive topic, return null. \nTranscript: ${speech}`
                }
              ],
              temperature: 1,
              max_tokens: 15000,
              top_p: 1,
              frequency_penalty: 0,
              presence_penalty: 0,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "transcript_analysis",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      // is_same_topic: {
                      //   type: "boolean",
                      //   description: `Indicates whether the transcript is likely a continuation about the same topic as ${lastTopic}.`
                      // },
                      has_turn: {
                        type: "boolean",
                        description: "Indicates whether there appears to be a turn in the conversation from the topic."
                      },
                      turn_sentence: {
                        type: "string",
                        description: "The relevant sentence indicating a turn in the conversation.",
                        nullable: true
                      },
                      topic: {
                        type: "string",
                        description: "The new conversation topic *after* the detected turn sentence, if any, succintly defined in 1-3 words.",
                        nullable: true
                      },
                      transcript: {
                        type: "string",
                        description: "The transcript that was analyzed"
                      }
                    },
                    required: [
                      // "is_same_topic",
                      "topic",
                      "has_turn",
                      "turn_sentence",
                      "transcript"
                    ],
                    additionalProperties: false
                  }
                }
              }
            })
          });
          const data = await response.json();
          resultText = JSON.parse(data.choices[0].message.content);
        } catch (error) {
        console.error("Error:", error);
        resultText = "Error occurred while generating.";
      }
      // console.log("openai response", resultText.is_same_topic);
      return resultText;
  }
  
  async gptResult(speech, lastTopic, mode = "topic") {
    // console.log(`1: ${speech}, ${lastTopic}`);
    let result = null;

    if (mode === "topic") {
      try {
        const value = await this.topicClassify(speech, lastTopic);
        // console.log("topic result");
        // console.log(value);
        result = value;
      } catch (error) {
        // console.error("Error in topic mode:", error);
      }
    } else {
      try {
        // Check if the segment contains a turn sentence for a new topic
        const value = await this.checkForTopicTurn(speech, lastTopic);
//         console.log("topic turn result");
//         console.log(value);
        
        // If a turn sentence is detected, split the segment into a preturn and a postturn
        if (!(value.turn_sentence==null)){
          const turnSentence = value.turn_sentence;
          // console.log(`turn sentence: ${turnSentence}`);
          // console.log(speech.indexOf(turnSentence))
          
          const splitAtTurnSentence = (speech, turnSentence) =>
            speech.includes(turnSentence)
              ? [speech.slice(0, speech.indexOf(turnSentence)), speech.slice(speech.indexOf(turnSentence))]
              : [speech, ""]; 
          
          const [preturn, postturn] = splitAtTurnSentence(speech.toLowerCase(), turnSentence.toLowerCase());
          // console.log(`Preturn: ${preturn}`);
          // console.log(`Postturn: ${postturn}`);
          
          //Only classify a new segment if the postturn and preturn is > 100 characters
          if (postturn.length > 100 && preturn.length > 100) {
            const topic = await this.topicClassify(postturn, lastTopic);
            // console.log("topic result");
            // console.log(topic);
            topic.sentence = turnSentence;
            console.log(topic)
            result = [topic, preturn];
          }
        }
      } catch (error) {
        console.error("Error in turn mode:", error);
      }
    }

    return result;
  }
  
  async getSubtopics(speech) {
    let subtopics = await this.subTopicClassify(speech);
    let string = "";
    console.log(subtopics)
    for (let i=0; i < subtopics.length; i++) {
      if (i==subtopics.length-1) {
        string += `${subtopics[i]}`;
      } else {
        string += `${subtopics[i]} -> `;
      }
    }
    return string;
  }

  async transcribeAudio(file) {
    const apiKey = API_KEY; // Replace with your actual OpenAI API key
    const url = 'https://api.openai.com/v1/audio/transcriptions';

    const formData = new FormData();
    formData.append('model', 'whisper-1'); // Specify the Whisper model
    formData.append('file', file);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return result.text;
    } catch (error) {
        console.error('Transcription failed:', error);
        return null;
    }
  }
}