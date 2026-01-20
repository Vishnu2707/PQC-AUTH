import React, { ReactNode } from "react";
import "./Layout.css";

interface LayoutProps {
    children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <main className="main-layout">
            <div className="container">
                {children}
            </div>
        </main>
    );
};
