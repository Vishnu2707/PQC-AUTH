import React from "react";
import "./Login.css";
import { ShieldCheck } from "lucide-react";

interface LoginProps {
    onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
    return (
        <div className="login-container animate-enter">
            <div className="login-card glass-panel">
                <div className="login-hero">
                    <div className="shield-icon"><ShieldCheck size={64} /></div>
                    <h1>Secure Access</h1>
                    <p className="subtitle">Post-Quantum Cryptography Demo</p>
                </div>

                <div className="login-actions">
                    <p className="instruction">
                        Authenticate using your corporate identity to begin the quantum-safe handshake.
                    </p>
                    <button className="btn btn-block" onClick={onLogin}>
                        Sign In with Microsoft Entra
                    </button>
                </div>

                <div className="login-footer">
                    <span>Powered by <strong>ML-KEM-1024</strong></span>
                </div>
            </div>
        </div>
    );
};
