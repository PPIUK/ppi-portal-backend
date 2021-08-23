# DatabasePPIUK

##Doc In Progress!

All endpoint paths start with `/api`.

## Errors
Any internal server-side error will return 500 to the caller.
Handle it as you wish.

## Auth flow
1. POST `/auth/account-lookup` should be called by the initial sign-in page with the email as the param.
Email can be either university email or personal email.  
Request body: 
    ```
    {"email": email value} 
    ```  
   Possible responses:
    - 404: Account not found. Call POST `/auth/register/new` or redirect to `/census`
     to register?
    - 310: Email found, but password hasn't been set up.
    University email is returned inside the response's body: email.
    Call POST `/auth/set-password`.
    - 311: Email found, but hasn't been verified yet. 
    University email is returned inside the response's body: email.
    Ask user to check their email, or offer to resend the verification email, 
    by calling POST `/auth/resend-verification`.
    - 200: Email found, password has been set up, account has been verified.
    University email is returned inside the response's body: email.
    Ask user to input password, then call POST `/auth/login.`  

    Response body: 
    ```
    {
        "message": message value, 
        "email": email value #not for 404, this is university email, not personal email
    }
   ```
   
2. POST `/auth/set-password`. Lets user to set a password for their account.
Email value should be autofilled with the university email received from `/auth/account-lookup`.
User will need to check their email for verification email.  
Request body:
   ```
   {
        "email": university email value,
        "password": new password value
   }
   ```
   Possible responses:
   - 404: Profile with that email not found.
   - 409: Account had been registered, with password. Ask user to login (`/auth/login`)
   - 400: Email is not a valid UK university email. Or, password is empty. Check error message.
   - 201: Account registered. Verification email has been sent. Ask user to check their email, 
   or offer to resend the verification email, by calling POST `/auth/resend-verification`.

    Response body: 
    ```
    { "message": message value }
   ```

3. POST `/auth/resend-verification`. Asks to resend a verification email.  
Request body:
   ```
   {
        "email": university email value
   }
   ```
   Possible responses:  
   - 404: Profile with that email not found.
   - 409: Account with that email had been verified before. Ask user to login `/auth/login`.
   - 400: Email is not a valid UK university email.
   - 201: Verification email has been sent again. Ask user to check their email, 
   or offer to resend the verification email, by calling POST `/auth/resend-verification`.  
   
   Response body: 
   ```
   { "message": message value }
    ```

4. GET `/auth/verify-email/:token`. Verifies the email. 
emailVerified field changes to true.  
Request param: token.  
Possible responses:
    - 400: Token is not provided as param. Or, account had been verified previously, ask user to log in. Check message.
    - 404: Valid token is not found. Token may be expired. May offer user to resend verification email by calling POST `/auth/resend-verification`.
    Or, profile for that token is not found.
    - 200: Email verification success. Ask user to login.

5. POST `/auth/login`.  
username value should be autofilled with the university email value received from `/auth/account-lookup.`,
although personal email should also work in this case.
Request body:
   ```
   {
        "username": university email value,
        "password": new password value,
        "client_id": "api",
        "grant_type": "password" #value must be the string 'password'
   }
   ```
   Possible responses:
   - 404: Profile with that email not found.
   - 401: Email hasn't been verified.
   - 400: User credentials are invalid (handled by middleware)
   - 200: Login success. Access token returned.
   
   Response body: 
   ```
   {
       "access_token": access token value, 
       "token_type": "Bearer",
       "expires_in": 3599, #currently access token only valid for 1 hour.
       "refresh_token": refresh token value 
   }
    ```
   
6. POST `/auth/logout`. Deletes the access token.
No request body needed, however access token needs to be included in header 
(Authorization: Bearer **token**)  
Possible responses:
    - 200: Logged out.
    - 401: Unauthorized, access token not valid

7. POST `/auth/token`. Gets new access token.  
If at any time when accessing the endpoints 401 is returned with the body below:
    ```
    {
        "error": "invalid_token",
        "error_description": "Invalid token: access token has expired"
    }
    ```
   ,you can call this `/auth/token` endpoint to get a new access token.
   
   Request body:
   ```
   {
        "client_id": "api",
        "grant_type": "refresh_token" #value must be the string 'refresh_token',
        "refresh_token": refresh token value that you get before
   }
   ```
   
   Possible responses:
   - 200: New access token is returned.
   - 400: Bad request. Refresh token is invalid
   
   Response body:
   ```
   {
       "access_token": new access token value,
       "token_type": "Bearer",
       "expires_in": 3599,
       "refresh_token": new refresh token value
   }
   ```

8. POST `/auth/forgot`. Sends an email with a token for resetting password.  
Request body:
    ```
    {
        "email": email address value
    }
    ```
   The token will be sent to the university email address, regardless of what is included in body.
   
   Possible responses:
   - 404: profile with the email not found.
   - 201: Email with token sent.
   
   Response body: 
   ```
   { "message": message value }
    ```
   
9. GET `/auth/reset-password/:token`. Checks if the token is valid.
If it is, a reset password form should be shown to user.
Possible responses:
    - 404: Token not valid or profile not found.
    - 200: Token is valid, should redirect to password reset form.
    
10. POST `/auth/reset-password/:token`. Resets the password.
Request body:
    ```
    {
        "email": email value,
        "password": new password value
    }
    ```
    Possible responses:
    - 400: password or token not included.
    - 404: token not valid or profile not found.
    - 401: token doesn't match email
    - 200: Password reset successful.
    
    Response body:
    ```
       { "message": message value }
    ```
-------------------------------
The main data endpoints are self-documented in "profileController.js".
Endpoints in that file can only be called by providing the correct access_token.

If you need to directly use this Backend to the Database, please change the database link on server.js.

The public information on the database is Name, Branch, University, Degree Level, and Course. There is no "country" yet, because obviously, everyone who fills the form should be living in the UK.
