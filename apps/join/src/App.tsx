import { BrowserRouter, Route, Routes } from "react-router-dom";
import TopNav from "./components/TopNav";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import EventCreatePage from "./pages/EventCreatePage";
import EventPage from "./pages/EventPage";
import MyRegistrationsPage from "./pages/MyRegistrationsPage";

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/events/new" element={<EventCreatePage />} />
        <Route path="/e/:slug" element={<EventPage />} />
        <Route path="/me/registrations" element={<MyRegistrationsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
