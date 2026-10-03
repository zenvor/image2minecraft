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
import { MINECRAFT_TRANSFORM_PROMPT } from './lib/minecraftPrompt';

const MODEL_NAME = "gemini-3.1-flash-image";

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
  const [preview, setPreview] = useState<'original' | 'result'>('original');
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
          
          setPreview('original');
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
    multiple: false,
    disabled: loading
  });

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
    
    setPreview('result');
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
            { text: MINECRAFT_TRANSFORM_PROMPT },
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
    <div className="app-shell">
      <nav className="app-nav" aria-label="应用导航">
        <a href="/" className="brand" aria-label="Image2Minecraft 首页">
          <span className="brand-icon"><ImageIcon size={20} /></span>
          <span>IMAGE<span className="text-mc-green">2</span>MINECRAFT</span>
        </a>
        <button onClick={handleOpenKey} className="key-button">
          <Key size={16} /> {hasKey ? '密钥设置' : '设置密钥'}
        </button>
      </nav>

      <main className="mobile-workspace">
        <header className="workspace-intro">
          <span className="eyebrow">照片 → 方块世界</span>
          <h1>让现实，变成我的世界。</h1>
          <p>保留原图的天气与构图，换一种世界的质感。</p>
        </header>

        <div className="workspace-layout">
          <section className="settings-card" aria-label="照片与转换设置">
            <div className="section-heading"><h2>你的照片</h2>{image && <span className="ratio-badge">{aspectRatio}</span>}</div>
            <div {...getRootProps()} className={`upload-zone ${image ? 'has-image' : ''} ${isDragActive ? 'is-dragging' : ''} ${loading ? 'is-disabled' : ''}`}>
              <input {...getInputProps()} aria-label="选择要转换的照片" />
              {image ? <img src={image} alt="已选择的原图缩略图" className="upload-thumbnail" /> : <span className="upload-icon"><Upload size={24} /></span>}
              <div><strong>{image ? '更换照片' : '选择一张照片'}</strong><p>{loading ? '生成期间暂不可更换' : '点击从相册选择，也支持拖放'}</p></div>
              {image && <RefreshCw size={18} className="shrink-0" />}
            </div>

            <p className="settings-note">天气、光照与构图始终以原图为准</p>
          </section>

          <section className="preview-card" aria-label="图片预览">
            <div className="preview-toolbar">
              <h2>预览</h2>
              <div className="preview-options" role="group" aria-label="选择预览图片">
                <button aria-pressed={preview === 'original'} onClick={() => setPreview('original')}>原图</button>
                <button aria-pressed={preview === 'result'} onClick={() => setPreview('result')}>结果</button>
              </div>
            </div>
            <div className={`preview-stage ${image ? 'with-photo' : ''}`} aria-busy={loading && preview === 'result'}>
              {preview === 'result' && loading ? (
                <div className="preview-empty" role="status"><RefreshCw size={32} className="loading-spinner" /><strong>正在搭建你的方块世界</strong><p>完成后会在这里显示，请稍候</p></div>
              ) : (preview === 'original' ? image : result) ? (
                <img src={(preview === 'original' ? image : result)!} alt={preview === 'original' ? '原始照片' : 'Minecraft 转换结果'} className="preview-image" />
              ) : (
                <div className="preview-empty"><ImageIcon size={32} /><strong>{preview === 'original' ? '世界，从一张照片开始' : '你的方块世界将在这里出现'}</strong><p>{preview === 'original' ? '选择照片后，可在这里查看完整原图' : '点击下方按钮开始转换'}</p></div>
              )}
            </div>
            {result && preview === 'result' && <p className="preview-caption">可长按图片查看或保存，也可使用下方保存按钮</p>}
          </section>
        </div>
        {error && <div role="alert" className="error-message"><AlertCircle size={20} /><span>{error}</span></div>}
      </main>

      <footer className="action-dock">
        <div className="action-dock-inner">
          <p className="action-hint" aria-live="polite">{loading ? '正在生成，请保持页面打开' : !hasKey ? '先设置 Gemini API 密钥，再开始转换' : !image ? '选择照片后即可开始' : result ? '结果已生成，可保存或重新生成' : '照片已就绪，开始转换吧'}</p>
          <div className="action-buttons">
            <button disabled={!image || loading || !hasKey} onClick={transformImage} className="generate-button">
              {loading ? <RefreshCw size={20} className="loading-spinner" /> : <Sparkles size={20} />}
              {loading ? '正在生成…' : result ? '重新生成' : '生成方块世界'}
            </button>
            {result && !loading && <button onClick={downloadResult} className="save-button"><Download size={20} />保存图片</button>}
          </div>
        </div>
      </footer>

      {/* API Key Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white border-4 border-mc-dark shadow-[8px_8px_0px_#111] p-5 pt-14 lg:p-8 max-w-md w-full relative max-h-[90dvh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowKeyModal(false)}
                aria-label="关闭密钥设置" className="absolute top-2 right-2 min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-mc-dark transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-2xl font-black uppercase mb-2 flex items-center gap-2">
                <Key className="w-6 h-6 text-mc-green" />
                Gemini API 密钥
              </h3>
              <p className="text-sm text-gray-600 font-semibold mb-6">
                密钥保存在当前浏览器，仅用于向 Gemini 发起生成请求。
              </p>

              <input 
                aria-label="Gemini API 密钥"
                autoComplete="off"
                type="password" 
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-gray-100 border-4 border-mc-dark p-3 font-mono text-base mb-6 focus:outline-none focus:border-mc-green focus:bg-white transition-colors"
              />

              <div className="flex gap-3">
                <button 
                  onClick={saveApiKey}
                  className="flex-1 bg-mc-green text-white border-4 border-mc-dark shadow-[4px_4px_0px_#111] font-black uppercase py-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  保存密钥
                </button>
                {apiKey && (
                  <button 
                    onClick={clearApiKey}
                    className="bg-red-500 text-white border-4 border-mc-dark shadow-[4px_4px_0px_#111] font-black uppercase px-4 py-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    清除
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
