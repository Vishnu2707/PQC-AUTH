import React from "react";
import "./Header.css";
import { Atom, LogOut } from "lucide-react";

interface HeaderProps {
    user: { username: string } | null;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
    return (
        <header className="app-header glass-panel">
            <div className="container header-content">
                <div className="logo-section">
                    <div className="logo-icon"><Atom size={20} /></div>
                    <span className="logo-text">PQC<span className="accent">Auth</span></span>
                </div>

                {user && (
                    <div className="user-section">
                        <span className="user-name">{user.username}</span>
                        <button className="btn btn-secondary btn-sm" onClick={onLogout}>
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
