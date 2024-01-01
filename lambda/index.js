const Alexa = require('ask-sdk-core')


const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speechText = 'Welcome to Aussie Video. What would you like to play?';

        // Set the session attribute to indicate the main page
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        sessionAttributes.aplDocument = 'mainPage'; // Assuming 'mainPage' is the identifier for your main APL document
        attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt('You can say things like, "Play a video," or "Tell me about the channels."')
            .addDirective({
                type: 'Alexa.Presentation.APL.RenderDocument',
                version: '1.0',
                document: require("./custom/apl/document.json"),
                datasources: require("./custom/apl/data-sources.json")
            })
            .getResponse();
    },
};


const VideoControlIntentHandler = {
  canHandle(handlerInput) {
      return handlerInput.requestEnvelope.request.type === 'IntentRequest'
          && handlerInput.requestEnvelope.request.intent.name === 'VideoControlIntent';
  },
  handle(handlerInput) {
      /* 
        This intent handler handles both play and pause for a video. It identifies what to through the video_action slot value which can either be play or pause.
        The slot value is utilized in the ControlMedia command dynamically.
      */
      const videoAction = handlerInput.requestEnvelope.request.intent.slots.video_action.value.toLowerCase();
      return handlerInput.responseBuilder
          // For more information about ControlMedia command see: https://developer.amazon.com/docs/alexa-presentation-language/apl-commands-media.html
          .addDirective({
              type : 'Alexa.Presentation.APL.ExecuteCommands',
              token: 'documentToken',
              commands: [
                  {
                      "type": "Sequential",
                      "commands": [
                          {  
                              "type": "ControlMedia",
                              "componentId": "videoPlayerId",
                              "command": `${videoAction}`
                          }
                      ]
                  }              
              ]
          })
          .getResponse();
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent'
  },
  handle(handlerInput) {
    const speechText = 'Press the button.'

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Press the button and checkout GitHub for the source code.', speechText)
      .getResponse()
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = 'Goodbye!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withShouldEndSession(true)
      .addDirective({
        type: 'Alexa.Presentation.APL.ExecuteCommands',
        token: 'videoPlayer',
        commands: [
          {
            "type": "ControlMedia",
            "componentId": "videoPlayer",
            "command": "pause"
          },
        ]
      }).getResponse();
  },
};
const PlayVideoHandler = {
    canHandle(handlerInput) {
        console.log(`PlayVideoHandler`);
        return (
            handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'ChannelRequest'
        );
    },
    handle(handlerInput) {
        const slot = handlerInput.requestEnvelope.request.intent.slots && handlerInput.requestEnvelope.request.intent.slots.ChannelName;

        // Check if the slot is not found
        if (!slot || !slot.resolutions || !slot.resolutions.resolutionsPerAuthority || !slot.resolutions.resolutionsPerAuthority[0]) {
            const speakOutput = "Sorry, I couldn't understand the channel name. Please try again.";
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        }

        const slot_match = slot.resolutions.resolutionsPerAuthority[0].status.code;

        // Check if the status code is not ER_SUCCESS_MATCH
        if (slot_match !== 'ER_SUCCESS_MATCH') {
            const speakOutput = "Sorry, I couldn't find a matching channel name. Please try again.";
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        }

        const slot_value = slot.resolutions.resolutionsPerAuthority[0].values[0].value.name;

        // Get the video URL based on the selected channel
        const result =  getChannel(slot_value);
        const videoURL = result.url
        const token = result.logo;
        
        if (videoURL) {
            // Call the handleVideoPlayback function
            return handleVideoPlayback(handlerInput, slot_value, videoURL,token);
        }

        // Handle the case where the video URL is empty
        console.error(`URL not found for '${slot_value}'`);
        const speakOutput = `Sorry, the video URL is not available for '${slot_value}'.`;
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    },
};

// Add the HomeIntent handler
const HomeIntentHandler = {
    canHandle(handlerInput) {
        return (
            handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'HomeIntent'
        );
    },
    handle(handlerInput) {
        // Render the home screen
        const homeScreenDirective = {
            type: 'Alexa.Presentation.APL.RenderDocument',
            token: 'homeScreenToken', // Replace with a unique token for the home screen
            document: require('./custom/apl/document.json'), // Replace with the actual path to your home screen document
            datasources: require('./custom/apl/data-sources.json'), // Replace with the actual path to your home screen data sources
        };

        handlerInput.responseBuilder.addDirective(homeScreenDirective);

        const speakOutput = "You are now on the home screen.";
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    },
};

const SelectIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Alexa.Presentation.APL.UserEvent';
    },
    handle(handlerInput) {
        const aplUserEvent = handlerInput.requestEnvelope.request;
        const arguments = aplUserEvent.arguments || [];
        const token = aplUserEvent.token || null;

        // Log APL event details
        console.log('Received APL Event:', JSON.stringify(aplUserEvent));

        // Check if there's any valid argument
        if (arguments.length > 0) {
            const selectedElement = arguments[0];
            // Handle the touch event logic using the selectedElement and token
            const result =  getChannel(selectedElement);
            const videoURL = result.url
            const token = result.logo;
            if (videoURL) {
                // Call the handleVideoPlayback function
                return handleVideoPlayback(handlerInput, selectedElement, videoURL, token);
            }

            // Handle the case where the video URL is empty
            console.error(`URL not found for '${selectedElement}'`);
            const speakOutput = `Sorry, the video URL is not available for '${selectedElement}'.`;
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        }

        // Log details of unexpected APL event
        console.error('Unexpected APL Event. Arguments:', arguments, 'Token:', token);

        // Handle other APL events or fallback
        const speakOutput = 'Unexpected APL event';
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};


function handleVideoPlayback(handlerInput, channelName, videoURL, token) {
    // Construct and add APL ExecuteCommands directive to the response
    console.log (`URL not found for '${videoURL}'`);
    
    const executeCommandsDirective = {
        type: 'Alexa.Presentation.APL.ExecuteCommands',
        token: 'documentToken',
        commands: [
            {
                type: 'ControlMedia',
                componentId: 'videoPlayerId',
                command: 'play'
            }
        ]
    };

    handlerInput.responseBuilder
        .speak(`Now playing '${channelName}`)
        .addDirective({
         "type": "Alexa.Presentation.APL.RenderDocument",
         "token": "documentToken",
         "document": {
             "src": "doc://alexa/apl/documents/VideoPlayer",
             "type": "Link"
         },
         "datasources": {
             "videoPlayerTemplateData": {
                 "type": "object",
                 "properties": {
                     "backgroundImage": "https://d2o906d8ln7ui1.cloudfront.net/images/response_builder/background-green.png",
                     "displayFullscreen": true,
                     "headerTitle": channelName,
                     "headerSubtitle": "",
                     "logoUrl": token,
                     "videoControlType": "skip",
                     "videoSources": [
                         videoURL
                     ],
                     "sliderType": "determinate"
                 }
             }
         }
      })
    .addDirective(executeCommandsDirective);

    return handlerInput.responseBuilder.getResponse();
}



// Function to get the video URL and additional data based on the selected channel
function getChannel(selectedElement) {
    var channels = require("./custom/data/nsw-channels.json");
    const channelData = channels[selectedElement];

    if (channelData && channelData.url) {
        // Return an object with both url and logo
        return {
            url: channelData.url,
            logo: channelData.logo || null, // You can replace 'null' with a default logo if needed
        };
    } else {
        console.error(`URL not found for '${selectedElement}'`);
        return {
            url: "",
            logo: null,
        };
    }
}





const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest'
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`)

    return handlerInput.responseBuilder.getResponse()
  },
};

const ErrorHandler = {
  canHandle() {
    return true
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`)
    const speechText = 'There was an error with the request, please try again.'
    return handlerInput.responseBuilder
      .speak(speechText)
      .getResponse()
  },
};


function getSupportedInterfaces(handlerInput) {
  const hasSupportedInterfaces =
    handlerInput.requestEnvelope.context &&
    handlerInput.requestEnvelope.context.System &&
    handlerInput.requestEnvelope.context.System.device &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces

  if (hasSupportedInterfaces) {
    return handlerInput.requestEnvelope.context.System.device.supportedInterfaces;
  }
  return hasSupportedInterfaces;
}

const skillBuilder = Alexa.SkillBuilders.custom()

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    VideoControlIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    PlayVideoHandler,
    SelectIntentHandler,
    HomeIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
