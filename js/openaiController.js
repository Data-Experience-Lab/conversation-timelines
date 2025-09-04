export class OpenAI {
  constructor(){}
  
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
                        description: `1-3 words succinctly describing the overarching conversation topic of the segment. It should not use any of the following words: ${lastTopic}. Highlight something else if possible.                              It should be as specific as possible; rather than simply broadly classifying a topic about trying new foods as 'culinary experience', personalize the topic with words from the transcript as much as possible where it makes sense to do so.`
                      },
                      sentence: {
                        type: "string",
                        description: "One sentence from the segment that best represents the topic defined."
                      },
                      segment: {
                        type: "string",
                        description: "The segment of text for the detected topic, exactly as it was inputted to you. Do not change or drop a single word. However, add punctuation where necessary."
                      },
                      keywords: {
                        type: "array",
                        items: {
                          type: "string"
                        },  
                        description: `2-6 most important keywords (this may include clear phrases such as 'motorcycle license' or 'jen's wedding') from the transcript that give a clear idea of a part of the conversation at a quick glance, and that would be likely to trigger a memory of the conversation's specifics. Keywords should all exist in the transcript. Only provide as many keywords as is necessary to gain a general picture of transcript contents- shorter transcripts are more likely to have less keywords.`
                      },
                    },
                    required: ["topic", "sentence", "segment", "keywords"],
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
  
  async checkForTopicTurn(speech) {
    // console.log("last topic:" + lastTopic);
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
                      has_turn: {
                        type: "boolean",
                        description: "Indicates whether there appears to be a turn in the conversation from the topic."
                      },
                      turn_sentence: {
                        type: "string",
                        description: "The relevant sentence indicating a turn in the conversation.",
                        nullable: true
                      }
                    },
                    required: [
                      // "is_same_topic",
                      "has_turn",
                      "turn_sentence",
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
        result = value;
      } catch (error) {
        console.error("Error in topic mode:", error);
      }
    } else {
      try {
        // Check if the segment contains a turn sentence for a new topic
        const turn = await this.checkForTopicTurn(speech);
        if (turn.has_turn) {
          return null;
        } else {
          const value = await this.topicClassify(speech, lastTopic);
          result = value;
        }
      } catch (error) {
        console.error("Error in turn mode:", error);
      }
    }

    return result;
  }
}