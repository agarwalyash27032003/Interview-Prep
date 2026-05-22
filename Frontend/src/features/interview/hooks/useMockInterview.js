import { useContext, useEffect } from "react"
import { getAllMockInterviewReports, getMockInterview, deleteMockInterview, startMockInterview, generateMockInterviewReport, updateMockInterview } from "../services/mockinterview.api"
import { InterviewContext } from "../interview.context"
import { useParams } from "react-router"

export const useMockInterview = () => {

    const context = useContext(InterviewContext)
    const { interviewId, mockId } = useParams()

    if (!context) {
        throw new Error("useMockInterview must be used within an InterviewProvider")
    }

    const { loading, setLoading, mockReport, setMockReport, mockReports, setMockReports } = context

    const startMock = async (interviewId) => {
        setLoading(true)
        let response = null
        try {
            response = await startMockInterview(interviewId)
            setMockReport(response.mockInterviewReport)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
        return response?.mockInterviewReport || null
    }

    const getMockReportById = async (interviewId, mockId) => {
        setLoading(true)
        let response = null
        try {
            response = await getMockInterview(interviewId, mockId)
            setMockReport(response.mockInterview)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
        return response?.mockInterview
    }

    const getAllMockReports =
        async (interviewId) => {

            setLoading(true)

            let response = null

            try {

                response =
                    await getAllMockInterviewReports(
                        interviewId
                    )

                setMockReports(
                    response.mockInterviews
                )

            } catch (error) {

                console.log(error)

            } finally {

                setLoading(false)
            }

            return response?.mockInterviews
        }

    const deleteMockReport = async (interviewId, mockId) => {

        setLoading(true)

        try {

            await deleteMockInterview(
                interviewId,
                mockId
            )

            setMockReports(prev =>

                prev.filter(

                    report =>
                        report._id !== mockId
                )
            )

        } catch (error) {

            console.log(error)

        } finally {

            setLoading(false)
        }
    }

    const completeMockInterview = async ({ answers }) => {

        setLoading(true)
        let response = null

        try {

            response = await generateMockInterviewReport({interviewId, mockId, answers })
            setMockReport(response.mockInterviewReport)

        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }

        return response?.mockInterviewReport || null

    }

    const updatingMockInterview = async({ completedSections, answers, currentQuestionIndex, currentSection}) => {
        let response = null
        try{
            response = await updateMockInterview({ completedSections, answers, currentQuestionIndex, currentSection, interviewId, mockId})
            setMockReport(response.mockInterviewReport)
        }
        catch(error){
            console.log(error)
        }

    }

    useEffect(() => {

        if (interviewId && mockId) {

            getMockReportById(interviewId, mockId)

        }

    }, [interviewId, mockId])

    return {

        loading,

        mockReport,

        mockReports,
        startMock, completeMockInterview,

        getMockReportById,

        getAllMockReports,

        deleteMockReport,
        updatingMockInterview
    }
}
