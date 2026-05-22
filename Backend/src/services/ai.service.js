const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer")
const OpenAI = require("openai")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

// const ai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY
// })

async function invokeGeminiAi() {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: "Hello Gemini! Explain What is Interview?"
    })
}

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {

    const prompt = `
        You are an experienced technical interviewer and hiring manager.

        Analyze the candidate's Resume, Self Description, and Job Description deeply and generate a highly realistic interview report.

        Your goal is to create interview questions that:
        - evaluate real technical understanding
        - test problem-solving ability
        - verify authenticity of projects and work experience
        - assess depth of knowledge in mentioned skills
        - identify resume exaggeration or weak areas
        - simulate actual company interview rounds

        IMPORTANT INSTRUCTIONS:

        1. Technical Questions
        - Generate highly relevant technical questions based on:
        - projects
        - internships
        - work experience
        - technologies used
        - frameworks
        - tools
        - architecture decisions
        - deployment
        - APIs
        - databases
        - authentication
        - optimization
        - debugging
        - scalability
        - security
        - system design
        - coding concepts
        - Ask follow-up style questions like real interviews.
        - Questions should progressively increase in difficulty.
        - Include scenario-based and practical questions.
        - Include "why did you choose this approach?" type questions.
        - Include edge cases and tradeoff discussions.
        - Include questions that test whether the candidate actually built the project.
        - DO NOT generate generic textbook questions unless directly relevant.
        - DO NOT limit the number of questions.
        - Generate as many questions as needed based on the resume and job description quality.

        2. Behavioral Questions
        - Generate behavioral and HR questions tailored to:
        - candidate background
        - projects
        - leadership
        - collaboration
        - failures
        - challenges
        - communication
        - decision making
        - conflict handling
        - learning ability
        - time management
        - Questions should feel realistic and company-level.

        3. Answers
        - Provide strong interview-ready guidance.
        - Explain:
        - what interviewer wants to evaluate
        - what points candidate should cover
        - common mistakes to avoid
        - ideal structure of response
        - Keep answers practical and concise.

        4. Skill Gaps
        - Identify genuine missing skills or weak areas.
        - Compare resume against job description carefully.
        - Mention severity honestly.

        5. Preparation Plan
        - Create a practical preparation roadmap.
        - Prioritize weak areas and interview-critical topics.
        - Include mock interviews, revision, and project preparation.

        6. Match Score
        - Give a realistic score between 0 and 100.
        - Do not inflate scores unnecessarily.

        Resume:
        ${resume}

        Self Description:
        ${selfDescription}

        Job Description:
        ${jobDescription}
        `

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
        config: {
            responseMimeType: "application/json",

            responseSchema: {
                type: "object",

                properties: {
                    matchScore: {
                        type: "number"
                    },

                    technicalQuestions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                question: { type: "string" },
                                intention: { type: "string" },
                                answer: { type: "string" }
                            },
                            required: ["question", "intention", "answer"]
                        }
                    },

                    behavioralQuestions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                question: { type: "string" },
                                intention: { type: "string" },
                                answer: { type: "string" }
                            },
                            required: ["question", "intention", "answer"]
                        }
                    },

                    skillGaps: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                skill: { type: "string" },
                                severity: {
                                    type: "string",
                                    enum: ["low", "medium", "high"]
                                }
                            },
                            required: ["skill", "severity"]
                        }
                    },

                    preparationPlan: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                day: { type: "number" },
                                focus: { type: "string" },
                                tasks: {
                                    type: "array",
                                    items: {
                                        type: "string"
                                    }
                                }
                            },
                            required: ["day", "focus", "tasks"]
                        }
                    },

                    title: {
                        type: "string"
                    }
                },

                required: [
                    "matchScore",
                    "technicalQuestions",
                    "behavioralQuestions",
                    "skillGaps",
                    "preparationPlan",
                    "title"
                ]
            }
        }
    })

    return (JSON.parse(response.text))

}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `
You are an expert ATS resume writer and recruiter.

Your task is to optimize and rewrite the candidate's existing resume for the given job description WITHOUT changing factual information.

You MUST follow these strict rules:

1. DO NOT change:
- candidate name
- email
- phone number
- companies
- education
- years
- job titles
- projects
- achievements

2. DO NOT invent:
- fake skills
- fake experience
- fake internships
- fake certifications
- fake projects

3. You MAY:
- improve wording
- rewrite bullet points professionally
- reorder sections
- emphasize relevant skills
- optimize ATS keywords
- improve formatting
- tailor summary for the target role

4. The generated resume should:
- be ATS friendly
- be professional and modern
- look human-written
- be concise (1-2 pages)
- prioritize relevance over quantity
- highlight skills matching the job description
- maintain factual accuracy

5. Important:
The generated resume MUST preserve the candidate's identity and original background. Never replace the candidate with another fictional person.

Return ONLY a valid JSON object in this format:

{
   "html": "<complete HTML resume>"
}

The HTML should:
- include proper structure
- include inline CSS styling
- be visually clean and professional
- work well when converted to PDF using Puppeteer
- avoid external CDN dependencies
- use modern readable fonts
- use subtle professional colors
- support clean PDF rendering

Candidate Resume:
${resume}

Candidate Self Description:
${selfDescription}

Target Job Description:
${jobDescription}
`

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    })


    const jsonContent = JSON.parse(response.text)

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer

}

async function generateMockInterviewReport({

    answers

}) {

    const prompt = `

You are an expert technical interviewer.

Evaluate the candidate's mock interview answers.

For every answer:

- Evaluate technical accuracy
- Evaluate communication clarity
- Evaluate confidence and completeness
- Give score out of 10
- Give concise actionable feedback
- Mention strengths
- Mention areas of improvement

Also provide:

- overall interview score out of 100
- overall interview feedback

Candidate Answers:
${JSON.stringify(answers, null, 2)}

`

    const response =
        await ai.models.generateContent({

            model:
                "gemini-2.5-flash",

            contents: prompt,

            config: {

                responseMimeType:
                    "application/json",

                responseSchema: {

                    type: "object",

                    properties: {

                        answers: {

                            type: "array",

                            items: {

                                type: "object",

                                properties: {

                                    questionIndex: {
                                        type: "number"
                                    },

                                    score: {
                                        type: "number"
                                    },

                                    feedback: {
                                        type: "string"
                                    }

                                },

                                required: [

                                    "questionIndex",

                                    "score",

                                    "feedback"
                                ]
                            }
                        },

                        overallScore: {
                            type: "number"
                        },

                        overallFeedback: {
                            type: "string"
                        }
                    },

                    required: [

                        "answers",

                        "overallScore",

                        "overallFeedback"
                    ]
                }
            }
        })

    const aiEvaluation =
        JSON.parse(response.text)

    const evaluatedAnswers =
        answers.map(answer => {

            const evaluation =
                aiEvaluation.answers.find(

                    item =>

                        item.questionIndex
                        === answer.questionIndex
                )

            return {

                ...answer,

                score:
                    evaluation?.score ?? 0,

                feedback:
                    evaluation?.feedback
                    ?? ""
            }
        })

    return {

        answers:
            evaluatedAnswers,

        overallScore:
            aiEvaluation.overallScore,

        overallFeedback:
            aiEvaluation.overallFeedback
    }
}


module.exports = { generateInterviewReport, generateResumePdf, generateMockInterviewReport }