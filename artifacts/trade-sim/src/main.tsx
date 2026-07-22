import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

(function initSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;

  function dismiss() {
    splash!.classList.add("splash-fade-out");
    setTimeout(() => splash!.remove(), 400);
  }

  function poll() {
    fetch("/api/healthz")
      .then((res) => { if (res.ok) { dismiss(); } else { setTimeout(poll, 2000); } })
      .catch(() => setTimeout(poll, 2000));
  }

  poll();
})();

createRoot(document.getElementById("root")!).render(<App />);
