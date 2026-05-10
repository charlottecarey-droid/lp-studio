import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error(
    'Failed to find the root element with id "root". Ensure index.html contains <div id="root"></div>.',
  );
}

createRoot(rootElement).render(<App />);
