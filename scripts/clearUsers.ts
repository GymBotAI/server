import Enquirer from "enquirer";

const confirmationString =
  "I understand that this will delete all the users in the database";

const { confirm } = await Enquirer.prompt<{
  confirm: boolean;
}>({
  type: "confirm",
  name: "confirm",
  message: "Are you sure you want to delete all the users?",
});

if (!confirm) {
  process.exit();
}

const { confirmString } = await Enquirer.prompt<{
  confirmString: string;
}>({
  type: "input",
  name: "confirmString",
  message: `Please type "${confirmationString}" to confirm`,
});

if (confirmString.trim() != confirmationString) {
  process.exit();
}

console.log("Initializing database...");

import mysql from "mysql2/promise";

import dbConfig from "../src/db-config";

// Connect to the database
console.log("Connecting to database...");
const db = await mysql.createConnection(dbConfig);

// Delete all the accounts in the database
console.log("Deleting all users...");
await db.execute("DELETE FROM users");

// Close the database connection
console.log("Closing database connection...");
await db.end();

console.log("Done!");
