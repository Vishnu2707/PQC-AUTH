import React, { useState, useRef } from "react";
import {
  useMsal,
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import { loginRequest } from "./authConfig";

function App() {
  const { instance, accounts } = useMsal();

  const [entraToken, setEntraToken] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<any>(null);
  const [status, setStatus] = useState<string>("");

  // 🎥 Video recording refs + state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);

  // ----------- AUTH -----------

  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (e) {
      console.error(e);
      setStatus("❌ Login failed");
    }
  };

  const handleLogout = () => {
    instance.logoutPopup();
  };

  // ----------- PQC START (PHASE 1) -----------

  const getTokenAndStartPqc = async () => {
    setStatus("🔐 Requesting Entra token...");
    try {
      const account = accounts[0];
      if (!account) {
        setStatus("❌ No account. Please sign in first.");
        return;
      }

      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      });

      const token = response.accessToken;
      setEntraToken(token);
      setStatus("⚙️ Calling PQC gateway /pqc/start...");

      const res = await fetch("http://localhost:4000/pqc/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        setStatus(`❌ Gateway error: ${res.status} - ${text}`);
        return;
      }

      const data = await res.json();
      console.log("PQC START RESPONSE:", data);

      // ✅ Store challenge for Phase 2
      setChallenge(data);
      setStatus(`✅ PQC challenge issued for ${data.user}. Now record video.`);
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Error: ${e.message || e.toString()}`);
    }
  };

  // ----------- CAMERA -----------

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus("📷 Camera started");
    } catch (e) {
      console.error(e);
      setStatus("❌ Camera access denied");
    }
  };

  // ----------- RECORDING -----------

  const startRecording = () => {
    if (!challenge) {
      setStatus("❌ No PQC challenge. Call gateway first.");
      return;
    }

    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (!stream) {
      setStatus("❌ Camera not ready. Click Start Camera first.");
      return;
    }

    recordedChunksRef.current = [];

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8"
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
        console.log("✅ Chunk received:", event.data.size);
      }
    };

    mediaRecorder.onstop = () => {
      console.log("✅ Recording fully stopped. Total chunks:", recordedChunksRef.current.length);
    };

    mediaRecorder.start(1000); // ✅ FORCE chunk every 1 second
    mediaRecorderRef.current = mediaRecorder;

    setRecording(true);
    setStatus("🔴 Recording started...");
  };

  const stopRecording = async () => {
    if (!recording || !mediaRecorderRef.current) {
      setStatus("❌ Not recording");
      return;
    }

    mediaRecorderRef.current.stop();
    setRecording(false);

    // ✅ WAIT for final buffer flush (critical)
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (recordedChunksRef.current.length === 0) {
      setStatus("❌ No video data captured. Try recording again.");
      return;
    }

    const blob = new Blob(recordedChunksRef.current, {
      type: "video/webm",
    });

    console.log("✅ Final video size:", blob.size);

    const formData = new FormData();
    formData.append("challengeId", challenge.challengeId);
    formData.append("video", blob);

    setStatus("📤 Uploading video to PQC Gateway...");

    try {
      const res = await fetch("http://localhost:4000/pqc/verify", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        setStatus(`❌ Verify failed: ${res.status} - ${errText}`);
        return;
      }

      const data = await res.json();
      console.log("✅ VERIFY RESPONSE:", data);

      setStatus(`✅ PQC Session Issued: ${data.sessionToken}`);
    } catch (e) {
      console.error(e);
      setStatus("❌ Video upload failed");
    }
  };


  // ----------- UI -----------

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1>PQC Auth Demo</h1>

      <UnauthenticatedTemplate>
        <p>You are not signed in.</p>
        <button onClick={handleLogin}>Sign in with Entra ID</button>
      </UnauthenticatedTemplate>

      <AuthenticatedTemplate>
        <p>✅ Signed in as: {accounts[0]?.username}</p>
        <button onClick={handleLogout}>Logout</button>

        <hr />

        <button onClick={getTokenAndStartPqc}>
          1️⃣ Call PQC Gateway with Entra token
        </button>

        {entraToken && (
          <details style={{ marginTop: "1rem" }}>
            <summary>Show Entra access token (debug)</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem" }}>
              {entraToken}
            </pre>
          </details>
        )}

        {challenge && (
          <div style={{ marginTop: "1rem" }}>
            <h3>🔐 PQC Challenge</h3>
            <pre style={{ fontSize: "0.8rem" }}>
              {JSON.stringify(challenge, null, 2)}
            </pre>

            {/* 🎥 VIDEO UI */}
            <div style={{ marginTop: "2rem" }}>
              <h3>🎥 Video Challenge (Phase 2)</h3>

              <video
                ref={videoRef}
                autoPlay
                style={{ width: "300px", border: "1px solid #999" }}
              />

              <div style={{ marginTop: "1rem" }}>
                <button onClick={startCamera}>Start Camera</button>

                {!recording && (
                  <button
                    onClick={startRecording}
                    style={{ marginLeft: "1rem" }}
                  >
                    Start Recording
                  </button>
                )}

                {recording && (
                  <button
                    onClick={stopRecording}
                    style={{ marginLeft: "1rem" }}
                  >
                    Stop + Upload
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </AuthenticatedTemplate>

      {status && (
        <>
          <hr />
          <p>
            <strong>Status:</strong> {status}
          </p>
        </>
      )}
    </div>
  );
}

export default App;
