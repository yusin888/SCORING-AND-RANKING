# MongoDB Atlas Connection Setup

## Connection Details
The application is set up to connect to MongoDB Atlas using the connection string provided in your `.env` file.

## Current Connection Issue
The connection test is failing with an "Authentication failed" error. This is likely due to one of the following reasons:

1. The username or password in the connection string might be incorrect
2. Special characters in the username or password need URL encoding
3. The user might not have the proper access permissions to the database
4. The IP address you're connecting from might not be on the allowed access list

## Steps to Fix the Connection

### 1. Verify User Credentials
- Log in to MongoDB Atlas dashboard
- Go to Database Access section
- Check if the user "yunisaden3" exists and has the correct password
- Create a new database user if needed

### 2. Add Your IP to Access List
- Go to Network Access section in MongoDB Atlas
- Click "Add IP Address"
- Either add your specific IP or use "0.0.0.0/0" for development (not recommended for production)

### 3. Update Connection String in .env
Make sure your connection string is properly formatted:

```
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.kmlpoko.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

If your password contains special characters, make sure to URL encode them:
- @ should be %40
- # should be %23
- $ should be %24
- etc.

### 4. Test Connection Again
Run the connection test after making the changes:

```
npm run test-db
```

## Using Your Own Database
If you want to use your own MongoDB Atlas database:

1. Sign up or log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Click "Connect" on your cluster
4. Choose "Connect your application"
5. Copy the connection string
6. Replace the MONGO_URI in your .env file
7. Replace `<username>` and `<password>` with your actual database username and password

## Troubleshooting
If you're still having issues:
- Check MongoDB Atlas logs for failed connection attempts
- Make sure your database name is correctly specified in the connection string
- Verify that your MongoDB Atlas cluster is running (not paused) 