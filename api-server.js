const Koa = require('koa')
const cors = require('@koa/cors');
const Router = require('koa-router')
const bodyParser = require('koa-bodyparser')

const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');

const sqlite3 = require('sqlite3').verbose();

const {google} = require('googleapis');
const readline = require('readline');

const jsondiffpatch = require('jsondiffpatch')

const chalk = require('chalk');

const router = new Router()  
const app = new Koa();
app.use(bodyParser())
app.use(router.routes())

// Adding CORS to remove Angular proxy dependency
app.use(cors())

const superagent = require('superagent');

// Create some time for sleep
function sleep(ms) {
	return new Promise((resolve) => {
	  setTimeout(resolve, ms);
	});
  }

//Create New DB for Google
const db = new sqlite3.Database('./database/googledir.db', (err) => {
	if (err) {
	  console.error(chalk.red(err.message));
	}
	console.log(chalk`Loading Google Rollcall Database: {greenBright.bold SUCCESS }`);
  });

//Create New DB for Storing Secrets
const secrets = new sqlite3.Database('./database/secrets.db', (err) => {
	if (err) {
		console.error(chalk.red(err.message));
	}
	console.log(chalk`Loading Workspace ONE Access Secrets Database: {greenBright.bold SUCCESS }`);
  });

//Create tables in Google DB
db.run('CREATE TABLE IF NOT EXISTS users(username TEXT UNIQUE, lastupdate TEXT, lastresult TEXT, PRIMARY KEY("username"))');
db.run('CREATE TABLE IF NOT EXISTS groups(id TEXT UNIQUE, lastupdate TEXT, lastresult TEXT, PRIMARY KEY("id"))');
db.run('PRAGMA synchronous = OFF')

//Create tables in Secrets DB 
secrets.run('CREATE TABLE IF NOT EXISTS access_tenant(id INTEGER PRIMARY KEY CHECK (id = 0), url TEXT, client_id TEXT, client_secret TEXT, domain TEXT, bearer_expiry TEXT)');
secrets.run('CREATE TABLE IF NOT EXISTS sync(synctype TEXT UNIQUE, syncvalues TEXT, frequency TEXT, day TEXT, time TEXT, lastresult TEXT, PRIMARY KEY("synctype"))');
secrets.run('PRAGMA synchronous = OFF')

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
	  
console.log(chalk
    `{white ====================================================================} {greenBright.bold 
        8888888b.          888 888                   888 888
        888   Y88b         888 888                   888 888
        888    888         888 888                   888 888
        888   d88P .d88b.  888 888  .d8888b  8888b.  888 888
        8888888P" d88""88b 888 888 d88P"        "88b 888 888
        888 T88b  888  888 888 888 888      .d888888 888 888
        888  T88b Y88..88P 888 888 Y88b.    888  888 888 888
        888   T88b "Y88P"  888 888  "Y8888P "Y888888 888 888 } {white
====================================================================}`+
    chalk`\nRollcall Server API is listening on {bold http://localhost:${PORT}}`+
    chalk`{white \n====================================================================}`
    
        )
});

//==================================================================================================================

//==========================================================
// Inbound Request API paths
//==========================================================

//---PING---/
// Used to check if Access Sync is running
router.all('/ping', async function (ctx, next) {
	ctx.set('Access-Control-Allow-Origin', '*')
	
	let result = {status: 'ok'}
	ctx.body = result
	await next();
	});

//---Check Access---/
// Used to check if Google API and Access API configured and can be accessed
router.get('/status', async function (ctx, next) {
	ctx.set('Access-Control-Allow-Origin', '*')
	
	let result = {
		google: `${gstatus}`,
		access: `${astatus}`
	  }
	ctx.body = result
	await next();
	});


//---GET All Users---//
router.get('/allusers', async function (ctx, next) {
	
	let result = await listAllUsers();
	console.log('Users Found: ' + result.length + '\n');
	ctx.body = result
	await next();
	});

//---GET AccessUsers---//
router.get('/allaccessusers', async function (ctx, next) {
	
	let result = await listAccessUsers();
	console.log('Users Found: ' + result.Resources.length + '\n');
	ctx.body = result.Resources
	
	await next();
	});


//---GET All Access Groups---//
router.get('/allaccessgroups', async function (ctx, next) {
	let result = await getAllAccessGroups();
	console.log('Groups Found: ' + result.length + '\n');
	ctx.body = result
	await next();
	});

//---GET Access Directories---//
// List all directories that exist in Access
router.get('/accessdirs', async function (ctx, next) {
	
	let result = await getAccessDirs();
	console.log(result.items.length + ' directories found.\n');
	ctx.body = result
	await next();
	});

//---POST Create Directory Users---//
// Creates a directory in Access for Sync
router.post('/createdir', async function (ctx, next) {
	let request = ctx.request.body
	console.log(request)
	ctx.set('Access-Control-Allow-Origin', '*')
	console.log('Creating Directory...')
	const result = await createDir(request);
	console.log(result)
	ctx.body = result
	await next();
});


//---GET All Groups---//
router.get('/allgroups', async function (ctx, next) {
	
	let result = await listAllGroups();
	console.log('Groups Found: ' + result.length + '\n');
	ctx.body = result
	await next();
	});

//---Return Secrets for Access---//
// Gets credentials used for Access OAuth
router.get('/secrets', async function (ctx, next) {
	
	let result = await getSecrets();
	ctx.body = result
	await next();
	});

//---Return User Sync Settings---//
// Returns User Sync settings saved in database
router.get('/getusersync', async function (ctx, next) {
	
	let result = await getUserSyncSettings();
	ctx.body = result
	await next();
	});

//---Return Group Sync Settings---//
// Returns Group Sync settings saved in database
router.get('/getgroupsync', async function (ctx, next) {
	
	let result = await getGroupSyncSettings();
	ctx.body = result
	await next();
	});

//---Return Sync Schedule Settings---//
// Returns schedule settings saved in database
router.get('/getsyncschedule', async function (ctx, next) {
	
	let result = await getSchedule();
	ctx.body = result
	await next();
	});

//---Save Config for Access---//
// Saves credentials entered in UI into database for Access OAuth
router.post('/saveconfig', async function (ctx) {
	ctx.set('Access-Control-Allow-Origin', '*')

	let request = ctx.request.body
	let result = await saveCredentials(request)

	ctx.body = result
	});

//---Save Sync Settings from Rollcall---//
// Saves Sync Settings entered in UI into database 
router.post('/savesyncschedule', async function (ctx) {
	ctx.set('Access-Control-Allow-Origin', '*')

	let request = ctx.request.body
	let result = await saveSyncSchedule(request)
	let schedule = await getSchedule();
	doAll();
	ctx.body = {
		result: result,
		schedule: schedule
	};
});

//---Save User Sync Settings from Rollcall---//
// Saves User Sync Settings entered in UI into database 
router.post('/savesyncusers', async function (ctx) {
	ctx.set('Access-Control-Allow-Origin', '*')

	let request = ctx.request.body
	let result = await saveSyncUsers(request)
	let schedule = await getSchedule();
	ctx.body = {
		result: result,
		schedule: schedule
	};
});

//---Save Group Settings from Rollcall---//

// Saves Group Settings entered in UI into database 
router.post('/savesyncgroups', async function (ctx) {
	ctx.set('Access-Control-Allow-Origin', '*')

	let request = ctx.request.body
	let result = await saveSyncGroups(request)
	ctx.body = result
	});

//Clear Sync Schedule Config
router.post('/clearconfig', async function (ctx) {

	
	let result = await clearSyncConfig()
	ctx.body = result
	});

//====================
//--Let the initial Google Request do the auth and then re-use it below.
let OAuth2Client;
//====================

//==========================================================
// Google API functions
//==========================================================

//---Users---//

//List a Single User
function listUser(user) {
	return new Promise (resolve => {
		const headers = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ` + OAuth2Client.credentials.access_token
	}
	superagent
		.get('https://admin.googleapis.com/admin/directory/v1/users/' + user)
		.set(headers)
      	.then(res => {
			const users = res.body;
			resolve(users);
      });
      
    });
}

//List All Google Directory Users
function listAllUsers(users = [], pageToken) {
	return new Promise (resolve => {
		const headers = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ` + OAuth2Client.credentials.access_token
	}
	superagent
		.get('https://admin.googleapis.com/admin/directory/v1/users')
		.set(headers)
		.query({ customer: 'my_customer',
		pageToken: pageToken	
		})
      	.then(res => {
			users = users.concat(res.body.users);
			console.log('Found ' + users.length + ' users...\n');
			if (res.body.nextPageToken) {
                listAllUsers(users, res.body.nextPageToken).then((resusers) => {
                resolve(resusers);
                });
            } else {
                resolve(users);
            }
        });
      });
      
	}

//Compare Google User attributes with current Access User attributes
function diffUsers(user, accessUser) {
	const guser = user;
	const auser = accessUser[0];
	
	var isSuspendedStr = guser.suspended
	var isActiveInvertedStr = !auser.active

	const googleUserData = {
		name: {
			givenName: guser.name.givenName || null,
			familyName: guser.name.familyName || null
		},
		emails: guser.primaryEmail,
		suspended: isSuspendedStr
	 }
	 
	 // Note: Google uses "suspended" and Access uses "active" for user accounts. Below for access just inverts the response for comparison.
	 const accessUserData = {
		name: {
			givenName: auser.name.givenName || null,
			familyName: auser.name.familyName || null
		},
		emails: auser.emails[0].value,
		suspended: isActiveInvertedStr
	 }

	

	return new Promise (resolve => {
		var diffs = jsondiffpatch.diff(accessUserData, googleUserData)
		if (diffs) {
			let changes = jsondiffpatch.patch(googleUserData, diffs)
			console.log("User Changes: ")
			const newBody = {
				changes,
				userlocation: auser.meta.location
			}
			console.log(newBody)                                                                                                
			resolve(newBody);
		}
		else {
			console.log("No User Attribute Updates Required.")
			resolve('')
		} 
	  });
}

//---Groups---//
function listAllGroups(groups = [], pageToken) {
	return new Promise (resolve => {
		const headers = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ` + OAuth2Client.credentials.access_token
	}
	superagent
		.get('https://admin.googleapis.com/admin/directory/v1/groups')
		.set(headers)
		.query({ customer: 'my_customer',
		pageToken: pageToken	
		})
		.then(res => {
			groups = groups.concat(res.body.groups);
			console.log('Found ' + groups.length + ' groups...\n');
			if (res.body.nextPageToken) {
                listAllGroups(groups, res.body.nextPageToken).then((resgroups) => {
                resolve(resgroups);
                });
            } else {
                resolve(groups);
            }
        });
      
    });
}

//---List all Access Groups---//
function getAllAccessGroups() {
	return new Promise (resolve => {
	superagent
		.get(access_url + '/SAAS/jersey/manager/api/scim/Groups')
		.auth(accessBearer, { type: 'bearer'})
      	.then(res => {
			const groups = res.body.Resources;
			resolve(groups);
      });
      
    });
}

//---GET Group Members---//
function getMembers(id, pageToken) {
	return new Promise (resolve => {
		const headers = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ` + OAuth2Client.credentials.access_token
	}
	superagent
		.get('https://admin.googleapis.com/admin/directory/v1/groups/' + id.groupkey + '/members')
		.set(headers)
		.query({
		pageToken: pageToken	
		})
		.then(res => {
			let members = []
			members = members.concat(res.body.members);

			console.log('Found ' + members.length +  ` members in ${id.groupkey}\n`);
			if (res.body.nextPageToken) {
                getMembers(id, res.body.nextPageToken).then((memberResult) => {
                resolve(memberResult);
                });
            } else {
                resolve(members);
            }
        });
      
    });
}

//---GET Group by Id---//
function getGroupById(id) {
	return new Promise (resolve => {
		const headers = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ` + OAuth2Client.credentials.access_token
		}
	superagent
		.get('https://admin.googleapis.com/admin/directory/v1/groups/' + id)
		.set(headers)
		.then(res => {
                resolve(res.body);
            })
        })
      
}

//Compare Google Group attributes with current Access Group attributes
function diffGroup(group, accessGroup) {
	const ggroup = group;
	const agroup = accessGroup[0];
	const googleGroupData = {
		name: ggroup.name || null,
	 }
	 const accessGroupData = {
		name:  agroup.displayName || null,
	 }
	return new Promise (resolve => {
		var diffs = jsondiffpatch.diff(accessGroupData, googleGroupData)
		if (diffs) {
			let changes = jsondiffpatch.patch(googleGroupData, diffs)
			console.log("Changes: \n" + `${agroup.displayName} will be renamed to ${changes.name}. \n` )
			const newBody = {
				changes,
				access_id: agroup.id,
				grouplocation: agroup.meta.location
			}                                                                                                
			resolve(newBody);
		}
		else {
			console.log('No Group Attribute Updates Required. \n')
			resolve('')
		} 
	  });
}

//==========================================================
// Access SCIM API functions
//==========================================================

//--Create User in Access--//
function createUser(users) {
	const user = users;
	return new Promise (resolve => {
	const schemas = [
	  "urn:scim:schemas:core:1.0", "urn:scim:schemas:extension:workspace:tenant:sva:1.0", "urn:scim:schemas:extension:workspace:1.0", "urn:scim:schemas:extension:enterprise:1.0"
	]
	const isActive = !user.suspended
	// Set body to be sent
	const createUserBody = {
	   schemas: schemas,
	   userName: user.primaryEmail,
	   active: isActive,
	   externalId: user.id,
	   name: {
		   givenName: user.name.givenName || null,
		   familyName: user.name.familyName || null
	   },
	   emails: user.primaryEmail,
	   //Custom Workspace ONE Access Schema required for the attributes sent below. Hard code internalUserType to 'Provisioned'
	   'urn:scim:schemas:extension:workspace:1.0': {
		  internalUserType: 'PROVISIONED' || null,
		  domain: domain || null,
		  userPrincipalName: user.primaryEmail || null
	  	}
	}
	// Now create user
	superagent
		  .post(access_url + '/SAAS/jersey/manager/api/scim/Users')
		  .type('application/json')
		  .auth(accessBearer, { type: 'bearer'})
		  .send((createUserBody))
		  .end((err, res) => {
			if(err) {
				console.log(err)
				resolve(err)
			}
			console.log('Processed: ' + user.primaryEmail + ` (result: ${res.status})`)
			if (res.status < 200 || res.status > 299) {
				const response = {
					username: user.primaryEmail,
					statuscode: res.status,
					result: 'notadded'
				}
				resolve (response)
				
			}
			else {

				const response = {
					username: user.primaryEmail,
					statuscode: res.status,
					access_id: res.body.id
				}
				//Get current date and time then regex to a useable format.
				let timedate = new Date().toISOString().
				  replace(/T/, ' ').      // replace T with a space
				  replace(/\..+/, '')     // delete the dot and everything after
			db.run(`INSERT OR REPLACE INTO users(username,lastupdate,lastresult) VALUES(?,?,?)`, (user.primaryEmail), (timedate), (res.status), function(err) {
				if (err) {
					console.log(err.message);
					return console.log(err);
				}
				resolve (response)
			});
			}
		},
		  );
		
	})
}

//---List all Access Users---//
function listAccessUsers() {
	return new Promise (resolve => {
	superagent
		.get(access_url + '/SAAS/jersey/manager/api/scim/Users')
		.auth(accessBearer, { type: 'bearer'})
		.query(`filter=Username co "${domain}"`)
      	.then(res => {
			const users = res.body;
			//const users = res.body;
		//	console.log(users.users)
			resolve(users);
      });
      
    });
}

//Create Directory in Access for Sync
function createDir(request) {
	return new Promise (resolve => {
	// Now create dir
	superagent
		  .post(access_url + '/SAAS/jersey/manager/api/connectormanagement/directoryconfigs')
		  .set('Content-Type', 'application/json')
		  .set('Content-Type','application/vnd.vmware.horizon.manager.connector.management.directory.other+json')
		  .auth(accessBearer, { type: 'bearer'})
		  .send((request))
		  .end((err, res) => {
			if(err) {
				resolve(err)
			}
			console.log(res.body)
			resolve(res.body)
		},
		  );
		
	})
}

//--Update User Attributes in Access--//
function updateUser(changedUser) {
	const body = {
		name: {
			givenName: changedUser.changes.name.givenName || null,
			familyName: changedUser.changes.name.familyName || null
		},
		emails: changedUser.changes.emails,
		active: !changedUser.changes.suspended

	 }
	return new Promise (resolve => {
	// Now create user
	superagent
		  .patch(`${changedUser.userlocation}`)
		  .type('application/json')
		  .auth(accessBearer, { type: 'bearer'})
		  .send((body))
		  .end((err, res) => {
			if(err) {
				console.log(err)
				resolve(err)
			}
			if (res.status < 200 || res.status > 299) {
				const response = {
					
					username: changedUser.changes.emails,
					statuscode: res.status
					
				}
				resolve (response)
				
			}
			else {
				const response = {
					
					username: changedUser.changes.primaryEmail,
					statuscode: res.status
					
				}
			resolve (response)
			} 
		},
		  );
		
	})
}

//--Create Group in Access--//
function createGroup(groups) {
	const group = groups;
	return new Promise (resolve => {
	const schemas = [
	  "urn:scim:schemas:core:1.0", "urn:scim:schemas:extension:workspace:1.0", "urn:scim:schemas:extension:enterprise:1.0"
	]
	// Set body to be sent
	const createGroupBody = {
	   schemas: schemas,
	   displayName: group.name,
	   externalId: group.id,
	   //Custom Workspace ONE Access Schema required for the attributes sent below. Hard code internalGroupType to 'INTERNAL'
	   'urn:scim:schemas:extension:workspace:1.0': {
		  internalGroupType: 'INTERNAL' || null,
		  domain: domain || null
	  	}
	}
	// Now create group
	superagent
		  .post(access_url + '/SAAS/jersey/manager/api/scim/Groups')
		  .type('application/json')
		  .auth(accessBearer, { type: 'bearer'})
		  .send((createGroupBody))
		  .end((err, res) => {
			if(err) {
				console.log(err)
				resolve(err)
			}
			if (res.status < 200 || res.status > 299) { //error catching
				const response = {
					name: group.name,
					statuscode: res.status,
					accessid: res.body.id,
					groupkey: group.id
				}
				//Get current date and time then regex to a useable format.
				let timedate = new Date().toISOString().
				  replace(/T/, ' ').      // replace T with a space
				  replace(/\..+/, '')     // delete the dot and everything after
				db.run(`REPLACE INTO groups(id,lastupdate,lastresult) VALUES(?,?,?)`, (group.id), (timedate), (res.status), function(err) {
				if (err) {
					return console.log(err);
				}
				resolve (response)
				});
			}
			else {
				const response = {
					name: group.name,
					statuscode: res.status,
					accessid: res.body.id,
					groupkey: group.id
				}
				//Get current date and time then regex to a useable format.
				let timedate = new Date().toISOString().
				  replace(/T/, ' ').      // replace T with a space
				  replace(/\..+/, '')     // delete the dot and everything after
			db.run(`INSERT OR REPLACE INTO groups(id,lastupdate,lastresult) VALUES(?,?,?)`, (group.id), (timedate), (res.status), function(err) {
				if (err) {
					console.log(err.message);
					return console.log(err);
				}
				resolve (response)
			});
			}
		},
		  );
		
	})
}

//--Convert Google MemeberID List to Access List--//
async function convertMembers(members) {
	console.log('Converting Google Group ID to Access Group ID')

	const membersArray = async function() {
		var promises = [];
		for (let i = 0; i < members.length; i++) {

			const res = await getAccessUserId(members[i]);

			if(res.length == []) {
				console.log(`User doesn't exist. Needs to be created.`)
				const gUser = await listUser(members[i].email)
				const aUser = await createUser(gUser)
				const val = {
					value: aUser.access_id
				}
				promises.push( val )
			}
			else {
			const val = {
				value: res[0].id
			}
			promises.push( val )
		}
		console.log('Processed ' + promises.length + ' members...\n');
		}
		return Promise.all(promises)
	}
	const memlist = await membersArray();
	return new Promise (resolve => {
	resolve(memlist)
	})
}

//--Add Google Group members to Access Group--//
function addMembers(group, memlist) {
	console.log(`Adding ${memlist.length} users to ${group.name}`)

	return new Promise (resolve => {
	const body = {

		members: memlist
	}

	superagent
		.patch(access_url + `/SAAS/jersey/manager/api/scim/Groups/${group.accessid}`)
		.auth(accessBearer, { type: 'bearer'})
		.send((body))
      	.then(res => {

			resolve(res);
      });
      
    });
}

//--Add Google Group members to Access Group--//
function updateGroup(group) {
	console.log(`Modifying group to ${group.changes.name}`)

	return new Promise (resolve => {
	const body = {

		displayName: group.changes.name
	}
console.log(group)
console.log(body)
	superagent
		.patch(access_url + `/SAAS/jersey/manager/api/scim/Groups/${group.access_id}`)
		.auth(accessBearer, { type: 'bearer'})
		.send((body))
      	.then(res => {
			  console.log(res.body)
			  resolve(res.body)
      });
      
    });
}


//---Get Access User by Username (username in Access == primaryEmail in Google)---//
function getAccessUser(users) {
	const user = users;
	return new Promise (resolve => {
	superagent
		.get(access_url + '/SAAS/jersey/manager/api/scim/Users')
		.auth(accessBearer, { type: 'bearer'})
		.query(`filter=Username co "${user.primaryEmail}"`)
      	.then(res => {
			const rtn = res.body.Resources
			resolve(rtn);
      });
      
    });
}

//---Get Access User ID by email address---//
function getAccessUserId(members) {
	return new Promise (resolve => {
	superagent
		.get(access_url + '/SAAS/jersey/manager/api/scim/Users')
		.auth(accessBearer, { type: 'bearer'})
		.query(`filter=Username co "${members.email}"`)
      	.then(res => {
			const rtn = res.body.Resources
			resolve(rtn);
      });
      
    });
}

//---Get Access Group by externalId (externalId in Access == email in Google)---//
function getAccessGroup(groups) {
	const group = groups;
	return new Promise (resolve => {
	superagent
		.get(access_url + '/SAAS/jersey/manager/api/scim/Groups')
		.auth(accessBearer, { type: 'bearer'})
		.query(`filter=externalId co "${group.id}"`)
      	.then(res => {
			const rtn = res.body.Resources
			resolve(rtn);
      });
      
    });
}

//--Add Users to Access according to Partial Sync Users list from Rollcall--//
async function syncPartialUserList(userNameArray) {
	console.log(chalk`Processing {blueBright.bold Partial User Sync}`)
	const usersArray = async function() {
		var promises = [];
		for (let i = 0; i < userNameArray.length; i++) {
			const user = await listUser(userNameArray[i]);
			function createCheck() { return new Promise (resolve => {
			db.get(`SELECT username FROM users WHERE username = ?`, [user.primaryEmail], (err, res) => {
				if(err) {
					console.log(err)
					resolve(err)
				}
				if (res) {
				console.log(user.primaryEmail + ' previously created, skipping creation.')
				resolve(false)
				}
				else {
					resolve(true)
				}
			})
			})
			}
		const create = await createCheck()
		if (create) {
		const res = createUser(user);
		console.log('Added ' + user.primaryEmail)
		promises.push( await res )
		console.log('Processed ' + promises.length + ' users...\n');
		}
		if (!create) {
			const accessUser = await getAccessUser(user);
			const changedUser = await diffUsers(user, accessUser);
			if (changedUser) {

				 const result = await updateUser(changedUser)
				 const response = {
					
					username: user.primaryEmail,
					statuscode: 204
					
				}
				promises.push( response )
			}
			else {
			const response = {
					
				username: user.primaryEmail,
				statuscode: 409
				
			}
			promises.push( response )
		}
		}
		}
		return Promise.all(promises)
	}
	const result = await usersArray() 
	var errcount = 0;
	var createcount = 0;
	var modcount = 0;
	for (let i = 0; i < result.length; i++) {
		const res = result[i];
		if (res.statuscode == 201) {
			createcount++;
		   }
		if (res.statuscode == 204) {
			modcount++;
		   }
		if (res.statuscode == 409)  {
			 errcount++;
		   }
		
	}


	const res = {
	
		result: {
			processed: result.length,
			skipped: errcount,
			created: createcount,
			modified: modcount

		}
	}
	return res
}

//List Access Directories
function getAccessDirs() {
	return new Promise (resolve => {
	superagent
		.get(access_url + '/SAAS/jersey/manager/api/connectormanagement/directoryconfigs')
		.auth(accessBearer, { type: 'bearer'})
      	.then(res => {
			const dirs = res.body;
			resolve(dirs);
      });
      
    });
}

//Save OAuth Credentials
function saveCredentials(request) {
	return new Promise (resolve => {
		secrets.run(`INSERT OR REPLACE INTO access_tenant(id,url,client_id,client_secret,domain) VALUES(?,?,?,?,?)`, (0), (request.url), (request.client_id), (request.client_secret), (request.domain), function (err) {

			if (err) {

			console.log(err)
			resolve(
			{result: "error",
			statuscode: 400
			}
			)

			}
			else 
			console.log(chalk.blueBright("Updated OAuth Credentials in secrets.db"))
			callOauthEndpoint()
			resolve (
				{result: "success",
				statuscode: 200
				}
			)

		});
      
    });
}

//Save Sync Schedule Settings
function saveSyncSchedule(request) {
	return new Promise (resolve => {
		secrets.run(`INSERT OR REPLACE INTO sync(synctype,syncvalues,frequency,day,time) VALUES(?,?,?,?,?)`, (request.synctype), (request.syncvalues), (request.frequency), (request.day),(request.time), function (err) {
			if (err) {
			console.log(err)
			resolve(
			{result: "error",
			statuscode: 400
			}
			)

			}
			else 
			console.log(chalk.blueBright("Updated Sync Settings in secrets.db"))
			
			resolve (
				{result: "success",
				statuscode: 200
				}
			)
			getSchedule()
			doAll()
		});
      
    });
}

//Save User Sync Values
function saveSyncUsers(request) {
	return new Promise (resolve => {
		secrets.run(`INSERT OR REPLACE INTO sync(synctype,syncvalues,frequency,day,time) VALUES(?,?,?,?,?)`, (request.synctype), (request.syncvalues), (request.frequency), (request.day),(request.time), function (err) {


			if (err) {

			console.log(err)
			resolve(
			{result: "error",
			statuscode: 400
			}
			)

			}
			else 
			console.log(chalk.blueBright("Updated Sync Settings in secrets.db"))
			resolve (
				{result: "success",
				statuscode: 200
				}
			)
			getUserSyncSettings()
			doAll()
		});
      
    });
}

//Save Group Sync Values
function saveSyncGroups(request) {
	return new Promise (resolve => {
		secrets.run(`INSERT OR REPLACE INTO sync(synctype,syncvalues,frequency,day,time) VALUES(?,?,?,?,?)`, (request.synctype), (request.syncvalues), (request.frequency), (request.day),(request.time), function (err) { 

			if (err) {

			console.log(err)
			resolve(
			{result: "error",
			statuscode: 400
			}
			)

			}
			else 
			console.log(chalk.blueBright("Updated OAuth Credentials in secrets.db"))
			resolve (
				{result: "success",
				statuscode: 200
				}
			)
			getGroupSyncSettings()
			doAll()
		});
      
    });
}

//Delete sync schedule from database
function clearSyncConfig() {
	return new Promise (resolve => {
		secrets.run(`DELETE FROM sync WHERE synctype != 'schedule'`, function (err) {

			if (err) {

			console.log(err)
			resolve(
			{result: "error",
			statuscode: 400
			}
			)

			}
			else 
			console.log(chalk.blueBright("Cleared all User/Group info from secrets.db"))
			resolve (
				{result: "success",
				statuscode: 200
				}
			)

		});
      
    });
}

//Get schedule settings
function getSchedule() {
	return new Promise(resolve => {
			
		db.serialize(async function() {
			secrets.all(`SELECT * FROM sync WHERE synctype LIKE 'schedule'`, async function(err, data) {
				
				if (Array.isArray(data) && data.length)  {

					const prom = async function() {
						var promises = [];
						/* for (let i = 0; i < data.length; i++) { */
						const realNumber = parseInt(data[0].time)
						let ampm
						let humanTime
						if (realNumber <=11  ) {
							ampm = 'AM'
							humanTime = `${realNumber}:00 ` + ampm
						  }
						  if (realNumber == 12  ) {
							ampm = 'PM'
							humanTime = `${realNumber}:00 ` + ampm
						  
						  }
						  if (realNumber >= 13) {
							ampm = 'PM'
							let ampmtime = realNumber - 12
							humanTime = `${ampmtime}:00 ` + ampm
						  }
						const response = {
							synctype: data[0].synctype, 
							syncvalues: data[0].syncvalues,
							frequency: data[0].frequency,
							day: data[0].day,
							time: humanTime,
							hourNumber: data[0].time
						}
						promises.push( response )
						return promises
					}				
					
				
				const result = await prom()
				resolve (result)
				}

				if (err) { const response = [ {
					synctype: '', 
					syncvalues: '',
					frequency: '',
					day: '',
					time: ''
				} ]
				return response
				}
				else {
					const response = [ {
						synctype: '', 
						syncvalues: '',
						frequency: '',
						day: '',
						time: ''
					}]
					return response
				}
				
					
		})

	})
})
}

//Get User Sync values
function getUserSyncSettings() {
	return new Promise(resolve => {		
		db.serialize(async function() {
			secrets.all(`SELECT * FROM sync WHERE synctype LIKE 'user%'`, async function(err, data) {

				if (err) { const response = [ {
					synctype: '', 
					syncvalues: '',
					frequency: '',
					day: '',
					time: ''
				} ]
					resolve (response)
				}
				if (Array.isArray(data) && data.length)  {
					const prom = async function() {
						var promises = [];
						const response = {
							synctype: data[0].synctype, 
							syncvalues: data[0].syncvalues,
							frequency: data[0].frequency,
							day: data[0].day,
							time: data[0].time,
							numberTime: data[0].time
						}
							promises.push( response )
							return promises
						}				
						
					
					const result = await prom()
				
					resolve (result)
				}

				else {
						
						const response = [ {
							synctype: '', 
							syncvalues: '',
							frequency: '',
							day: '',
							time: '',
							numberTime: ''
						} ]
						resolve (response)
				}
						
			})

		})
	})
}

//Get Group Sync values
async function getGroupSyncSettings() {
	return new Promise(resolve => {
			
		db.serialize(async function() {
			secrets.all(`SELECT * FROM sync WHERE synctype LIKE 'group%'`, async function(err, data) {
			

				if (err) { const response = [ {
					synctype: '', 
					syncvalues: '',
					frequency: '',
					day: '',
					time: ''
				} ]
				resolve (response)
				}
				if (Array.isArray(data) && data.length)  {
					const prom = async function() {
						var promises = [];
						const response = {
							synctype: data[0].synctype, 
							syncvalues: data[0].syncvalues,
							frequency: data[0].frequency,
							day: data[0].day,
							time: data[0].time,
							numberTime: data[0].time
						}
							promises.push( response )
							return promises
						}				
						
					
				const result = await prom()
				
					resolve (result)
					}

					else {
						
						const response = [ {
							synctype: '', 
							syncvalues: '',
							frequency: '',
							day: '',
							time: '',
							numberTime: ''
						} ]
						resolve (response)
					}
						
			})

		})
	})
}

//Parse the "partial user" list values
function parseEmailArray() {
	return new Promise(resolve => {
			
		db.serialize(async function() {
			let userNameArray
			secrets.all(`SELECT * FROM sync WHERE synctype LIKE 'user%'`, async function(err, data) {
				
				if (Array.isArray(data) && data.length)  {
					if (data[0].synctype != 'all') {
						userNameArray = data[0].syncvalues.split(',')
	
						resolve (userNameArray)
	
					}
				}
				
				else {
					const response =  {
						response: 'nodata'
					} 
					resolve (response)
				}

		})
	})
})
}

//Parse the "partial group" list values
function parseGroupIDArray() {
	return new Promise(resolve => {	
		db.serialize(async function() {
			let userNameArray
			secrets.all(`SELECT * FROM sync WHERE synctype LIKE 'group%'`, async function(err, data) {
				
				if (Array.isArray(data) && data.length)  {

					if (data[0].synctype != 'all') {
						userNameArray = data[0].syncvalues.split(',')
						resolve (userNameArray)
					}
				}
				else  {
					const response =  {
						response: 'nodata'
					} 
					resolve (response)
				}
				
			})
		})
	})
}

//Duplicate function to read Google credentials
function readCreds() {
	return new Promise(resolve => {
	fs.readFile(CREDENTIALS_PATH, (err, content) => {
		const parsed = JSON.parse(content)
	resolve(parsed)
})
})
}

//Call Google API to keep the Access Token alive (expires every hour unless used)
async function keepAlive() {
	console.log('====================================================================')
	console.log('Calling API to keep Google access_token alive.')
	const gcreds = await readCreds()
	
	authorize(gcreds, checkApi), (err, res) => {
		if(err) {
			console.log(err)
			resolve(err)
		}

		return 'ok'
	}
}


//Run a scheduled job to keep token alive
schedule.scheduleJob('0/15 * 1/1 * *', function () { keepAlive()});

//######################################################################################################
//
// Workspace ONE Access Auth
//
//######################################################################################################

//---Send Request to get Bearer Token from Access---//

let accessBearer;
let access_url;
let client_id;
let client_secret;
let domain;

//Get OAuth credentials from database
function getSecrets() {
	return new Promise(resolve => {
		
		db.serialize(async function() {

		secrets.all(`SELECT * FROM access_tenant`, function(err, data) {
			if (Array.isArray(data) && data.length)  {
			access_url = data[0].url,
			client_id = data[0].client_id,
			client_secret = data[0].client_secret,
			domain = data[0].domain
			//db.close();
			resolve(data[0])
			}
			else resolve('no data')
			})
		})
	})	
}

//Request OAuth bearer token from Access
function getBearer(creds) {
	if(creds.url) {
  	const queryArguments = {
    grant_type: 'client_credentials',
	client_id: creds.client_id,
    client_secret: creds.client_secret,
  }
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
  return new Promise(resolve => {
	superagent
	.post(access_url + '/SAAS/auth/oauthtoken')
	.query(queryArguments)
	.set(headers)
	.catch(err => {
		console.log(err)
		resolve(err)})
	.then(res => {
		accessBearer = res.body.access_token
			resolve('Bearer Token obtained from Access'); })
	});
}
};

let astatus

//---Get Access OAuth Endpoint to get Bearer---//
async function callOauthEndpoint() {
	const creds = await getSecrets();

	if (creds == 'no data') {
		console.log(chalk`{red.bold No Access Tenant information has been provided.} Have you run setup using Rollcall UI?`)

		return false
	}
	const b = await getBearer(creds);
	
	if(b != "no data") {
		astatus = true
		console.log('====================================================================')
		console.log(chalk`{green.bold Successfully obtained OAuth Token from Workspace ONE Access}`)
		console.log('====================================================================')


	}
	else {
		console.log('====================================================================')
		console.log(chalk`{red.bold Unable to obtain OAuth Token from Workspace ONE Access \n}`)
		secrets.get(`SELECT url FROM access_tenant`, (err, res) => {
			if(err) {
				console.log(err)
				return('no data')
			}
			if (res) {
			console.log(chalk`{red.bold Access Tenant information exists, check credentials or url.}\n`)
			const data = true
			return data
			}
			else {
			console.log(chalk`{red.bold No Access Tenant information has been provided.} Have you run setup? http://localhost/setup`)
			const data = false
			return data
			}
		})
		
	}
	
};
callOauthEndpoint();

//######################################################################################################
//
// Google Authentication (from their quickstart)
//
//######################################################################################################

const SCOPES = ['https://www.googleapis.com/auth/admin.directory.user', 'https://www.googleapis.com/auth/admin.directory.group', 'https://www.googleapis.com/auth/admin.directory.orgunit'];
const TOKEN_PATH = './lib/token.json'
const CREDENTIALS_PATH = './lib/credentials.json'


let creds;
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
  console.log('====================================================================')
  console.log(chalk`{yellowBright.bold Authorise Rollcall to use your Google credentials by visiting this url:\n}`, authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log('====================================================================')
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
function sleep(ms) {
	return new Promise((resolve) => {
	  setTimeout(resolve, ms);
	});
} 

//==========================================================
// Parse and Schedule Sync settings
//==========================================================


//Function to Sync All Users from Google to Access
async function processAllUserSync() {
	console.log(chalk`Processing {blueBright.bold All User Sync}`)
	console.log('Getting list of all user accounts in Google Directory...')
	const users = await listAllUsers();
	console.log('Processing ' + users.length + ' users...\n');
	const prom = async function() {
		var promises = [];
		for (let i = 0; i < users.length; i++) {
			function createCheck() { return new Promise (resolve => {
			db.get(`SELECT username FROM users WHERE username = ?`, [users[i].primaryEmail], (err, res) => {
				if(err) {
					console.log(err)
					resolve(err)
				}
				if (res) {
				console.log(users[i].primaryEmail + ' previously created, skipping creation.')
				resolve(false)
				}
				else {
					resolve(true)
				}
			})
			})
			}
		const create = await createCheck()
		if (create) {
		const res = createUser(users[i]);
		console.log('Added ' + users[i].primaryEmail)
		promises.push( await res )
		console.log('Processed ' + promises.length + ' users...\n');
		}
		if (!create) {
			const accessUser = await getAccessUser(users[i]);
			const user = users[i]
			const changedUser = await diffUsers(user, accessUser);
			if (changedUser) {

				 const result = await updateUser(changedUser)
				 const response = {
					
					username: users[i].primaryEmail,
					statuscode: 204
					
				}
				promises.push( response )
			}
			else {
			const response = {
					
				username: users[i].primaryEmail,
				statuscode: 409
				
			}
			promises.push( response )
		}
		}
		}
		return Promise.all(promises)
	}
	const result = await prom() 
	var errcount = 0;
	var createcount = 0;
	var modcount = 0;
	for (let i = 0; i < result.length; i++) {
		const res = result[i];
		if (res.statuscode == 201) {
			createcount++;
		   }
		if (res.statuscode == 204) {
			modcount++;
		   }
		if (res.statuscode == 409)  {
			 errcount++;
		   }
		
	}
	console.log('skipped: ' + errcount)
	console.log('created: ' + createcount)
	console.log('modified: ' + createcount)
	return chalk`{greenBright.bold DONE}`
}

//Function to Sync Partial User List from Google to Access
async function processPartialUserSync() {

	let userEmails = await parseEmailArray();
	let result = await syncPartialUserList(userEmails);
	return result
}

//Function to Sync All Groups from Google to Access
async function processAllGroupSync() {
	console.log(chalk`Processing {cyanBright.bold All Groups Sync}`)
	const groups = await listAllGroups();
	console.log('Processing ' + groups.length + ' groups...\n');
	const prom = async function() {
		var promises = [];
		for (let i = 0; i < groups.length; i++) {

			function createCheck() { return new Promise (resolve => {
			db.get(`SELECT id FROM groups WHERE id = ?`, [groups[i].id], (err, res) => {
				if(err) {
					console.log(err)
					resolve(err)
				}
				
				if(res) {
				console.log(groups[i].name + ` (id/externalId: ${groups[i].id})` + ' previously created, skipping creation. \n')
				resolve(false)
				}
				else {
					resolve(true)
				}
			})
			})
			}
		const create = await createCheck()
	

		if (create) {
		const createGroupResult = await createGroup(groups[i]);
		console.log('Added ' + groups[i].name)
		const members = await getMembers(createGroupResult);
	
		const convertedMembers = await convertMembers(members);
		const res = addMembers(createGroupResult, convertedMembers);
		promises.push( await res )
		console.log('Processed ' + promises.length + ' groups...\n');
		}
		if (!create) {
			const accessGroup = await getAccessGroup(groups[i]);
			const group = groups[i]
			
			const changedGroup = await diffGroup(group, accessGroup);
			if (changedGroup) {

				const res = await updateGroup(changedGroup)
				console.log(res)
			}
			const groupKey = {
				groupkey: groups[i].id
			}
			const members = await getMembers(groupKey);
			const convertedMembers = await convertMembers(members);

			const addDetails = {
				name: groups[i].name,
				accessid: accessGroup[0].id
			}
			const res = addMembers(addDetails, convertedMembers);
			promises.push( await res )
			
			}
		}
		return Promise.all(promises)
	}
	const result = await prom() 
	var errcount = 0;
	var createcount = 0;
	var modcount = 0;
	for (let i = 0; i < result.length; i++) {
		const res = result[i];
		if (res.statuscode == 201) {
			createcount++;
		   }
		if (res.statuscode == 204) {
			modcount++;
		   }
		if (res.statuscode == 409)  {
			 errcount++;
		   }
		
	}
}

//Function to Sync Partial User List from Google to Access
async function processSequenceSync() {
	console.log(chalk`Processing {cyanBright.bold Partial Group Sync}`)
	
	//Step One: Get Group Object Info to sync.
	const ids = await parseGroupIDArray()
	const prom = async function() {
		let promises = []
				for (let i = 0; i < ids.length; i++) {
					async function getGroup() { return new Promise (resolve => {
					
						getGroupById(ids[i]).then(data =>{resolve (data)})
			
					})
					}
					const group = await getGroup()
					promises.push( await group)
					console.log('Processed ' + promises.length + ' groups...\n');
				}
			return Promise.all(promises)
		}
		const groups = await prom()
	//Step Two: Do the Sync.
		const prom2 = async function() {
		console.log(chalk`{cyan.bold Getting Group details and members.}`)
		
			var promises = [];
			var groupResults = [];
			for (let i = 0; i < groups.length; i++) {
	
				function createCheck() { return new Promise (resolve => {
				db.get(`SELECT id FROM groups WHERE id = ?`, [groups[i].id], (err, res) => {
					if(err) {
						console.log(err)
						resolve(err)
					}
					if(res) {
					console.log(groups[i].name + ` (id/externalId: ${groups[i].id})` + ' previously created, skipping creation. \n')
					resolve(false)
					}
					else {
						resolve(true)
					}
				})
				})
				}
			const create = await createCheck()
	
			//CREATE TRUE
			if (create) {
			const createGroupResult = await createGroup(groups[i]); 
			console.log('Added ' + groups[i].name)
			const members = await getMembers(createGroupResult);
			// this is where it changes!
			let memberEmail = []
				for (let i = 0; i < members.length; i++) {
					memberEmail.push(members[i].email)
				}
			promises.push( memberEmail )
			}
			//CREATE FALSE
			if (!create) {
				const groupKey = {
					groupkey: groups[i].id
				}
				const members = await getMembers(groupKey);
				let memberEmail = []
				for (let i = 0; i < members.length; i++) {
					memberEmail.push(members[i].email)
				}
		
				const accessGroup = await getAccessGroup(groups[i]);
				const group = groups[i]
	
				const changedGroup = await diffGroup(group, accessGroup);
				if (changedGroup) {
	
					const res = await updateGroup(changedGroup)
					console.log(res)
				}
				
				promises.push( memberEmail )
		
			}
			}
			return Promise.all(promises)
		}
		const emails = await prom2()
		let emailArray = []
		for (let i = 0; i < emails.length; i++) {
			const vals = emails[i].values()
			for (const value of vals){
				emailArray.push(value)
			}
		}
		console.log(chalk`{cyan.bold Getting list of unique users to sync.}`)
		let userEmails = await parseEmailArray();
	
		for (let i = 0; i < userEmails.length; i++) {
				emailArray.push(userEmails[i])
			}
		
		const uniqueArray = Array.from(new Set(emailArray))
		
	
		let userResult = await syncPartialUserList(uniqueArray);
		//All users added to Access, now need to do memberships
	
		const prom3 = async function() {
		console.log(chalk`{cyan.bold Comparing and updating Group Memberships.}`)
			var promises = [];
			for (let i = 0; i < groups.length; i++) {
	
				const accessGroup = await getAccessGroup(groups[i]);
				const group = groups[i]
				const groupKey = {
					groupkey: groups[i].id
				}
			
				const members = await getMembers(groupKey);
			
				const convertedMembers = await convertMembers(members);
			
	
				const addDetails = {
					name: groups[i].name,
					accessid: accessGroup[0].id
				}
				const res = addMembers(addDetails, convertedMembers);
				promises.push( await res )
				}
			
			return Promise.all(promises)
			}
	
		const membershipresult = await prom3()
		var groupcreatecount = 0
		var groupmodcount = 0
		var grouperrcount = 0
	
		for (let i = 0; i < membershipresult.length; i++) {
			const res = membershipresult[i];
			if (res.statuscode == 201) {
				groupcreatecount++;
			   }
			if (res.statuscode == 204) {
				groupmodcount++;
			   }
			if (res.statuscode == 409)  {
				 grouperrcount++;
			   }
			
		}
		const result = {
			groups: {
				processed: membershipresult.length,
				created: groupcreatecount,
				modified: groupmodcount,
				errors: grouperrcount
			},
			users: userResult.result
		}
		return result
	}

//Function to Sync Partial Group list from Google to Access
async function processPartialGroupSync() {
	console.log(chalk`Processing {cyanBright.bold Partial Group Sync}`)
	//Step One: Get Group Object Info to sync.
	const ids = await parseGroupIDArray()
	const prom = async function() {
		let promises = []
			for (let i = 0; i < ids.length; i++) {
				async function getGroup() { return new Promise (resolve => {
				
					getGroupById(ids[i]).then(data =>{resolve (data)})
		
				})
				}
				const group = await getGroup()
				promises.push( await group)
				console.log('Processed ' + promises.length + ' groups...\n');
			}
		return Promise.all(promises)
	}
	const groups = await prom()
//Step Two: Do the Sync.
	const prom2 = async function() {
		var promises = [];
		for (let i = 0; i < groups.length; i++) {

			function createCheck() { return new Promise (resolve => {
			db.get(`SELECT id FROM groups WHERE id = ?`, [groups[i].id], (err, res) => {
				if(err) {
					console.log(err)
					resolve(err)
				}
				if(res) {
				console.log(groups[i].name + ` (id/externalId: ${groups[i].id})` + ' previously created, skipping creation. \n')
				resolve(false)
				}
				else {
					resolve(true)
				}
			})
			})
			}
		const create = await createCheck()
		console.log('create')
		console.log(create)
		if (create) {
		const createGroupResult = await createGroup(groups[i]); 
		console.log('Added ' + groups[i].name)
		const members = await getMembers(createGroupResult);
		const convertedMembers = await convertMembers(members);
		const res = addMembers(createGroupResult, convertedMembers);
		promises.push( await res )
		console.log('Processed ' + promises.length + ' groups...\n');
		}
		if (!create) {
			const accessGroup = await getAccessGroup(groups[i]);
			const group = groups[i]
			const changedGroup = await diffGroup(group, accessGroup);
			if (changedGroup) {

				const res = await updateGroup(changedGroup)
				console.log(res)
			}

			const groupKey = {
				groupkey: groups[i].id
			}
		
			const members = await getMembers(groupKey);
		
			const convertedMembers = await convertMembers(members);
		

			const addDetails = {
				name: groups[i].name,
				accessid: accessGroup[0].id
			}
			const res = addMembers(addDetails, convertedMembers);
			promises.push( await res )
			console.log('Processed ' + promises.length + ' groups...\n');
			const diffMembers = await diffGroup(members, convertedMembers)
			const aMembers = accessGroup[0].members
			let parsedMembers = []
			
			for (let i = 0; i < aMembers.length; i++) {
				let value = {
					value: aMembers[i].value
				}
				parsedMembers.push(value)
			}

		}
		}
		return Promise.all(promises)
	}
	const result = await prom2() 
	var errcount = 0;
	var createcount = 0;
	var modcount = 0;
	for (let i = 0; i < result.length; i++) {
		const res = result[i];
		if (res.statuscode == 201) {
			createcount++;
		   }
		if (res.statuscode == 204) {
			modcount++;
		   }
		if (res.statuscode == 409)  {
			 errcount++;
		   }
		
	}
}

//Function that runs Sync Functions according to settings.
async function runSync(user, group) {
	console.log(chalk `Scheduled Sync Starting... {greenBright.bold SUCCESS }`)	
		if (group == 'groupall') {
			await processAllUserSync();
			await processAllGroupSync();
		}
		if (group == 'grouppartial') {
			processSequenceSync();
		}
		if (!group ) {
			if (user == 'userall') {
				processAllUserSync();
			}
			if (user == 'userpartial'){
				processPartialUserSync();
			}
		}
}

//Function to put all Config and Settings together and decides what to schedule.
async function doAll() {

	const prom = async function() {
		const sched = await getSchedule()
		const user = await getUserSyncSettings()
		const group = await getGroupSyncSettings() 
		if(sched.length) {
			
				let hUser
				let hGroup
				let hFrequency
				if (user[0].synctype == 'userall'){hUser = 'All Users'}
				if (user[0].synctype == 'userpartial'){hUser = `Selected Users`}
				if (group[0].synctype == 'groupall'){hGroup = `All Groups`}
				if (group[0].synctype == 'grouppartial'){hGroup = `Selected Groups`}
				if (!group[0].synctype){hGroup = `No groups`}
				if (sched[0].frequency == 'hour'){hFrequency = `Hourly (on the hour)`}
				if (sched[0].frequency == 'day'){hFrequency = `Daily at ${sched[0].time}`}
				if (sched[0].frequency == 'week'){hFrequency = `Weekly on ${sched[0].day} at ${sched[0].time}`}
		
				const buildSched = {
					usertype: user[0].synctype,
					uservalues: user[0].syncvalues,
					grouptype: group[0].synctype,
					groupvalues: group[0].syncvalues,
					synctype: sched[0].frequency,
					day: sched[0].day,
					time: sched[0].time,
					hourNumber: sched[0].hourNumber,
					hUser: hUser,
					hGroup: hGroup,
					hFrequency: hFrequency
				}
				return (buildSched)
			}
	
			else {
			let noSched = []
			
			return noSched
			}
		}
		const parsedVals = await prom()
		const doSched = async function(){
			if (parsedVals.synctype == 'hour') {	
				schedule.scheduleJob('0 0 0/1 1/1 * ? *', async function() { runSync(parsedVals.usertype, parsedVals.grouptype) }
				);
				return 'ok'
			}
			if (parsedVals.synctype == 'day') {
				schedule.scheduleJob(`0 0 ${parsedVals.hourNumber} 1/1 * ? *`, function(){
					runSync(parsedVals.usertype, parsedVals.grouptype)
				});	
				return 'ok'
			}
			if (parsedVals.synctype == 'week') {
				schedule.scheduleJob(`0 0 ${parsedVals.hourNumber} ? * ${parsedVals.day} *`, function(){
					runSync(parsedVals.usertype, parsedVals.grouptype)
				});
				return 'ok'
			}
			else {return 'notok'}
		}
	const result = await doSched() 
	if (result == 'ok') {
		
		const prettySchedule = chalk`Rollcall Access-Sync Scheduled {whiteBright.bold ${parsedVals.hFrequency}} for {whiteBright.bold ${parsedVals.hUser}} and {whiteBright.bold ${parsedVals.hGroup}}`
			console.log( prettySchedule )
			return 'scheduledone'
	}
	else {
	
	return parsedVals
	}
}

//42
doAll()