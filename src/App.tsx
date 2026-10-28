import { HashRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import { CalendarMonth, DaySheet } from './pages/Calendar'
import { TodoList, TodosDone } from './pages/Todos'
import Activities from './pages/Activities'
import { HabitDetail, HabitList } from './pages/Habits'
import { AbstinencePage, SubstanceYear } from './pages/Abstinence'
import { DreamsPage, MoodMonth, MoodsPage, NotesPage } from './pages/Journals'
import { ProjectArchive, ProjectDetail, ProjectList } from './pages/Projects'
import Settings from './pages/Settings'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kalender" element={<CalendarMonth />} />
        <Route path="/tag/:date" element={<DaySheet />} />
        <Route path="/todos" element={<TodoList />} />
        <Route path="/todos/erledigt" element={<TodosDone />} />
        <Route path="/aktivitaeten" element={<Activities />} />
        <Route path="/habits" element={<HabitList />} />
        <Route path="/habits/:id" element={<HabitDetail />} />
        <Route path="/abstinenz" element={<AbstinencePage />} />
        <Route path="/abstinenz/:id/jahr" element={<SubstanceYear />} />
        <Route path="/notizen" element={<NotesPage />} />
        <Route path="/gefuehle" element={<MoodsPage />} />
        <Route path="/gefuehle/monat" element={<MoodMonth />} />
        <Route path="/traeume" element={<DreamsPage />} />
        <Route path="/projekte" element={<ProjectList />} />
        <Route path="/projekte/alle" element={<ProjectArchive />} />
        <Route path="/projekte/:id" element={<ProjectDetail />} />
        <Route path="/einstellungen" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </HashRouter>
  )
}
