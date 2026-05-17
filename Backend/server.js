require('dotenv').config();
const app = require('./src/app')

const connectToDB = require('./src/config/database')
// const invokeGeminiAi = require("./src/services/ai.service")
const {resume, selfDescription, jobDescription} = require("./src/services/temp")
const generateInterviewReport = require("./src/services/ai.service")

connectToDB()
// invokeGeminiAi()
// generateInterviewReport({resume, selfDescription, jobDescription})

app.listen(3000, () => {
    console.log("Sever is listening on port 3000")
})