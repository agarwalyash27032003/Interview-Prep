const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")
const mockInterviewReportModel = require("../models/mockInterviewReport.model")

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

    const mockInterviews = await mockInterviewReportModel.find({ interviewReport: interviewId, user: req.user.id })

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

async function getMockInterviewByIdController(req,res) {

    const { interviewId, mockId} = req.params

    const mockInterview = await mockInterviewReportModel.findOne({  _id: mockId, interviewReport: interviewId, user: req.user.id })

    if (!mockInterview) {

        return res.status(404).json({ 
            message: "Mock Interview not found."
        })
    }

    res.status(200).json({

        message:"Mock Interview fetched successfully.",
        mockInterview

    })
}

async function deleteMockInterviewByIdController(req, res){

    const { interviewId, mockId} = req.params

    const mockInterview = await mockInterviewReportModel.findOne({  _id: mockId, interviewReport: interviewId, user: req.user.id })

    if (!mockInterview) {

        return res.status(404).json({ 
            message: "Mock Interview not found."
        })
    }

    await mockInterviewReportModel.deleteOne({_id: mockId, interviewReport: interviewId, user: req.user.id})

    res.status(200).json({
        message: "Mock Interview deleted successfully.",
    })

}

module.exports = {
    getAllMockInterviewByInterviewIdController, getMockInterviewByIdController, deleteMockInterviewByIdController
}