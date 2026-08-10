import { BrowserRouter, Route, Routes } from "react-router-dom";
import TopNav from "./components/TopNav";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import EventCreatePage from "./pages/EventCreatePage";
import EventPage from "./pages/EventPage";
import MyRegistrationsPage from "./pages/MyRegistrationsPage";
import MyHostedEventsPage from "./pages/MyHostedEventsPage";
import LineAuthCompletePage from "./pages/LineAuthCompletePage";
import SiteFooter from "./components/SiteFooter";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <TopNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/line/complete" element={<LineAuthCompletePage />} />
        <Route path="/events/new" element={<EventCreatePage />} />
        <Route path="/e/:slug" element={<EventPage />} />
        <Route path="/me/registrations" element={<MyRegistrationsPage />} />
        <Route path="/me/hosting" element={<MyHostedEventsPage />} />
      </Routes>
      <SiteFooter />
    </BrowserRouter>
  );
}
