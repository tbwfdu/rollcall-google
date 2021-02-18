const fs = require('fs');
const {google} = require('googleapis');
const readline = require('readline');
const chalk = require('chalk');
const path = require('path');
//######################################################################################################
//
// Google Authentication (from their quickstart)
//
//######################################################################################################
console.log('====================================================================')
console.log(chalk`{yellowBright.bold Google Credential Process Starting.}`);
console.log(chalk`\n{yellowBright.bold Waiting for ./lib/credentials.json before continuing.}`);
console.log('====================================================================')

const SCOPES = ['https://www.googleapis.com/auth/admin.directory.user', 'https://www.googleapis.com/auth/admin.directory.group', 'https://www.googleapis.com/auth/admin.directory.orgunit'];
const TOKEN_PATH = './lib/token.json'
const CREDENTIALS_PATH = './lib/credentials.json'

function checkExistsWithTimeout(filePath, timeout) {
  return new Promise(function (resolve, reject) {

  

      var timer = setTimeout(function () {
          watcher.close();
          reject(new Error('File did not exist and was not created during the timeout.'));
      }, timeout);

      fs.access(filePath, fs.constants.R_OK,  function (err) {
        
          if (!err) {
              clearTimeout(timer);
              watcher.close();

              resolve('true');
          }
      });

      var dir = path.dirname(filePath);
      var basename = path.basename(filePath);
      var watcher = fs.watch(dir, function (eventType, filename) {
        
          if (eventType === 'rename' && filename === basename) {
              clearTimeout(timer);
              watcher.close();
              resolve('true');
          }
      });
  });
}



let creds;
async function doAll() {
fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.error('Error loading client secret file', err);
  creds = JSON.parse(content);
  authorize(JSON.parse(content), checkApi);
});


/**
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oauth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);
  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oauth2Client, callback);
	oauth2Client.credentials = JSON.parse(token);
	OAuth2Client = oauth2Client;
	callback(oauth2Client);
  });
}


/**
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized client.
 */
function getNewToken(oauth2Client, callback) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  tokenurl = authUrl
  console.log('\n====================================================================')
  console.log(chalk`{yellowBright.bold Authorise Rollcall to use your Google credentials by visiting this url:}`)
  console.log('====================================================================\n')
  console.log(authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log('\n \n====================================================================')
  rl.question(chalk`{yellowBright.bold Enter the code from that page here:} `, (code) => {
	console.log('====================================================================')
    rl.close();
    oauth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oauth2Client.credentials = token;
	  storeToken(token);
      callback(oauth2Client);
      //res.end();
    });
  });
}


/**
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) return console.warn(`Token not stored to ${TOKEN_PATH}`, err);
    console.log(`Token stored to ${TOKEN_PATH}`);
  });
}
let gstatus
/**
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * 
 */
//changed below to only list a single user as we are now calling it in the other script
function checkApi(auth) {
  const service = google.admin({version: 'directory_v1', auth}); 
  
  service.users.list({
    customer: 'my_customer',
    maxResults: 1,
    orderBy: 'email',
   
  }, (err, res) => {
    if (err) return console.error('The API returned an error:', err.message);
	const users = res.data.users;
	gstatus = true
    if (users.length) {
	  console.log('====================================================================')
      console.log(chalk.greenBright('Successfully queried Google Directory.'));

	  gauth = auth;
    } else {
      console.log('No users found.');
    }
  });
}
}

async function doGoogle(){
  const files = await checkExistsWithTimeout(CREDENTIALS_PATH, 600000);
    if(files == 'true') {
      console.log('credentials.json found.')
        doAll()
  
    }
  }
  doGoogle();