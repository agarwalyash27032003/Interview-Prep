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
        questionIndex: {
            type: Number
        },
        section: {
            type: String,
            enum: ["technical", "behavioral"],
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
        },
        duration: {
            type: Number
        }
    }],

    currentSection:{
        type:String,
        default:null
    },
    
    currentQuestionIndex:{
        type:Number,
        default:0
    },

    completedSections:{
        type:[String],
        default:[]
    },

    overallScore: {
        type: Number,
        default: 0
    },

    overallFeedback: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: [
            "in-progress",
            "completed"
        ],
        default: "in-progress",
        required: [true, "Status is required"]
    },
    completedAt: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
})

const mockInterviewReportModel = mongoose.model("MockInterviewReport", mockInterviewReportSchema)

module.exports = mockInterviewReportModel;