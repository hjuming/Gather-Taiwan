import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import TopNav from "./components/TopNav";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import EventCreatePage from "./pages/EventCreatePage";
import EventPage from "./pages/EventPage";
import EventEditPage from "./pages/EventEditPage";
import MyRegistrationsPage from "./pages/MyRegistrationsPage";
import MyHostedEventsPage from "./pages/MyHostedEventsPage";
import LineAuthCompletePage from "./pages/LineAuthCompletePage";
import SiteFooter from "./components/SiteFooter";
import Breadcrumbs from "./components/Breadcrumbs";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <a className="skip-link" href="#main-content">跳到主要內容</a>
      <TopNav />
      <Breadcrumbs />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/line/complete" element={<LineAuthCompletePage />} />
          <Route path="/events/new" element={<EventCreatePage />} />
          <Route path="/e/:slug" element={<EventPage />} />
          <Route path="/e/:slug/edit" element={<EventEditPage />} />
          <Route path="/me/registrations" element={<MyRegistrationsPage />} />
          <Route path="/me/hosting" element={<MyHostedEventsPage />} />
        </Routes>
      </main>
      <SiteFooter />
    </BrowserRouter>
  );
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  return null;
}
