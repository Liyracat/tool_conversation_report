import { NavLink, Route, Routes } from "react-router-dom";
import CardsPage from "./pages/CardsPage.jsx";
import CardDetailPage from "./pages/CardDetailPage.jsx";
import ImportPage from "./pages/ImportPage.jsx";
import LinkSuggestionsPage from "./pages/LinkSuggestionsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

const navItems = [
  { to: "/", label: "Cards" },
  { to: "/import", label: "Import" },
  { to: "/links", label: "Links" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Conversation Cards</h1>
        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<CardsPage />} />
          <Route path="/cards/:cardId" element={<CardDetailPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/links" element={<LinkSuggestionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}