const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf, generateMockInterviewReport } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")
const mockInterviewReportModel = require("../models/mockInterviewReport.model")


async function createMockInterviewController(req, res) {

    try {

        const { interviewId } = req.params;

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewId,
            user: req.user.id
        })

        if (!interviewReport) {
            return res.status(400).json({
                message: "Interview Report does not exist"
            })
        }

        const mockInterviewReport = await mockInterviewReportModel.create({
            user: req.user.id,
            interviewReport: interviewId,
            status: "in-progress",
            overallFeedback: "Mock interview started.",
            overallScore: 0
        })

        res.status(201).json({
            message: "Mock Interview has started",
            mockInterviewReport
        })

    } catch (err) {

        console.error("MOCK CREATE ERROR:", err)

        res.status(500).json({
            message: err.message,
            stack: err.stack
        })
    }

}

/**
 * 
 */
async function getAllMockInterviewByInterviewIdController(req, res) {

    const { interviewId } = req.params;

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const mockInterviews = await mockInterviewReportModel.find({ interviewReport: interviewId, user: req.user.id }).sort({
        createdAt: -1
    })

    if (mockInterviews.length === 0) {
        return res.status(404).json({
            message: "Interview not found."
        })
    }

    res.status(200).json({
        message: "Mock Interviews fetched successfully.",
        mockInterviews
    })

}

async function getMockInterviewByIdController(req, res) {

    const { interviewId, mockId } = req.params

    const mockInterview = await mockInterviewReportModel.findOne({ _id: mockId, interviewReport: interviewId, user: req.user.id })

    if (!mockInterview) {

        return res.status(404).json({
            message: "Mock Interview not found."
        })
    }

    res.status(200).json({

        message: "Mock Interview fetched successfully.",
        mockInterview

    })
}

async function deleteMockInterviewByIdController(req, res) {

    const { interviewId, mockId } = req.params

    const mockInterview = await mockInterviewReportModel.findOne({ _id: mockId, interviewReport: interviewId, user: req.user.id })

    if (!mockInterview) {

        return res.status(404).json({
            message: "Mock Interview not found."
        })
    }

    await mockInterviewReportModel.deleteOne({ _id: mockId, interviewReport: interviewId, user: req.user.id })

    res.status(200).json({
        message: "Mock Interview deleted successfully.",
    })

}

async function generateMockInterviewReportController(req, res) {

    try {

        const { answers } = req.body;

        const { interviewId, mockId } = req.params;

        if (!answers || answers.length === 0) {
            return res.status(400).json({
                message: "Mock Interview Answers are Required"
            })
        }

        const mockInterviewReport = await mockInterviewReportModel.findOne({
            user: req.user.id,
            interviewReport: interviewId,
            _id: mockId
        })

        if (!mockInterviewReport) {
            return res.status(400).json({
                message: "Mock Interview Report not found"
            })
        }

        const mockInterviewReportByAi = await generateMockInterviewReport({ answers });

        mockInterviewReport.answers = mockInterviewReportByAi.answers;
        mockInterviewReport.overallFeedback = mockInterviewReportByAi.overallFeedback;
        mockInterviewReport.overallScore = mockInterviewReportByAi.overallScore;
        mockInterviewReport.status = "completed"
        mockInterviewReport.completedAt = new Date()

        await mockInterviewReport.save()


        res.status(201).json({
            message:
                "Mock Interview report generated successfully.",

            mockInterviewReport
        })
    } catch (err) {

        console.log(err)

        res.status(500).json({
            message: err.message
        })
    }

}

async function updateMockInterviewController(req, res) {

    try {

        const { currentSection, currentQuestionIndex, answers, completedSections } = req.body;

        const { interviewId, mockId } = req.params;

        const mockInterviewReport = await mockInterviewReportModel.findOne({
            user: req.user.id,
            interviewReport: interviewId,
            _id: mockId
        })

        if (!mockInterviewReport) {
            return res.status(400).json({
                message: "Mock Interview Report not found"
            })
        }

        if (answers && mockInterviewReport.status !== "completed") {
            mockInterviewReport.answers = answers;
        }

        if (currentSection !== undefined) {
            mockInterviewReport.currentSection = currentSection;
        }

        if (currentQuestionIndex !== undefined) {
            mockInterviewReport.currentQuestionIndex = currentQuestionIndex;
        }

        if (completedSections) {
            mockInterviewReport.completedSections = completedSections;
        }

        await mockInterviewReport.save()


        res.status(200).json({
            message:
                "Mock Interview DB Updated successfully.",

            mockInterviewReport
        })

    } catch (err) {

        console.log(err)

        res.status(500).json({
            message: err.message
        })
    }

}

module.exports = {
    getAllMockInterviewByInterviewIdController, getMockInterviewByIdController, deleteMockInterviewByIdController, generateMockInterviewReportController, createMockInterviewController, updateMockInterviewController
}