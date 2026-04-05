/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  RefreshCw, 
  AlertCircle,
  Key,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';

const MODEL_NAME = "gemini-3.1-flash-image-preview";

const SUPPORTED_RATIOS = [
  { str: "1:8", val: 1/8 },
  { str: "1:4", val: 1/4 },
  { str: "9:16", val: 9/16 },
  { str: "3:4", val: 3/4 },
  { str: "1:1", val: 1 },
  { str: "4:3", val: 4/3 },
  { str: "16:9", val: 16/9 },
  { str: "4:1", val: 4/1 },
  { str: "8:1", val: 8/1 }
];

function getClosestAspectRatio(width: number, height: number): string {
  const target = width / height;
  return SUPPORTED_RATIOS.reduce((prev, curr) => 
    Math.abs(curr.val - target) < Math.abs(prev.val - target) ? curr : prev
  ).str;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setHasKey(true);
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Compress image to avoid 413 Payload Too Large
          const MAX_DIMENSION = 1536;
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to JPEG to save space
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setImage(compressedDataUrl);
            setAspectRatio(getClosestAspectRatio(width, height));
          } else {
            // Fallback if canvas fails
            const dataUrl = event.target?.result as string;
            setImage(dataUrl);
            setAspectRatio(getClosestAspectRatio(img.width, img.height));
          }
          
          setResult(null);
          setError(null);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  } as any);

  const handleOpenKey = () => {
    setApiKeyValue(apiKey || "");
    setShowKeyModal(true);
  };

  const saveApiKey = () => {
    if (apiKeyValue.trim()) {
      localStorage.setItem('gemini_api_key', apiKeyValue.trim());
      setApiKey(apiKeyValue.trim());
      setHasKey(true);
      setShowKeyModal(false);
    }
  };

  const clearApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey(null);
    setHasKey(false);
    setShowKeyModal(false);
  };

  const transformImage = async () => {
    if (!image) return;
    
    setLoading(true);
    setError(null);

    try {
      if (!apiKey) throw new Error("API Key is missing.");
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const base64Data = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: "Transform this image into a high-fidelity Minecraft world. Use a 'realistic shaders' style: include volumetric lighting, high-quality water reflections, soft shadows, and vibrant colors. Every object in the scene should be translated into Minecraft blocks while maintaining the original composition, perspective, and subjects. The final result should look like a screenshot from a high-end Minecraft modpack." },
          ],
        },
        config: {
          imageConfig: { aspectRatio: aspectRatio, imageSize: "1K" }
        }
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setResult(`data:image/png;base64,${part.inlineData.data}`);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) throw new Error("No image was generated. Please try again.");
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || "Failed to transform image. Please try again.";
      
      // Handle raw HTML/JSON error responses gracefully
      if (errorMessage.includes("413") || errorMessage.includes("Too Large")) {
        errorMessage = "The uploaded image is too large. We've tried to compress it, but please try a smaller image if it still fails.";
      } else if (errorMessage.includes("API key not valid") || errorMessage.includes("Requested entity was not found") || errorMessage.includes("API key")) {
        setHasKey(false);
        setApiKey(null);
        localStorage.removeItem('gemini_api_key');
        errorMessage = "Invalid API Key. Please enter a valid Gemini API key.";
      } else if (errorMessage.includes("{")) {
         try {
           const parsed = JSON.parse(errorMessage);
           if (parsed.error?.message) {
             // Strip HTML tags if present
             errorMessage = parsed.error.message.replace(/<[^>]*>?/gm, '').trim();
           }
         } catch(e) {}
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result;
    link.download = 'minecraft-stylized.png';
    link.click();
  };

  return (
    <div className="min-h-screen font-sans flex flex-col">
      {/* Navbar */}
      <nav className="bg-mc-dark text-white border-b-4 border-mc-border px-4 py-3 lg:px-8 flex justify-between items-center relative z-20">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-mc-green border-2 border-mc-dark p-1.5 shadow-[2px_2px_0px_#111] transform -rotate-3 shrink-0">
            <ImageIcon className="w-5 h-5 text-mc-dark" />
          </div>
          <div className="flex flex-col justify-center mt-0.5">
            <span className="font-black text-lg md:text-xl lg:text-2xl tracking-tighter leading-none truncate">
              IMAGE<span className="text-mc-green">2</span>MINECRAFT
            </span>
            <span className="text-[9px] md:text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase leading-none mt-1 hidden sm:block">
              AI Vision Stylizer
            </span>
          </div>
        </div>
        <div className="shrink-0 ml-2 md:ml-4">
          <button 
            onClick={handleOpenKey} 
            className={cn(
              "flex items-center gap-2 text-xs md:text-sm font-black border-2 border-mc-border shadow-[2px_2px_0px_#111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none px-2 py-1.5 md:px-4 transition-all",
              hasKey ? "bg-mc-green text-mc-dark" : "bg-white text-mc-dark"
            )}
          >
            {hasKey ? (
              <div className="w-2 h-2 bg-mc-dark rounded-full animate-pulse shrink-0" />
            ) : (
              <Key className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
            )}
            <span>{hasKey ? "API READY" : "SET API KEY"}</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-8 lg:gap-12">
        
        {/* Hero */}
        <header className="text-center py-6 lg:py-12 px-2 relative">
          {/* Decorative blocks */}
          <div className="absolute top-4 left-4 lg:top-8 lg:left-12 w-8 h-8 bg-mc-green border-4 border-mc-dark hidden md:block transform -rotate-6"></div>
          <div className="absolute bottom-4 right-4 lg:bottom-8 lg:right-12 w-6 h-6 bg-gray-300 border-4 border-mc-dark hidden md:block transform rotate-12"></div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter text-mc-dark mb-5 lg:mb-8 leading-[1.2] md:leading-[1.1] max-w-4xl mx-auto text-balance px-2">
            Turn Photos Into <span className="text-white bg-mc-green border-[3px] md:border-4 border-mc-dark px-2 py-0.5 sm:px-3 sm:py-1 inline-block transform -rotate-2 shadow-[3px_3px_0px_#111] md:shadow-[4px_4px_0px_#111] mt-1 md:mt-0 ml-1 md:ml-2">Blocks</span>
          </h1>
          <p className="text-sm md:text-base lg:text-xl text-gray-600 max-w-2xl mx-auto font-semibold px-4">
            Upload any image and our Gemini-powered engine will reconstruct it using high-fidelity Minecraft shaders and blocks.
          </p>
        </header>

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Left: Upload Card */}
          <div className="mc-card p-5 lg:p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase flex items-center gap-3">
                <span className="bg-mc-green text-white border-4 border-mc-dark w-10 h-10 flex items-center justify-center shadow-[4px_4px_0px_#111]">1</span>
                Upload Photo
              </h2>
              {image && (
                <span className="text-sm font-bold bg-gray-200 text-gray-800 px-3 py-1 border-4 border-mc-dark shadow-[2px_2px_0px_#111]">
                  RATIO: {aspectRatio}
                </span>
              )}
            </div>

            <div 
              {...getRootProps()} 
              className={cn(
                "mc-inset flex-1 cursor-pointer flex flex-col items-center justify-center p-8 min-h-[350px] transition-colors",
                isDragActive ? "bg-[#e8f5e9] border-mc-green" : "pixel-pattern"
              )}
            >
              <input {...getInputProps({
                style: {
                  display: 'block',
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  zIndex: 50,
                  cursor: 'pointer'
                }
              })} />

              {image ? (
                <>
                  <img 
                    src={image} 
                    alt="Original" 
                    className="absolute inset-0 w-full h-full object-contain p-4 opacity-90 group-hover:opacity-40 transition-opacity"
                    referrerPolicy="no-referrer"
                  />
                  <div className="relative z-10 flex flex-col items-center gap-2 bg-mc-dark text-white border-4 border-mc-border px-6 py-4 shadow-[4px_4px_0px_rgba(0,0,0,0.3)] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <RefreshCw className="w-6 h-6" />
                    <span className="font-black text-sm uppercase tracking-widest">Tap to Replace</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 text-gray-500 relative z-10 w-full max-w-[220px]">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white border-4 border-mc-dark flex items-center justify-center shadow-[4px_4px_0px_#111] transform transition-transform group-hover:scale-110">
                    <Upload className="w-8 h-8 md:w-10 md:h-10 text-mc-green" />
                  </div>
                  <div className="text-center bg-white border-4 border-mc-border px-4 py-3 shadow-[4px_4px_0px_#111] w-full">
                    <p className="font-black text-mc-dark text-lg md:text-xl uppercase">Upload</p>
                    <p className="text-xs md:text-sm font-bold text-gray-500 mt-1">Tap or Drag</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Result Card */}
          <div className="mc-card p-5 lg:p-8 flex flex-col">
            <h2 className="text-2xl font-black uppercase flex items-center gap-3 mb-6">
              <span className="bg-mc-green text-white border-4 border-mc-dark w-10 h-10 flex items-center justify-center shadow-[4px_4px_0px_#111]">2</span>
              Crafted Result
            </h2>

            <div className="mc-inset-dark flex-1 flex flex-col items-center justify-center min-h-[350px]">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-6 z-10"
                  >
                    <div className="w-16 h-16 border-8 border-[#333] border-t-mc-green animate-spin rounded-full" />
                    <span className="font-black text-white tracking-widest uppercase text-xl">Crafting...</span>
                  </motion.div>
                ) : result ? (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 w-full h-full"
                  >
                    <img 
                      src={result} 
                      alt="Minecraft Stylized" 
                      className="w-full h-full object-contain p-4"
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-gray-500 z-10 w-full max-w-[220px]">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-[#222] border-4 border-[#333] flex items-center justify-center shadow-[inset_4px_4px_0px_rgba(0,0,0,0.5)]">
                      <ImageIcon className="w-8 h-8 md:w-10 md:h-10 text-[#444]" />
                    </div>
                    <div className="text-center bg-[#222] border-4 border-[#333] px-4 py-3 shadow-[inset_4px_4px_0px_rgba(0,0,0,0.5)] w-full">
                      <p className="font-black text-[#666] text-lg md:text-xl uppercase">Result</p>
                      <p className="text-xs md:text-sm font-bold text-[#555] mt-1">Awaiting Image</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* Action Bar */}
        <div className="flex flex-col items-center gap-4 mt-4 mb-16">
          {!hasKey && (
            <div className="text-red-600 font-bold text-sm flex items-center gap-2 bg-red-100 px-4 py-2 border-4 border-red-600 shadow-[4px_4px_0px_#dc2626]">
              <AlertCircle className="w-5 h-5" />
              API Key required to craft images
            </div>
          )}
          {error && (
            <div className="text-red-600 font-bold text-sm flex items-center gap-2 bg-red-100 px-4 py-2 border-4 border-red-600 shadow-[4px_4px_0px_#dc2626] max-w-2xl text-center">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}
          
          <button
            disabled={!image || loading || !hasKey}
            onClick={transformImage}
            className="mc-button w-full max-w-lg py-5 text-2xl lg:text-3xl"
          >
            {loading ? (
              <>
                <RefreshCw className="w-8 h-8 animate-spin" />
                CRAFTING...
              </>
            ) : (
              <>
                <Sparkles className="w-8 h-8" />
                CRAFT IMAGE
              </>
            )}
          </button>

          {result && !loading && (
            <button 
              onClick={downloadResult}
              className="bg-white text-mc-dark border-4 border-mc-border shadow-[4px_4px_0px_#111] font-black uppercase tracking-widest hover:bg-gray-50 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[0px_0px_0px_#111] transition-all flex items-center justify-center gap-3 mt-4 px-8 py-4 w-full max-w-lg text-xl"
            >
              <Download className="w-6 h-6" /> Download Result
            </button>
          )}
        </div>

      </main>

      {/* API Key Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white border-4 border-mc-dark shadow-[8px_8px_0px_#111] p-6 lg:p-8 max-w-md w-full relative"
            >
              <button 
                onClick={() => setShowKeyModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-mc-dark transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-2xl font-black uppercase mb-2 flex items-center gap-2">
                <Key className="w-6 h-6 text-mc-green" />
                Gemini API Key
              </h3>
              <p className="text-sm text-gray-600 font-semibold mb-6">
                Enter your Gemini API key to craft images. Your key is stored locally in your browser and never sent to our servers.
              </p>

              <input 
                type="password" 
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-gray-100 border-4 border-mc-dark p-3 font-mono text-sm mb-6 focus:outline-none focus:border-mc-green focus:bg-white transition-colors"
              />

              <div className="flex gap-3">
                <button 
                  onClick={saveApiKey}
                  className="flex-1 bg-mc-green text-white border-4 border-mc-dark shadow-[4px_4px_0px_#111] font-black uppercase py-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  Save Key
                </button>
                {apiKey && (
                  <button 
                    onClick={clearApiKey}
                    className="bg-red-500 text-white border-4 border-mc-dark shadow-[4px_4px_0px_#111] font-black uppercase px-4 py-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
