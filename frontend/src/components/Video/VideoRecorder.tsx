import React, { useRef, useState } from "react";
import { Camera, Radio } from "lucide-react";
import "./VideoRecorder.css";

interface VideoRecorderProps {
    onUpload: (blob: Blob) => void;
    isUploading: boolean;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({ onUpload, isUploading }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const [streamActive, setStreamActive] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setStreamActive(true);
                setError(null);
            }
        } catch (e) {
            console.error(e);
            setError("Camera access denied. Please allow permissions.");
        }
    };

    const startRecording = () => {
        if (!videoRef.current?.srcObject) return;

        chunksRef.current = [];
        const stream = videoRef.current.srcObject as MediaStream;
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            // Small delay to ensure last chunk is pushed
            await new Promise(r => setTimeout(r, 100));
            const blob = new Blob(chunksRef.current, { type: "video/webm" });
            onUpload(blob);
        };

        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="video-recorder glass-panel fade-in">
            <div className="recorder-header">
                <h3><Camera size={20} style={{ marginRight: "0.5rem" }} /> Liveness Check</h3>
                {isUploading && <span className="upload-badge">Uploading...</span>}
            </div>

            <div className="video-frame">
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className={isRecording ? "recording-active" : ""}
                />

                {!streamActive && (
                    <div className="camera-placeholder">
                        <button className="btn" onClick={startCamera}>Enable Camera</button>
                        {error && <p className="error-text">{error}</p>}
                    </div>
                )}

                {isRecording && (
                    <div className="rec-indicator">
                        <Radio size={14} className="blink-icon" /> REC
                    </div>
                )}
            </div>

            <div className="controls">
                {streamActive && !isRecording && !isUploading && (
                    <button className="btn btn-record" onClick={startRecording}>
                        Start Recording
                    </button>
                )}

                {isRecording && (
                    <button className="btn btn-stop" onClick={stopRecording}>
                        Stop & Verify
                    </button>
                )}
            </div>
        </div>
    );
};
