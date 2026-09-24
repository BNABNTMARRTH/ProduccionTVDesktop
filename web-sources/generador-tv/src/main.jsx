import React from "react";
import ReactDOM from "react-dom/client";
import GeneradorInfografiaTV from "./GeneradorInfografiaTV.jsx";
import "./index.css";

/* El iframe es otro documento y no hereda data-layout. Se toma el valor del
   caparazón antes del primer render para evitar un destello de escritorio y
   después se sigue el mismo contrato por postMessage. */
function ponerLayout(layout) {
  if (!["compact", "tablet", "expanded"].includes(layout)) return;
  if (layout === "compact") {
    document.documentElement.dataset.layout = layout;
    if (document.body) document.body.dataset.layout = layout;
    return;
  }

  /* Tablet y escritorio conservaron históricamente el layout responsivo del
     propio iframe; sólo compact necesita sustituirlo por la arquitectura móvil. */
  delete document.documentElement.dataset.layout;
  if (document.body) delete document.body.dataset.layout;
}

try {
  if (window.parent !== window) {
    ponerLayout(window.parent.document.documentElement.dataset.layout);
  }
} catch (_) {
  /* En un origen distinto el mensaje del caparazón llega inmediatamente. */
}

window.addEventListener("message", (event) => {
  if (event.data?.type === "producciontv:layout-changed") {
    ponerLayout(event.data.layout);
  }
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error en GeneradorInfografiaTV:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: "#fff", background: "rgba(213, 50, 56, 0.15)", borderRadius: 14, margin: 20, border: "1px solid rgba(213, 50, 56, 0.4)" }}>
          <h2 style={{ margin: "0 0 8px" }}>Error al renderizar el módulo</h2>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>{String(this.state.error?.message || this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GeneradorInfografiaTV />
    </ErrorBoundary>
  </React.StrictMode>
);
