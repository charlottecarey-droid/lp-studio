import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Index from "./pages/Index";
import Microsite from "./pages/Microsite";
import ContactImporter from "./pages/ContactImporter";
import MicrositeEditor from "./pages/MicrositeEditor";
import MicrositeSkinEditor from "./components/MicrositeSkinEditor";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";
import PasswordGate from "./components/PasswordGate";

const queryClient = new QueryClient();

const MicrositeRedirect = () => {
  const { slug } = useParams();
  return <Navigate to={`/${slug}${window.location.search}`} replace />;
};

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/dso";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/:slug" element={<Microsite />} />
          <Route path="/microsite/:slug" element={<MicrositeRedirect />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />

          <Route path="/" element={<PasswordGate><Index /></PasswordGate>} />
          <Route path="/index" element={<PasswordGate><Index /></PasswordGate>} />
          <Route path="/microsite-edit/:id" element={<PasswordGate><MicrositeEditor /></PasswordGate>} />
          <Route path="/skin-editor" element={<PasswordGate><MicrositeSkinEditor /></PasswordGate>} />
          <Route path="/import-contacts" element={<PasswordGate><ContactImporter /></PasswordGate>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
