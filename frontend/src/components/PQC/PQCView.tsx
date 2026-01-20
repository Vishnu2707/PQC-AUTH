import React, { useEffect, useState } from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import "./PQCView.css";

interface PQCViewProps {
    challenge: {
        challengeId: string;
        kemAlg: string;
        kemCiphertext: string;
        sharedKeyPreview: string; // We only show this for debug/demo
    };
}

export const PQCView: React.FC<PQCViewProps> = ({ challenge }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Reveal animation trigger
        const timer = setTimeout(() => setVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className={`pqc-view glass-panel ${visible ? "visible" : ""}`}>
            <div className="pqc-header">
                <div className="pqc-icon"><Lock size={32} /></div>
                <div>
                    <h3>ML-KEM-1024 Handshake</h3>
                    <p className="pqc-meta">Protocol: NIST Post-Quantum Cryptography</p>
                </div>
            </div>

            <div className="pqc-grid">
                <div className="pqc-item">
                    <label>Algorithm</label>
                    <div className="code-box accent">{challenge.kemAlg}</div>
                </div>
                <div className="pqc-item">
                    <label>Challenge ID</label>
                    <div className="code-box">{challenge.challengeId}</div>
                </div>
            </div>

            <div className="pqc-payload">
                <label>Encapsulated Ciphertext (Server -&gt; Client)</label>
                <div className="ciphertext-display">
                    {challenge.kemCiphertext.match(/.{1,64}/g)?.join("\n")}
                </div>
            </div>

            <div className="pqc-status">
                <span className="status-dot pulse"></span>
                <span>Secure Channel Established. Waiting for Liveness Check...</span>
            </div>
        </div>
    );
};
