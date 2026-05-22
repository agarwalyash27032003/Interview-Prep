import React, { useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { useMockInterview } from "../hooks/useMockInterview"
import "../styles/mockInterviewReport.scss"

const MockInterviewReport = () => {

    const {
        mockReport,
        getMockReportById,
        loading
    } = useMockInterview()

    const { interviewId, mockId } = useParams()

    const navigate = useNavigate()

    useEffect(() => {

        getMockReportById(
            interviewId,
            mockId
        )

    }, [interviewId, mockId])

    if (loading || !mockReport) {

        return (
            <div className="loading-screen">
                <h2>Loading Mock Report...</h2>
            </div>
        )
    }

    const getScoreClass = (score) => {

        if (score >= 8) return "high"

        if (score >= 5) return "medium"

        return "low"
    }

    return (

        <div className="mock-report-page">

            {/* HEADER */}

            <Link
                    to="/"
                    className='interview-logo'
                >
                    <img src='../../public/PrepWise AI.png' alt="" className='logo' />

                </Link>

            <div className="mock-report-header">

                <div>

                    <h1>
                        Mock Interview Report
                    </h1>

                    <p>
                        Status:
                        {" "}
                        <span className={`status ${mockReport.status}`}>
                            {mockReport.status}
                        </span>
                    </p>

                    {mockReport.completedAt && (

                        <p>

                            Completed:
                            {" "}

                            {new Date(
                                mockReport.completedAt
                            ).toLocaleString()}

                        </p>

                    )}

                </div>

                

                <button
                    className="button secondary-button"
                    onClick={() =>
                        navigate(`/interview/${interviewId}`)
                    }
                >
                    Back
                </button>

            </div>

            {/* OVERALL */}



            <div className="overall-grid">

                <div className="overall-card score-card">

                    <h2>Overall Score</h2>

                    <div className="overall-score">
                        {mockReport.overallScore}%
                    </div>

                </div>

                <div className="overall-card">

                    <h2>Overall Feedback</h2>

                    <p>
                        {
                            mockReport.overallFeedback
                            || "No feedback available."
                        }
                    </p>

                </div>

            </div>

            {/* ANSWERS */}

            <div className="answers-section">

                <h2>
                    Question Analysis
                </h2>

                <div className="answers-list">

                    {mockReport.answers.map((item, index) => (

                        <div
                            key={index}
                            className="answer-card"
                        >

                            {/* TOP */}

                            <div className="answer-top">

                                <div>

                                    <span
                                        className={`section-tag ${item.section}`}
                                    >
                                        {item.section}
                                    </span>

                                    <h3>
                                        Q{index + 1}.
                                        {" "}
                                        {item.question}
                                    </h3>

                                </div>

                                <div
                                    className={`answer-score ${getScoreClass(item.score)}`}
                                >
                                    {item.score || 0}/10
                                </div>

                            </div>

                            {/* USER ANSWER */}

                            <div className="answer-block">

                                <h4>Your Answer</h4>

                                <p>
                                    {
                                        item.userAnswer
                                        || "No answer submitted."
                                    }
                                </p>

                            </div>

                            {/* EXPECTED */}

                            <div className="answer-block">

                                <h4>Expected Answer</h4>

                                <p>
                                    {
                                        item.expectedAnswer
                                        || "Not available."
                                    }
                                </p>

                            </div>

                            {/* FEEDBACK */}

                            <div className="answer-block">

                                <h4>AI Feedback</h4>

                                <p>
                                    {
                                        item.feedback
                                        || "No feedback available."
                                    }
                                </p>

                            </div>

                            {/* FOOTER */}

                            <div className="answer-footer">

                                <span>

                                    Duration:
                                    {" "}

                                    {item.duration || 0}s

                                </span>

                            </div>

                        </div>

                    ))}

                </div>

            </div>

        </div>
    )
}

export default MockInterviewReport