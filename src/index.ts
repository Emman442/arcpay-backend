import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import morgan from "morgan";

dotenv.config();


const app = express();
const PORT = 5000;
const DB_URL = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yrqq1im.mongodb.net/stakeForge?retryWrites=true&w=majority`
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Stake Forge API is running");
});
mongoose.connect(DB_URL, {  
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.error("Error connecting to MongoDB:", err);
});

app.use(morgan("dev"))



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});