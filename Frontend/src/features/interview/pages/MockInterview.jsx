import React from 'react'
import { useState, useEffect } from 'react'
import { useInterview } from '../hooks/useInterview.js'
import { useTextToSpeech } from '../hooks/textToSpeech.js'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition.js'
import '../styles/mockInterview.scss'
import { useMockInterview } from '../hooks/useMockInterview.js'
import { useNavigate, useParams } from 'react-router'

const QuestionCard = ({ item, index }) => {
  return (
    <div className='q-card'>
      <div className='q-card__header'>
        <span className='q-card__index'>Q{index + 1}</span>
        <p className='q-card__question'>{item.question}</p>
      </div>
    </div>
  )
}

const MockInterview = () => {

  const [section, setSection] = useState(null)
  const [isRestoring, setIsRestoring] = useState(true)
  const [completedSections, setCompletedSections] = useState([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState([])

  const { speak, stopSpeaking } = useTextToSpeech()
  const { report } = useInterview()
  const { interviewId, mockId } = useParams()
  const navigate = useNavigate()

  const { transcript, isListening, startListening, stopListening, resetTranscript } = useSpeechRecognition()
  const { mockReport, startMock, completeMockInterview, getMockReportById, getAllMockReports, deleteMockReport, updatingMockInterview } = useMockInterview()

  const answerKey = `${section}_${questionIndex}`
  const storageKey = mockId ? `mock_${mockId}` : null

  const currentAnswer =
    answers.find(
      answer => answer.section === section && answer.questionIndex === questionIndex
    )?.userAnswer

  const saveMockState = ({ section, questionIndex, answers, completedSections = [] }) => {

    if (!storageKey) return

    localStorage.setItem(storageKey, JSON.stringify({ section, questionIndex, answers, completedSections }))
  }

  const handleSectionSelect = async (selectedSection) => {

    // If mock already exists, just resume it
    if (mockId) {
      setSection(selectedSection)
      return
    }

    // Otherwise create new mock
    setSection(selectedSection)
    setQuestionIndex(0)

    const mockInterview = await startMock(interviewId)

    if (!mockInterview?._id) {
      alert("Failed to start mock interview")
      return
    }

    localStorage.setItem(
      `mock_${mockInterview._id}`,
      JSON.stringify({
        section: selectedSection,
        questionIndex: 0,
        answers: [],
        completedSections: []
      })
    )

    navigate(`/interview/${interviewId}/mock/${mockInterview._id}`)
  }

  const handleGenerateMockInterviewReport =
    async (updatedAnswers) => {

      try {
        
        await completeMockInterview({ answers: updatedAnswers })
        localStorage.removeItem(storageKey)
        alert("Mock Interview Completed!")
        navigate(`/interview/${interviewId}`)

      } catch (err) {
        console.log(err)
      }
    }

  const handleNextQuestion = () => {

    const questions = section === 'technical' ? report?.technicalQuestions : report?.behavioralQuestions

    const finalAnswer = currentAnswer || transcript

    if (!finalAnswer?.trim()) {
      alert("Please answer this question before moving to next question!")
      return
    }

    const answerObject = {
      section,
      questionIndex,
      question: questions[questionIndex].question,
      expectedAnswer: questions[questionIndex].answer,
      userAnswer: finalAnswer
    }

    const filteredAnswers =
      answers.filter(
        answer => !(answer.section === section && answer.questionIndex === questionIndex)
      )

    const updatedAnswers = [...filteredAnswers, answerObject]

    setAnswers(updatedAnswers)

    const nextQuestionIndex = questionIndex < questions.length - 1 ? questionIndex + 1 : 0

    updatingMockInterview({ currentSection: section, currentQuestionIndex: nextQuestionIndex, completedSections, answers: updatedAnswers })

    saveMockState({
      section,
      questionIndex: nextQuestionIndex,
      answers: updatedAnswers,
      completedSections
    })

    if (questionIndex < questions.length - 1) {
      updatingMockInterview({ currentSection: section, currentQuestionIndex: nextQuestionIndex, completedSections, answers: updatedAnswers })
      resetTranscript()
      setQuestionIndex(prev => prev + 1)

    } else {
      setCompletedSections(prev => {

        const updated = [...new Set([...prev, section])]

        if (updated.length >= 2) {

          saveMockState({
            section: "",
            questionIndex: 0,
            answers: updatedAnswers,
            completedSections: updated
          })

          resetTranscript()

          updatingMockInterview({
            currentSection: "",
            currentQuestionIndex: 0,
            completedSections: updated,
            answers: updatedAnswers
          })

          handleGenerateMockInterviewReport(updatedAnswers)

          return updated
        }

        const nextSection =
          section === 'technical'
            ? 'behavioral'
            : 'technical'

        setSection(nextSection)

        setQuestionIndex(0)

        saveMockState({
          section: nextSection,
          questionIndex: 0,
          answers: updatedAnswers,
          completedSections: updated
        })

        updatingMockInterview({
          currentSection: nextSection,
          currentQuestionIndex: 0,
          completedSections: updated,
          answers: updatedAnswers
        })

        resetTranscript()

        return updated
      })
    }
  }


  useEffect(() => {

    if (section !== null) {

      const questions = section === 'technical' ? report?.technicalQuestions : report?.behavioralQuestions

      const currentQuestion = questions?.[questionIndex]

      if (currentQuestion) {
        speak(currentQuestion.question)
      }
    }

  }, [questionIndex, section])

  useEffect(() => {

    if (!storageKey) {
      setIsRestoring(false)
      return
    }

    const savedState = localStorage.getItem(storageKey)

    if (savedState) {

      const parsedState = JSON.parse(savedState)

      setSection(parsedState.section)

      setQuestionIndex(parsedState.questionIndex || 0)

      setAnswers(parsedState.answers || [])

      setCompletedSections(parsedState.completedSections || [])
    }

    if (!savedState && mockReport) {
      setSection(mockReport.currentSection)
      setQuestionIndex(mockReport.currentQuestionIndex || 0)
      setAnswers(mockReport.answers || [])
      setCompletedSections(mockReport.completedSections || [])
    }

    setIsRestoring(false)

  }, [storageKey, mockReport])

  if (!report) {
    return (
      <main className='loading-screen'>
        <h1>
          Preparing Mock Interview...
        </h1>
      </main>
    )
  }

  if (isRestoring) {
    return (
      <main className='loading-screen'>
        <h1>Restoring Mock Interview...</h1>
      </main>
    )
  }

  if (section == null && !mockId) {
    return (
      <main className='choose-section'>
        <button className='button primary-button' onClick={() => handleSectionSelect('technical')}>Technical Questions</button>
        <button className='button primary-button' onClick={() => handleSectionSelect('behavioral')}>Behavioral Questions</button>
      </main>
    )
  }

  return (
    <div>
      {section === 'technical' && (
        <section className='question-section'>
          <QuestionCard key={questionIndex} item={report.technicalQuestions[questionIndex]} index={questionIndex} />

          <div className='question-buttons'>

            <div className="answering-buttons">
              <button className='button primary-button' onClick={startListening}>
                Start Answering
              </button>

              <button className='button primary-button' onClick={() => { stopListening() }}>
                Stop Answering
              </button>
            </div>

            <button
              className='button primary-button'
              onClick={handleNextQuestion}

              disabled={
                !(currentAnswer || transcript)
              }
            >
              Next
            </button>

          </div>
          <div>

            <h3>Your Answer</h3>

            <p> {currentAnswer ?? transcript ?? ""} </p>

          </div>
        </section>
      )}
      {section === 'behavioral' && (
        <section className='question-section'>
          <QuestionCard key={questionIndex} item={report.behavioralQuestions[questionIndex]} index={questionIndex} />
          <div className='question-buttons'>

            <div className="answering-buttons">
              <button className='button primary-button' onClick={startListening}>
                Start Answering
              </button>

              <button className='button primary-button' onClick={() => { stopListening() }}>
                Stop Answering
              </button>
            </div>

            <button
              className='button primary-button'
              onClick={handleNextQuestion}

              disabled={
                !(currentAnswer || transcript)
              }
            >
              Next
            </button>

          </div>
          <div>

            <h3>Your Answer</h3>

            <p> {currentAnswer ?? transcript ?? ""} </p>

          </div>
        </section>
      )}
    </div>
  )
}

export default MockInterview