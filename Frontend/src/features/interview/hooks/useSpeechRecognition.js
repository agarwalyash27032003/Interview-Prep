import { useState, useRef }
    from "react"

export const useSpeechRecognition =
    () => {

        const [isListening,
            setIsListening]
            = useState(false)

        const [transcript,
            setTranscript]
            = useState("")

        const recognitionRef =
            useRef(null)

        const startListening = () => {

            const SpeechRecognition =
                window.SpeechRecognition
                ||
                window.webkitSpeechRecognition

            if (!SpeechRecognition) {

                alert(
                    "Speech Recognition not supported"
                )

                return
            }

            const recognition =
                new SpeechRecognition()

            recognition.continuous = true

            recognition.interimResults = true

            recognition.lang = "en-US"

            recognition.onstart = () => {

                setIsListening(true)
            }

            recognition.onend = () => {

                setIsListening(false)
            }

            recognition.onresult = (event) => {

                let finalTranscript = ""

                for (
                    let i = 0;
                    i < event.results.length;
                    i++
                ) {

                    finalTranscript +=
                        event.results[i][0]
                            .transcript
                }

                setTranscript(
                    finalTranscript
                )
            }

            recognition.start()

            recognitionRef.current =
                recognition
        }

        const stopListening = () => {

            recognitionRef.current?.stop()

            setIsListening(false)
        }

        const resetTranscript = () => {

            setTranscript("")
        }

        return {

            transcript,

            isListening,

            startListening,

            stopListening,
            resetTranscript
        }
    }