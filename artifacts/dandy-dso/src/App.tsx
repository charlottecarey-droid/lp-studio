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
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const MicrositeRedirect = () => {
  const { slug } = useParams();
  return <Navigate to={`/${slug}${window.location.search}`} replace />;
};

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/dso";

const App = () => (
  <ErrorBoundary fallbackLabel="Application Error">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={basename}>
          <Routes>
            <Route path="/:slug" element={<ErrorBoundary><Microsite /></ErrorBoundary>} />
            <Route path="/microsite/:slug" element={<ErrorBoundary><MicrositeRedirect /></ErrorBoundary>} />
            <Route path="/unsubscribe" element={<ErrorBoundary><Unsubscribe /></ErrorBoundary>} />

            <Route path="/" element={<ErrorBoundary><PasswordGate><Index /></PasswordGate></ErrorBoundary>} />
            <Route path="/index" element={<ErrorBoundary><PasswordGate><Index /></PasswordGate></ErrorBoundary>} />
            <Route path="/microsite-edit/:id" element={<ErrorBoundary><PasswordGate><MicrositeEditor /></PasswordGate></ErrorBoundary>} />
            <Route path="/skin-editor" element={<ErrorBoundary><PasswordGate><MicrositeSkinEditor /></PasswordGate></ErrorBoundary>} />
            <Route path="/import-contacts" element={<ErrorBoundary><PasswordGate><ContactImporter /></PasswordGate></ErrorBoundary>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
