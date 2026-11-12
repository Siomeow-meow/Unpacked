import { useLayoutEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import Home from './pages/Home';
import SubjectPage from './pages/SubjectPage';
import GraphicalLesson from './lessons/graphical/GraphicalLesson';
import TransportationLesson from './lessons/transportation/TransportationLesson';
import DsaLesson from './lessons/dsa/DsaLesson';
import { PLAYGROUND_ID, dsaLesson } from './lessons/dsa/lessons';
import SimplexLesson from './lessons/simplex/SimplexLesson';
import { Tooltips } from './components/Tooltips';

/* #/dsa/<lesson>, or #/dsa/visualizer for your own code */
function DsaRoute() {
    const { lesson = '' } = useParams();
    if (lesson !== PLAYGROUND_ID && !dsaLesson(lesson)) return <Navigate to="/dsa" replace />;
    return <DsaLesson key={lesson} lessonId={lesson} />;
}

export default function App() {
    /* the page stays hidden until it is fully built (child layout effects, e.g. the first step draw, run before this) */
    useLayoutEffect(() => { document.documentElement.classList.remove('booting'); }, []);
    return (
        <>
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:subject" element={<SubjectPage />} />
            <Route path="/dsa/:lesson" element={<DsaRoute />} />
            <Route path="/qm/simplex" element={<SimplexLesson />} />
            <Route path="/qm/graphical" element={<GraphicalLesson />} />
            <Route path="/qm/transportation" element={<TransportationLesson />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Tooltips />
        </>
    );
}
