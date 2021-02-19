# Rollcall for Google Directory
# Google Directory to Workspace ONE Access Sync
 
This is an application that is used to provision Users and Groups from a Google Workspace Directory to Workspace ONE Access. Once Users and Groups are created in Access, you can then use the Airwatch Provisioning Application to provision these in Workspace ONE UEM to complete the full synchronisation if needed.

# Rollcall for Google has of two components:

- **API Server** which is a Node.JS and Express application that connects (outbound) to both the Google and Workspace ONE Access Directories via API. It also has locally available APIs so that the Admin UI can communicate to these services for configuration and information.
- **Admin UI** which is this configuration and administrative interface. It also is an interface for additional Workspace ONE Access Tools required to complete Provisioning.

Install Instructions here:



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
