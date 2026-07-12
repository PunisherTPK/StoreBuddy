import mysql from "mysql2/promise";


const dbConfig = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "mypass",
  database: process.env.MYSQL_DATABASE || "storebuddy"
};

const db = await mysql.createConnection(dbConfig);
console.log("Connected.");
