Prerequisite:
- Have npm 10.2.4 and Node.js v20.11.0 installed. If you try a different version it might or might not work; Good luck and godspeed.
    - https://docs.npmjs.com/downloading-and-installing-node-js-and-npm

- To set up for development, navigate to the root folder of the project. Then run:

>cd backend
npm install
node server.js

- Navigate to http://localhost:3000

- You may need to refresh the server (By cancelling and rerunning the command then refreshing page) when you make changes.

- Change the import statements in script.js, js/dataHandler.js, and js/speechController.js to local instead of hosted.

************* 
***Ignore for now. This is all pushed to git at the moment (which yes bad but later problem)***

- Create a file called '.env' in the backend folder. Add the following lines:
> const OPENAI_KEY = "_InsertOpenAIKey_"
const AZURE_KEY = "_InsertAzureKey_";
    
- Do not push this file to github. It is included in .gitignore.

*************

