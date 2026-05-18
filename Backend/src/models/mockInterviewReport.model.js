const mongoose = require("mongoose")

const mockInterviewReportSchema = mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    interviewReport: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InterviewReport"
    },
    answers: [{
        section: {
            type: String,
            enum:["technical", "behavioral"],
            required: [true, "Section is required"]
        },

        question: {
            type: String
        },

        expectedAnswer: {
            type: String
        },

        userAnswer: {
            type: String
        },

        score: {
            type: Number
        },

        feedback: {
            type: String
        }
    }],

    overallScore: {
        type: Number,
        required: [true, "Overall Score is required"]
    },

    overallFeedback: {
        type: String,
            required: [true, "Overall Feedback is required"]
    },

    completedAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
})

const mockInterviewReportModel = mongoose.model("MockInteviewReport", mockInterviewReportSchema)

module.exports = mockInterviewReportModel;