const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require("cors")

const app = express()

app.use(express.json());
app.use(cookieParser())
app.use(cors({
    origin: "https://interview-prep-2ude.onrender.com",
    credentials: true
}))

/* All the Routes are required here */
const authRouter = require('./routes/auth.routes')
const interviewRouter = require('./routes/interview.routes')

/* Using the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

module.exports = app; 