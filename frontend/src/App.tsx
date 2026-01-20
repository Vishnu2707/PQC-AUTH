import React, { useState } from "react";
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { loginRequest } from "./authConfig";

// Components
import { Header } from "./components/Header/Header";
import { Login } from "./components/Login/Login";
import { Layout } from "./components/Layout/Layout";
import { PQCView } from "./components/PQC/PQCView";
import { VideoRecorder } from "./components/Video/VideoRecorder";

function App() {
  const { instance, accounts } = useMsal();
  const [entraToken, setEntraToken] = useState<string | null>(null); // Kept for logic, but maybe not shown in UI directly
  const [challenge, setChallenge] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [status, setStatus] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // --- AUTH ACTIONS ---
  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    instance.logoutPopup();
    setChallenge(null);
    setSessionData(null);
  };

  // --- PQC FLOW ---
  const startPqcHandshake = async () => {
    setStatus("Initiating PQC Handshake...");
    setSessionData(null);

    try {
      const account = accounts[0];
      const response = await instance.acquireTokenSilent({ ...loginRequest, account });
      const token = response.accessToken;
      setEntraToken(token);

      const res = await fetch("http://localhost:4000/pqc/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
      });

      if (!res.ok) throw new Error("Gateway handshake failed");

      const data = await res.json();
      console.log("PQC CHLLANGE:", data);
      setChallenge(data);
      setStatus("PQC Challenge Received. Waiting for Biometric Verification.");
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleVideoUpload = async (videoBlob: Blob) => {
    if (!challenge) return;

    setIsUploading(true);
    setStatus("Encapsulating Session & Verifying Liveness...");

    const formData = new FormData();
    formData.append("challengeId", challenge.challengeId);
    formData.append("video", videoBlob);

    try {
      const res = await fetch("http://localhost:4000/pqc/verify", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      console.log("SESSION ISSUED:", data);
      setSessionData(data);
      setStatus("Identity Verified. Quantum-Safe Session Established.");
    } catch (e: any) {
      console.error(e);
      setStatus(`Verification Failed: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <UnauthenticatedTemplate>
        <Login onLogin={handleLogin} />
      </UnauthenticatedTemplate>

      <AuthenticatedTemplate>
        <Header user={accounts[0]} onLogout={handleLogout} />

        <Layout>
          {/* STATE 1: Initial Dashboard */}
          {!challenge && !sessionData && (
            <div className="dashboard-hero fade-in">
              <h1>Welcome, {accounts[0]?.name}</h1>
              <p className="status-text">Your identity is verified via Entra ID.</p>
              <div className="action-area" style={{ marginTop: "2rem" }}>
                <button className="btn btn-lg" onClick={startPqcHandshake}>
                  Initialize PQC Session
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: PQC Challenge Active */}
          {challenge && (
            <div className="pqc-workflow">
              <PQCView challenge={challenge} />

              {!sessionData && (
                <VideoRecorder
                  onUpload={handleVideoUpload}
                  isUploading={isUploading}
                />
              )}
            </div>
          )}

          {/* STATE 3: Success */}
          {sessionData && (
            <div className="success-card glass-panel animate-enter" style={{ marginTop: "2rem", padding: "2rem", textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
              <h2>Session Established</h2>
              <div className="token-display" style={{
                background: "rgba(0,0,0,0.3)",
                padding: "1rem",
                borderRadius: "8px",
                margin: "1rem 0",
                wordBreak: "break-all",
                color: "var(--success)"
              }}>
                {sessionData.sessionToken}
              </div>
              <button className="btn btn-secondary" onClick={() => { setChallenge(null); setSessionData(null); }}>
                Start New Session
              </button>
            </div>
          )}

          {status && (
            <div className="status-bar" style={{
              marginTop: "2rem",
              color: "var(--text-muted)",
              fontSize: "0.9rem",
              textAlign: "center"
            }}>
              {status}
            </div>
          )}

        </Layout>
      </AuthenticatedTemplate>
    </>
  );
}

export default App;
