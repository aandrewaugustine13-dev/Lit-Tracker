// FILE: src/components/TestGenerator.tsx
import { useState } from 'react';
import { generateFluxImage } from '../../services/replicateFluxService';

// Use whatever AspectRatio enum you have in your types
const ASPECT_RATIOS = [
    { value: 'SQUARE', label: 'Square (1:1)' },
    { value: 'WIDE', label: 'Wide (16:9)' },
    { value: 'PORTRAIT', label: 'Portrait (9:16)' },
];

export default function TestGenerator() {
    const [prompt, setPrompt] = useState('a beautiful sunset over mountains');
    const [aspectRatio, setAspectRatio] = useState('SQUARE');
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt');
            return;
        }

        if (!apiKey.trim()) {
            setError('Please enter your Replicate API key');
            return;
        }

        setLoading(true);
        setError(null);
        setLogs([]);
        addLog('Starting image generation...');

        try {
            addLog(`Generating with prompt: "${prompt}"`);

            const url = await generateFluxImage(
                prompt,
                aspectRatio,
                apiKey.trim()
            );

            addLog('Image generated successfully!');
            setImageUrl(url);
        } catch (err: any) {
            const errorMsg = err.message || 'Failed to generate image';
            addLog(`Error: ${errorMsg}`);
            setError(errorMsg);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            padding: '20px',
            maxWidth: '800px',
            margin: '0 auto',
            fontFamily: 'Arial, sans-serif'
        }}>
        <h2>Replicate Image Generation Test</h2>
        <p>Test if your API integration is working.</p>

        <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
        Replicate API Key:
        </label>
        <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Enter your Replicate API key..."
        style={{
            width: '100%',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc'
        }}
        />
        </div>

        <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
        Prompt:
        </label>
        <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the image you want to generate..."
        style={{
            width: '100%',
            minHeight: '80px',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc'
        }}
        />
        </div>

        <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
        Aspect Ratio:
        </label>
        <select
        value={aspectRatio}
        onChange={(e) => setAspectRatio(e.target.value)}
        style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ccc'
        }}
        >
        {ASPECT_RATIOS.map(ratio => (
            <option key={ratio.value} value={ratio.value}>
            {ratio.label}
            </option>
        ))}
        </select>
        </div>

        <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
            padding: '10px 20px',
            background: loading ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px'
        }}
        >
        {loading ? 'Generating... (this takes ~30 seconds)' : 'Generate Image'}
        </button>
        </div>

        {error && (
            <div style={{
                color: '#721c24',
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                borderRadius: '4px',
                padding: '12px',
                margin: '10px 0'
            }}>
            <strong>Error:</strong> {error}
            </div>
        )}

        {imageUrl && (
            <div style={{ marginTop: '20px' }}>
            <h3>Generated Image:</h3>
            <img
            src={imageUrl}
            alt="Generated"
            style={{
                maxWidth: '100%',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }}
            />
            <div style={{ marginTop: '10px' }}>
            <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0070f3', textDecoration: 'none' }}
            >
            Open in new tab
            </a>
            </div>
            </div>
        )}

        {logs.length > 0 && (
            <div style={{ marginTop: '20px' }}>
            <h4>Logs:</h4>
            <div style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '14px'
            }}>
            {logs.map((log, index) => (
                <div key={index} style={{ marginBottom: '4px' }}>
                {log}
                </div>
            ))}
            </div>
            </div>
        )}
        </div>
    );
}
