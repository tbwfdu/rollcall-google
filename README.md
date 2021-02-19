# Rollcall for Google Directory
# Google Directory to Workspace ONE Access Sync
 
This is an application that is used to provision Users and Groups from a Google Workspace Directory to Workspace ONE Access. Once Users and Groups are created in Access, you can then use the Airwatch Provisioning Application to provision these in Workspace ONE UEM to complete the full synchronisation if needed.

# Rollcall for Google has of two components:

- **API Server** which is a Node.JS and Express application that connects (outbound) to both the Google and Workspace ONE Access Directories via API. It also has locally available APIs so that the Admin UI can communicate to these services for configuration and information.
- **Admin UI** which is this configuration and administrative interface. It also is an interface for additional Workspace ONE Access Tools required to complete Provisioning.

**Install Instructions:**

Requires NodeJS

- Clone this repo.
- Obtain a [Client ID and Client Secret](https://docs.vmware.com/en/VMware-Workspace-ONE-Access/services/ws1_access_service_administration_cloud/GUID-AD4B6F91-2D68-48F2-9212-5B69D40A1FAE.html?hWord=N4IghgNiBcIMYQJYFMB2AXABIgJiAvkA) from the Admin Portal of Workspace ONE Access.
- Follow **Step 1 only** in the [Google API documentation](https://developers.google.com/admin-sdk/directory/v1/quickstart/nodejs#step_1_turn_on_the).
- **Make sure you save the credentials.json file to ./lib/credentials.json**
- cd into the directory and run `npm install`
- This will install all dependencies and then do an initial auth against Google.
- You will need to go to the displayed URL and then enter the return code.
- You can then run `npm start` and the api-server and the ui-server will start.

**Configuration Instructions:**
- The API Server listens on localhost:8080. There's nothing you need to do with this but you can see status responses in the console.
- The UI Server listens on localhost:81. You need to do some configuration in this UI before Sync can occur.
- Go to `http://localhost:81/config` (or the configuration tab) and you need to enter your `Access Client ID, Client Secret, Tenant URL` **with NO trailing slash at the end '/'** and also the `"domain"` that users will be synced from `(eg. example.local etc.)`.
- Once this is saved, go to `Additional Tools -> Create Directory` and then create a new directory with the same domain as in the previous step.
- Now, go to `Configuration -> Sync Settings` and you can specify a Sync Schedule, and then which Users/Groups to sync.
- To specify which Users/Groups to sync, click search to display the results and then either select from the list, or select Sync All and this will add these to the sync process.
- To force a sync, press the Sync Now in the top right corner.

--------
##### v2.0
- Initial Deployment

Version 2.0 as its a "built from the ground up" version of my other Rollcall service.

**Capabilities:**
- Synchronise individual users from Google to Access by selecting them in the returned results.
- Synchronise **all** users from the Google Directory.
- Synchronise individual or multiple groups, **including the users contained within**, from Google to Access.
- Synchronise **all** groups from the Google Directory (this implies all users as well).
- Set a Sync Schedule for: Hourly (on the hour), Daily (specify time) or Weekly (specify date and time).
- Display current users and groups from Google and Access Directories.

**Notes:**
- Currently only default user attributes that are required for Access are synchronised. Additional attributes are either immutable or cannot be used in Access using this method.
- User enabled/disabled status is sent from Google to Access, but this application does not remove them from Access at this stage. Group Memberships and any User Attribute changes (First Name, Last Name, Email Address) are always updated at each sync cycle.
- Each sync cycle looks at the database and checks for which objects to sync. **Sync only happens while the app is running, as this is not a 'Service'**.
- During each sync, the process looks at the local sync database (./database/googledb.db) and check to see if the user or group has already been created and will do a comparison of attibutes instead if it already exists. Group sync will update the Group Name if it has changed, and will compare group memberships. If the user does not exist, it will schedule it for creation.
- Google Directory API secrets are stored in ./lib and need to exist to get the required authentication (see instructions.)
- Workspace ONE Access API secrets are stored in ./database/secrets.db along with sync settings. These are not encrypted ensure appropriate access control.

- Once users and groups have been created, you then need to use [Google as a 3rd Party IDP] (http://blog.tbwfdu.com/2018/11/google-cloud-directory-as-3rd-party-idp.html) to authenticate the users in this directory.
