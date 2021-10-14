# Hangouts Parser
This is a NodeJs script which takes a Google Takeout export from the old Google Hangouts chat platform and converts it into a nice user friendly set of HTML files. It also handles downloading all the attachments which aren't included in the Hangouts export.

## Usage
1. Clone this repository
2. Run `npm install` to install the required packages (You'll need NodeJs and NPM install for this to work).
3. Download the Google Takeout Hangouts export and extract it to suitable palce on your hard drive
4. Open up the `parser.js` file and have a look at the config properties which you might need to change. Description of these are listed below.
    1. `const dir = 'output'`: This will be the directory the files put output to (realtive to the `parser.js` file)
    2. `const dataFileName = 'hangouts.json'`: This is the name of the json file from the Google export. You shouldn't need to change this.
    3. `const imageWidth = '20em'`: This is the width of the image previews displayed in the chat log. A full version of them is avaliable by clicking on the image.
    4. `const downloadAttachments = true`: Set this to false to stop it downloading attachments and instead link straight to the live image son the Google server. This is good for testing before you're ready for the full run (which takes longer because of the downloads)
5. Run the script like this: `node .\parser.js .\hangouts`. Note that the `.\hangouts` argument here is the directory where you've saved the export of the hangouts files. This directory should contain a lots of image etc. and one large json file. The attachments (mostly images) aren't important because we link to the live ones or download the lives ones rather than using the existing ones (since the existing ones are simply the ones you've shared, not all the others from the rest of your conversations).
6. Wait for the script to finish running and then inspect the output directory for a file called `index.html` which will contain the UI for viewing all your chats. You can view them individually as well by opening the `chats` folder and openeing the individual html files. You can also modify the `chat` and `chats` css file if you'd like to change how the chats are displayed. The only styling which is hard coded is the image with which is set as a config property in step 4.3.

## Trouble Shooting
- Downloading attachments can take a long time so if it crashes or your computer goes to sleep, simply rerun the script and it will pick up where it left off. It checks for the existance of a file in the output directory before it downloads it again.

## Known Issues
- Download video attachments doesn't seem to work. The download URL in the JSON response with either a 400 or a 404 so there's possible some extra construction which needs to happen to make this work. I might look into this later if I get time.

## Contributing
This is very much a work in progress. Working out all the details of Google stories their messages can be tricky so ther may well be issues with this script. Also as mentioned in the Known Issues section there is probably a trick to constructing the video download url which is why I'm getting the 400/404 errors. Please feel free to submit PRs which fixes for any of these issues. 
