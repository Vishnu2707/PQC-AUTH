import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/plus-jakarta-sans"; // Defaults to weight 400
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/jetbrains-mono"; // For code snippets
import App from "./App.tsx";
import "./index.css";

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";

const msalInstance = new PublicClientApplication(msalConfig);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </React.StrictMode>
);
