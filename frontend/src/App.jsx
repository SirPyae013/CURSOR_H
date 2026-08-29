import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Donate from "./pages/Donate.jsx";
import Results from "./pages/Results.jsx";
import Organizations from "./pages/Organizations.jsx";
import OrgDetail from "./pages/OrgDetail.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/donate" element={<Donate />} />
        <Route path="/results/:donationId" element={<Results />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/organizations/:id" element={<OrgDetail />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
