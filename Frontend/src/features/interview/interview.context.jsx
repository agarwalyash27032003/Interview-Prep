import { createContext,useState } from "react";


export const InterviewContext = createContext() // Global storage system - loading, setLoading, report,... becomes globally accessible

export const InterviewProvider = ({ children }) => {
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState(null)
    const [reports, setReports] = useState([])
    const [mockReport, setMockReport] = useState(null)
    const [mockReports, setMockReports] = useState([])

    return (
        <InterviewContext.Provider value={{ loading, setLoading, report, setReport, reports, setReports, mockReport, setMockReport, mockReports, setMockReports }}>
            {children}
        </InterviewContext.Provider>
    )
}