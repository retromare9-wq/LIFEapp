import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import { CalendarMonth, DaySheet } from './pages/Calendar'
import { TodoList, TodosDone } from './pages/Todos'
import Activities from './pages/Activities'
import { HabitDetail, HabitList } from './pages/Habits'
import { AbstinencePage, RelapsesPage, SubstanceYear } from './pages/Abstinence'
import { DreamsPage, MoodMonth, MoodsPage, NotesPage } from './pages/Journals'
import { ProjectArchive, ProjectDetail, ProjectList } from './pages/Projects'
import Settings from './pages/Settings'
import Points from './pages/Points'
import { BookDetail, BooksFinished, BooksPage } from './pages/Books'
import { HomeButton } from './components/ui'

function HomeButtonOutsideHome() {
  return useLocation().pathname === '/' ? null : <HomeButton />
}

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
        <Route path="/abstinenz/rueckfaelle" element={<RelapsesPage />} />
        <Route path="/lesen" element={<BooksPage />} />
        <Route path="/lesen/gelesen" element={<BooksFinished />} />
        <Route path="/lesen/:id" element={<BookDetail />} />
        <Route path="/punkte" element={<Points />} />
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
      <HomeButtonOutsideHome />
    </HashRouter>
  )
}
