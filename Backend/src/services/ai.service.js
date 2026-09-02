const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

// Prefer flash-lite; fall back when Google returns 503 / UNAVAILABLE (high demand).
const GEMINI_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]

function isTransientGeminiError(err) {
    const status = err?.status ?? err?.error?.code
    const message = String(err?.message || "")
    return (
        status === 503 ||
        status === 429 ||
        /UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|try again/i.test(message)
    )
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Call Gemini with retries and model fallbacks for transient overload errors.
 */
async function generateContentWithRetry(params, {
    models = GEMINI_MODELS,
    maxAttemptsPerModel = 2,
} = {}) {
    let lastError

    for (const model of models) {
        for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
            try {
                return await ai.models.generateContent({
                    ...params,
                    model,
                })
            } catch (err) {
                lastError = err
                if (!isTransientGeminiError(err)) throw err
                const delayMs = 800 * attempt
                console.warn(
                    `Gemini ${model} attempt ${attempt} failed (${err.status || "transient"}); retrying in ${delayMs}ms…`
                )
                await sleep(delayMs)
            }
        }
    }

    throw lastError
}

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc."),
        sourceGrounding: z.string().describe("Exact proof from Resume or JD for asking this question")
    })).describe("Technical questions that can be asked in the interview along with their intention, answer, and grounding source"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc."),
        sourceGrounding: z.string().describe("Exact proof from Resume or Self Description for asking this question")
    })).describe("Behavioral questions that can be asked in the interview along with their grounding source"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of this skill gap"),
        justification: z.string().describe("Why this skill gap is fair based on JD requirements vs candidate profile")
    })).describe("List of skill gaps in the candidate's profile along with severity and fairness justification"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan"),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day")
    })).describe("A day-wise preparation plan"),
    validation: z.object({
        qualityScore: z.number(),
        verdict: z.enum(["Excellent Alignment", "Good Alignment", "Moderate Misalignment", "Significant Misalignment", "Poor Alignment"]),
        verdictExplanation: z.string()
    }),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {

    const prompt = `
        You are a Principal Software Engineer, Senior Technical Lead, and Hiring Manager at a top-tier technology company.

        Your goal is to deeply analyze the candidate's profile against the target job description and generate an elite, realistic, and highly actionable Interview Report.

        INPUT CONTEXT:
        - Candidate Resume:
        ${resume || "Not provided"}

        - Candidate Self Description:
        ${selfDescription || "Not provided"}

        - Target Job Description (JD):
        ${jobDescription}

        ANALYSIS FIRST (do this mentally before writing output):
        1. Extract every important technology, tool, framework, soft skill, and responsibility from the JD.
        2. Extract every technology, project, and experience signal from the Resume / Self Description.
        3. Build an overlap set (candidate already has) and a gap set (JD requires, candidate lacks).
        4. Decide how many questions are needed based on that analysis — NOT a fixed number.
           - Broader / more senior JDs → more technical questions.
           - More projects / leadership signals in resume → more behavioral questions.
           - Cover BOTH overlapping skills (depth checks) AND gap skills (JD-required but missing on resume).
           - Typical healthy range is roughly 5–12 technical and 4–8 behavioral, but use more or fewer if the inputs justify it.
           - Never return empty arrays when enough signal exists in the JD or resume.

        STRICT GROUNDING & ACCURACY RULES:
        1. Technical questions MUST be grounded in the Resume/Self Description OR the Job Description (including JD-only skills the candidate must prepare for).
        2. Do NOT invent tools that appear in NEITHER the Resume/Self Description NOR the JD.
        3. sourceGrounding: cite exact origin (e.g. "Resume - Project: E-commerce Backend", "Job Description - Required Skill: Redis").
        4. groundedSkills / mentionedTechnologies: use short canonical skill names that literally appear in Resume or JD (e.g. "Redis", "Kafka", "Node.js") — not long sentences.
        5. SKILL GAPS: List EVERY meaningful JD-required skill/tool that is missing or clearly weak in the Resume/Self Description (e.g. if JD mentions Redis and Kafka and resume does not, BOTH must appear as skill gaps).

        DETAILED SECTION INSTRUCTIONS:

        1. TECHNICAL QUESTIONS & ANSWERS:
           - Mix: Core Concepts, Practical/Scenario, Architecture/System Design, Tradeoff/Optimization.
           - Include questions on JD-required gap skills so the candidate can prepare for them.
           - "question", "intention", "answer", "sourceGrounding" as usual.

        2. BEHAVIORAL QUESTIONS:
           - Scenario / HR questions tailored to the role seniority and resume signals (leadership, conflict, failure recovery, delivery, collaboration, ownership).
           - "answer" using STAR method guidance.
           - groundedSkills / mentionedTechnologies may be empty arrays for pure behavioral questions.

        3. SKILL GAPS:
           - One entry per missing/weak JD skill.
           - severity: "low" | "medium" | "high" by criticality to the role.
           - justification: why it is fair based on JD vs candidate profile.
           - skill field must be a short name (e.g. "Kafka", "Redis"), not a sentence.

        4. PREPARATION PLAN:
           - Practical day-by-day roadmap focused on closing skill gaps and practicing likely interview questions.

        5. MATCH SCORE & ALIGNMENT AUDIT:
           - matchScore 0–100 from overall alignment.
           - validation: qualityScore, verdict, verdictExplanation.
    `

    const response = await generateContentWithRetry({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "object",
                properties: {
                    matchScore: { type: "number" },
                    title: { type: "string" },
                    technicalQuestions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                question: { type: "string" },
                                intention: { type: "string" },
                                answer: { type: "string" },
                                sourceGrounding: { type: "string" },
                                groundedSkills: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                mentionedTechnologies: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            },
                            required: ["question", "intention", "answer", "sourceGrounding", "groundedSkills", "mentionedTechnologies"]
                        }
                    },
                    behavioralQuestions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                question: { type: "string" },
                                intention: { type: "string" },
                                answer: { type: "string" },
                                sourceGrounding: { type: "string" },
                                groundedSkills: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                mentionedTechnologies: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            },
                            required: ["question", "intention", "answer", "sourceGrounding", "groundedSkills", "mentionedTechnologies"]
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
                                },
                                justification: { type: "string" }
                            },
                            required: ["skill", "severity", "justification"]
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
                                    items: { type: "string" }
                                }
                            },
                            required: ["day", "focus", "tasks"]
                        }
                    },
                    validation: {
                        type: "object",
                        properties: {
                            qualityScore: { type: "number" },
                            verdict: {
                                type: "string",
                                enum: [
                                    "Excellent Alignment",
                                    "Good Alignment",
                                    "Moderate Misalignment",
                                    "Significant Misalignment",
                                    "Poor Alignment"
                                ]
                            },
                            verdictExplanation: { type: "string" }
                        },
                        required: ["qualityScore", "verdict", "verdictExplanation"]
                    }
                },
                required: [
                    "matchScore",
                    "title",
                    "technicalQuestions",
                    "behavioralQuestions",
                    "skillGaps",
                    "preparationPlan",
                    "validation"
                ]
            }
        }
    })

    const interviewReportData = JSON.parse(response.text)

    // =========================================================================
    // LEVEL 2 DETERMINISTIC VERIFICATION + SKILL GAP DETECTION
    // Soft-check questions (annotate, rarely drop). Hard-detect fair skill gaps.
    // =========================================================================
    const combinedInputText = `${resume || ""} ${selfDescription || ""} ${jobDescription || ""}`.toLowerCase()
    const resumeAndSelfText = `${resume || ""} ${selfDescription || ""}`.toLowerCase()
    const jdText = `${jobDescription || ""}`.toLowerCase()

    const isKeywordPresent = (keyword, targetText) => {
        if (!keyword || !targetText) return false
        const cleanKey = keyword.toLowerCase().trim()
        if (cleanKey.length <= 1) return false
        const escaped = cleanKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        const regex = new RegExp(`(?:^|[^a-z0-9.+#])${escaped}(?:$|[^a-z0-9.+#])`, 'i')
        return regex.test(targetText)
    }

    // Canonical tech names + common aliases for matching (kafka ≈ apache kafka, etc.)
    const TECH_ALIASES = {
        kafka: ["kafka", "apache kafka"],
        redis: ["redis"],
        rabbitmq: ["rabbitmq", "rabbit mq", "rabbit"],
        docker: ["docker"],
        kubernetes: ["kubernetes", "k8s"],
        k8s: ["kubernetes", "k8s"],
        aws: ["aws", "amazon web services"],
        azure: ["azure"],
        gcp: ["gcp", "google cloud"],
        postgres: ["postgres", "postgresql"],
        postgresql: ["postgres", "postgresql"],
        mysql: ["mysql"],
        mongodb: ["mongodb", "mongo"],
        graphql: ["graphql"],
        grpc: ["grpc"],
        nodejs: ["node.js", "nodejs", "node"],
        "node.js": ["node.js", "nodejs", "node"],
        react: ["react", "react.js", "reactjs"],
        typescript: ["typescript", "ts"],
        javascript: ["javascript", "js"],
        python: ["python"],
        java: ["java"],
        golang: ["go", "golang"],
        go: ["go", "golang"],
        terraform: ["terraform"],
        elasticsearch: ["elasticsearch", "elastic search"],
        dynamodb: ["dynamodb", "dynamo db"],
        lambda: ["lambda", "aws lambda"],
        s3: ["s3"],
        nginx: ["nginx"],
        mongoose: ["mongoose"],
        prisma: ["prisma"],
        redux: ["redux"],
        nextjs: ["next.js", "nextjs"],
        "next.js": ["next.js", "nextjs"],
    }

    const KNOWN_TECH_LEXICON = [
        "kafka", "rabbitmq", "activemq", "sqs", "sns", "pubsub", "nats", "bullmq",
        "docker", "kubernetes", "k8s", "helm", "terraform", "ansible",
        "aws", "azure", "gcp", "ec2", "s3", "lambda", "ecs", "eks", "dynamodb",
        "graphql", "grpc", "protobuf", "websocket", "webrtc",
        "redis", "memcached", "elasticsearch", "opensearch",
        "postgres", "postgresql", "mysql", "mongodb", "sqlite", "cassandra", "neo4j",
        "prisma", "mongoose", "typeorm", "sequelize", "supabase", "firebase", "nginx",
        "spark", "hadoop", "flink", "snowflake", "databricks", "bigquery",
        "rust", "golang", "java", "kotlin", "scala", "python", "django", "flask", "fastapi",
        "nodejs", "node.js", "typescript", "javascript", "react", "next.js", "nextjs",
        "vue", "angular", "svelte", "tailwind", "redux", "zustand",
        "jenkins", "prometheus", "grafana", "datadog", "opentelemetry"
    ]

    const skillAppearsInText = (skill, targetText) => {
        if (!skill || !targetText) return false
        const clean = skill.toLowerCase().trim()
        if (isKeywordPresent(clean, targetText)) return true

        const aliases = TECH_ALIASES[clean]
        if (aliases && aliases.some((alias) => isKeywordPresent(alias, targetText))) {
            return true
        }

        // Multi-word AI labels like "Redis Caching" → check primary token "redis"
        const tokens = clean.split(/[\s,/|()]+/).filter((t) => t.length > 2)
        return tokens.some((token) => {
            if (TECH_ALIASES[token]) {
                return TECH_ALIASES[token].some((alias) => isKeywordPresent(alias, targetText))
            }
            return isKeywordPresent(token, targetText)
        })
    }

    // Reject only if question invents a known tech that appears in NEITHER resume nor JD
    const findUnverifiedForeignTechInQuestion = (questionText) => {
        if (!questionText) return null
        const qLower = questionText.toLowerCase()

        for (const tech of KNOWN_TECH_LEXICON) {
            if (skillAppearsInText(tech, qLower) && !skillAppearsInText(tech, combinedInputText)) {
                return tech
            }
        }
        return null
    }

    // 1. Technical questions — keep grounded ones; drop only pure hallucinations
    const verifiedTechnicalQuestions = (interviewReportData.technicalQuestions || []).map((q) => {
        const foreignTechFound = findUnverifiedForeignTechInQuestion(q.question)
        const isVerified = !foreignTechFound

        return {
            ...q,
            isVerified,
            verificationStatus: foreignTechFound
                ? `REJECTED_SECRET_FOREIGN_TECH (asks about '${foreignTechFound}' missing from Resume & JD)`
                : "VERIFIED_GROUNDED"
        }
    })

    // 2. Behavioral questions — keep all (soft-skill grounded in role/resume, not tech lexicon)
    const verifiedBehavioralQuestions = (interviewReportData.behavioralQuestions || []).map((q) => ({
        ...q,
        isVerified: true,
        verificationStatus: "VERIFIED_BEHAVIORAL"
    }))

    // 3. Skill gaps — verify AI gaps + programmatically detect JD techs missing from resume
    const aiSkillGaps = (interviewReportData.skillGaps || []).map((sg) => {
        const existsInJD = skillAppearsInText(sg.skill, jdText)
        const existsInResume = skillAppearsInText(sg.skill, resumeAndSelfText)
        const isFairGap = existsInJD && !existsInResume

        return {
            ...sg,
            isVerifiedFair: isFairGap,
            verificationStatus: isFairGap
                ? "VERIFIED_FAIR_GAP"
                : existsInResume
                    ? "UNFAIR_GAP_CANDIDATE_ALREADY_HAS_SKILL"
                    : "UNVERIFIED_GAP_NOT_IN_JD"
        }
    })

    const programmaticGaps = []
    for (const tech of KNOWN_TECH_LEXICON) {
        const inJD = skillAppearsInText(tech, jdText)
        const inResume = skillAppearsInText(tech, resumeAndSelfText)

        if (inJD && !inResume) {
            const alreadyListed = [...aiSkillGaps, ...programmaticGaps].some(
                (g) => g.skill.toLowerCase() === tech || skillAppearsInText(tech, g.skill.toLowerCase())
            )

            if (!alreadyListed) {
                programmaticGaps.push({
                    skill: tech.charAt(0).toUpperCase() + tech.slice(1),
                    severity: "high",
                    justification: `Required in the Job Description but not found in the candidate's Resume / Self Description.`,
                    isVerifiedFair: true,
                    verificationStatus: "VERIFIED_FAIR_GAP_PROGRAMMATIC"
                })
            }
        }
    }

    // Prefer fair gaps only so sidebar shows real missing skills (Redis, Kafka, etc.)
    const finalSkillGaps = [
        ...aiSkillGaps.filter((g) => g.isVerifiedFair),
        ...programmaticGaps
    ]

    // 4. Grounding accuracy (informational)
    const totalQuestions = verifiedTechnicalQuestions.length + verifiedBehavioralQuestions.length
    const verifiedCount =
        verifiedTechnicalQuestions.filter((q) => q.isVerified).length +
        verifiedBehavioralQuestions.filter((q) => q.isVerified).length
    const groundingAccuracyScore = totalQuestions > 0
        ? Math.round((verifiedCount / totalQuestions) * 100)
        : 100

    const finalTechnicalQuestions = verifiedTechnicalQuestions.filter((q) => q.isVerified)
    const finalBehavioralQuestions = verifiedBehavioralQuestions.filter((q) => q.isVerified)

    return {
        ...interviewReportData,
        technicalQuestions: finalTechnicalQuestions,
        behavioralQuestions: finalBehavioralQuestions,
        skillGaps: finalSkillGaps,
        validation: {
            ...interviewReportData.validation,
            groundingAccuracyScore
        }
    }
}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage();

    // Enforce compact one-page black Calibri resume styling regardless of AI HTML choices
    const enforcedStyles = `
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    font-family: Calibri, "Segoe UI", Arial, sans-serif !important;
    font-size: 10.5pt !important;
    line-height: 1.25 !important;
    color: #000000 !important;
    background: #ffffff !important;
  }
  body { padding: 0 !important; }
  h1, h2, h3, h4, h5, h6, p, li, span, a, div, td, th, strong, em, b, i, ul, ol {
    color: #000000 !important;
    font-family: Calibri, "Segoe UI", Arial, sans-serif !important;
  }
  a { text-decoration: none !important; }
  h1 {
    font-size: 16pt !important;
    font-weight: 700 !important;
    margin: 0 0 2pt 0 !important;
    line-height: 1.15 !important;
  }
  h2, h3 {
    font-size: 14pt !important;
    font-weight: 700 !important;
    margin: 8pt 0 3pt 0 !important;
    padding-bottom: 2pt !important;
    border-bottom: 1px solid #000000 !important;
    line-height: 1.15 !important;
  }
  p, li {
    font-size: 10.5pt !important;
    margin: 0 0 2pt 0 !important;
    line-height: 1.2 !important;
  }
  ul, ol {
    margin: 0 0 4pt 0 !important;
    padding-left: 14pt !important;
  }
  section, .section { margin: 0 0 4pt 0 !important; }
</style>
`

    const htmlWithStyles = /<\/head>/i.test(htmlContent)
        ? htmlContent.replace(/<\/head>/i, `${enforcedStyles}</head>`)
        : `<!DOCTYPE html><html><head>${enforcedStyles}</head><body>${htmlContent}</body></html>`

    await page.setContent(htmlWithStyles, { waitUntil: "networkidle0" })

    // Tight margins — most spacing lives inside the HTML so content can fill one page
    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
            top: "8mm",
            bottom: "8mm",
            left: "8mm",
            right: "8mm"
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
- be professional
- look human-written
- fit STRICTLY on ONE page (A4)
- prioritize relevance over quantity
- highlight skills matching the job description
- maintain factual accuracy

5. Important:
The generated resume MUST preserve the candidate's identity and original background. Never replace the candidate with another fictional person.

6. DESIGN RULES (mandatory — apply via inline CSS):
- Font family: Calibri, "Segoe UI", Arial, sans-serif ONLY (same font everywhere)
- ALL text color: #000000 (black only — no colored accents, no gray body text, no blue links)
- Body / bullet text: 10pt to 11pt
- Section headings: 14pt to 15pt, bold, black, with a thin black bottom border
- Candidate name: 16pt bold black
- Contact line under name: 10pt black
- Page margins inside HTML: padding 0; keep content dense
- Line-height: 1.25 for body; 1.15 for bullets
- Section spacing: small (margin-top ~8px, margin-bottom ~4px)
- No multi-column sidebars, no colored bars, no icons, no tables for layout unless necessary
- Prefer compact single-column layout that fits one A4 page
- Keep bullet points short (1 line each when possible)

Return ONLY a valid JSON object in this format:

{
   "html": "<complete HTML resume>"
}

The HTML should:
- be a full HTML document with <style> or inline styles
- follow ALL design rules above exactly
- work well when converted to PDF using Puppeteer
- avoid external CDN dependencies
- use only black text on white background

Candidate Resume:
${resume}

Candidate Self Description:
${selfDescription}

Target Job Description:
${jobDescription}
`

    const response = await generateContentWithRetry({
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
        await generateContentWithRetry({

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