import React from "react";
import ReactDOM from "react-dom/client";
import GeneradorInfografiaTV from "./GeneradorInfografiaTV.jsx";
import "./index.css";

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
