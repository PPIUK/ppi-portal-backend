# DatabasePPIUK

This PPI UK Database Backend have a few main functions:

- New : Create new database
  - use localhost:3000/api/profiles POST to view all profile
- View : View new database
  - use localhost:3000/api/profiles/{profile_id} GET to view a specific profile
- View Public : View public informations of the database
  - use localhost:3000/api/profiles/{profile_id}/public GET to view a specific public profile
- Update : Update informations on the database
  - use localhost:3000/api/profiles/{profile_id} UPDATE to update a specific profile
- Delete : Deletes information from the database
  - use localhost:3000/api/profiles/{profile_id} DELETE to delete a specific profile

The functions can be found on "profileController.js".

If you need to directly use this Backend to the Database, please change the database link on server.js.

The public information on the database is Name, Branch, University, Degree Level, and Course. There is no "country" yet, because obviously, everyone who fills the form should be living in the UK.
