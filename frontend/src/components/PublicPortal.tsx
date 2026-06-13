import React, { useState, useRef, useEffect } from 'react';
import { api, computeFileSHA256 } from '../services/api';
import { VerificationResult, Certificate } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Search, 
  QrCode, 
  FileUp, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  BookOpen, 
  Hash, 
  User, 
  Calendar, 
  Download, 
  ExternalLink,
  Clipboard,
  CameraOff
} from 'lucide-react';

export default function PublicPortal() {
  const [activeTab, setActiveTab] = useState<'id' | 'qr' | 'pdf'>('id');
  const [certIdInput, setCertIdInput] = useState('');
  
  // Verification outcomes
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Public stats from database
  const [publicStats, setPublicStats] = useState<{ totalIssued: number; totalRevoked: number } | null>(null);

  // PDF upload
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfHash, setPdfHash] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // QR Code camera scanning
  const [cameraState, setCameraState] = useState<'idle' | 'scanning' | 'error' | 'permission_denied'>('idle');
  const [qrError, setQrError] = useState('');
  const qrRegionId = 'qr-video-reader';
  const html5QrcodeScannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    api.getPublicStats().then(setPublicStats).catch(() => {});
  }, []);

  // Actions
  const handleVerifyById = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!certIdInput.trim()) return;

    setVerifying(true);
    setResult(null);
    setSuccessMsg('');
    try {
      const res = await api.verifyCertificateById(certIdInput);
      setResult(res);
    } catch (err: any) {
      setResult({
        status: 'Invalid',
        message: err.message || 'Verification system failed to fetch record from the blockchain network.'
      });
    } finally {
      setVerifying(false);
    }
  };

  // PDF processing with client-side SHA-256 calculation
  const handlePdfChange = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Only PDF files are supported for academic certificates authenticity verification.');
      return;
    }
    setPdfFile(file);
    setVerifying(true);
    setResult(null);
    setSuccessMsg('');
    try {
      const hash = await computeFileSHA256(file);
      setPdfHash(hash);
      const res = await api.verifyCertificateByHash(hash);
      setResult(res);
    } catch (err: any) {
      setResult({
        status: 'Invalid',
        message: err.message || 'Authentic reference failed check.'
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePdfChange(e.dataTransfer.files[0]);
    }
  };

  // Camera life-cycle
  const startScanning = async () => {
    setCameraState('scanning');
    setQrError('');
    try {
      // Small timeout to allow element rendering
      setTimeout(async () => {
        try {
          const scanner = new Html5Qrcode(qrRegionId);
          html5QrcodeScannerRef.current = scanner;
          
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.7;
                return { width: size, height: size };
              }
            },
            async (decodedText) => {
              // Action: stop scanning instantly on decode
              await stopScanning();
              
              // Standard formats: URL containing /verify/<id> or plain ID
              let discoveredId = decodedText;
              if (decodedText.includes('/verify/')) {
                const parts = decodedText.split('/verify/');
                discoveredId = parts[parts.length - 1];
              } else if (decodedText.startsWith('http')) {
                try {
                  const url = new URL(decodedText);
                  const pathParts = url.pathname.split('/');
                  discoveredId = pathParts[pathParts.length - 1];
                } catch {
                  // Fallback to text
                }
              }
              
              setCertIdInput(discoveredId);
              setActiveTab('id');
              setSuccessMsg('QR code scanned successfully!');
              
              // Auto triggering lookup
              setVerifying(true);
              try {
                const res = await api.verifyCertificateById(discoveredId);
                setResult(res);
              } catch (err: any) {
                setResult({
                  status: 'Invalid',
                  message: err.message || 'Error pulling blockchain record.'
                });
              } finally {
                setVerifying(false);
              }
            },
            (errorMessage) => {
              // Highly verbose, ignore continuous scanner matching errors
            }
          );
        } catch (scannerError: any) {
          console.error("Scanner setup failed", scannerError);
          setQrError(scannerError.message || "Failed to initialize active camera feed.");
          setCameraState('error');
        }
      }, 300);
    } catch (e: any) {
      setQrError("Unable to gain access to camera permissions in browser.");
      setCameraState('permission_denied');
    }
  };

  const stopScanning = async () => {
    if (html5QrcodeScannerRef.current && html5QrcodeScannerRef.current.isScanning) {
      try {
        await html5QrcodeScannerRef.current.stop();
      } catch (err) {
        console.warn("Error stopping scanner session", err);
      }
    }
    html5QrcodeScannerRef.current = null;
    setCameraState('idle');
  };

  // Deconstruct components on unmount and check for outer QR code verification triggers
  useEffect(() => {
    const prefilledId = sessionStorage.getItem('prefilled_verify_id');
    if (prefilledId) {
      sessionStorage.removeItem('prefilled_verify_id');
      setCertIdInput(prefilledId);
      setActiveTab('id');
      setVerifying(true);
      api.verifyCertificateById(prefilledId)
        .then(res => setResult(res))
        .catch(err => setResult({
          status: 'Invalid',
          message: err.message || 'Error executing automatic QR lookup'
        }))
        .finally(() => setVerifying(false));
    }

    return () => {
      if (html5QrcodeScannerRef.current) {
        stopScanning();
      }
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Brand, Introduction and Metrics Layout in Two-Column Grid for Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-10">
        
        {/* Left Column: Title and High-End Institutional Metrics */}
        <div className="lg:col-span-4 flex flex-col justify-center gap-6 lg:sticky lg:top-24">
          <h1 className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl xl:text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-tighter uppercase">
            Verify <span className="text-primary dark:text-blue-400">Academic</span> Integrity
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base leading-relaxed">
            Instantly verify the validity and authenticity of degree certificates issued by Addis Ababa Science and Technology University.
          </p>
          {publicStats && (
            <div className="flex items-center gap-6 py-4 border-t border-b border-slate-200/60 dark:border-slate-800">
              <div className="flex flex-col border-l-4 border-primary dark:border-blue-500 pl-4">
                <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{publicStats.totalIssued.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Degrees Issued</span>
              </div>
              <div className="flex flex-col border-l-4 border-emerald-500 pl-4">
                <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{publicStats.totalRevoked}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Revoked</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Main Verification Control Center */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
            
            {/* Verification Option Tabs */}
            <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 p-2 flex flex-col sm:flex-row gap-1">
              <button
                id="tab-id"
                onClick={() => { setActiveTab('id'); stopScanning(); }}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'id'
                    ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
                }`}
              >
                <Search className="h-4 w-4" />
                <span>Certificate ID</span>
              </button>
              <button
                id="tab-qr"
                onClick={() => { setActiveTab('qr'); startScanning(); }}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'qr'
                    ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
                }`}
              >
                <QrCode className="h-4 w-4" />
                <span>QR Scanner</span>
              </button>
              <button
                id="tab-pdf"
                onClick={() => { setActiveTab('pdf'); stopScanning(); }}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'pdf'
                    ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
                }`}
              >
                <FileUp className="h-4 w-4" />
                <span>PDF Upload</span>
              </button>
            </div>

            {/* Tab content bodies */}
            <div className="p-6 sm:p-8">
              
              {/* SUCCESS BANNER OR INFO TIP */}
              {successMsg && (
                <div className="mb-4 bg-emerald-50 text-emerald-800 p-3 rounded-lg text-xs font-mono border border-emerald-100 flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* TAB 1: VERIFY BY ID */}
          {activeTab === 'id' && (
            <form onSubmit={handleVerifyById} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                  Enter Academic Certificate ID or Student ID
                </label>
                <div className="relative">
                  <input
                    id="input-certificate-id"
                    type="text"
                    required
                    placeholder="e.g. AASTU-2024-0001 or ETS0951/15"
                    className="w-full bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl py-4 pl-4 pr-12 text-base font-medium text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    value={certIdInput}
                    onChange={(e) => setCertIdInput(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </div>

              <button
                id="btn-verify-id"
                type="submit"
                disabled={verifying}
                className="w-full bg-primary hover:bg-primary-dark disabled:bg-slate-400 text-white font-bold py-3 px-6 rounded-lg transition-all flex justify-center items-center space-x-2 cursor-pointer"
              >
                {verifying ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify</span>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: QR CAMERA SCANNER */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-full max-w-sm overflow-hidden rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-900 text-white relative flex flex-col items-center justify-center min-h-[250px] transition-colors">
                
                {/* Embedded HTML5 QR Code hook */}
                <div id={qrRegionId} className="w-full"></div>

                {cameraState === 'idle' && (
                  <div className="p-6 text-center space-y-3">
                    <QrCode className="h-10 w-10 text-slate-400 mx-auto" />
                    <p className="text-xs font-medium">Camera scanning is inactive.</p>
                    <button
                      type="button"
                      onClick={startScanning}
                      className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Start Camera
                    </button>
                  </div>
                )}

                {cameraState === 'error' && (
                  <div className="p-6 text-center space-y-3">
                    <CameraOff className="h-10 w-10 text-red-500 mx-auto" />
                    <p className="text-xs font-semibold text-red-400">Camera search unavailable.</p>
                    <button
                      type="button"
                      onClick={startScanning}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {cameraState === 'scanning' && (
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-slate-950 font-mono animate-pulse">
                      ● Camera Active
                    </span>
                  </div>
                )}
              </div>

              {cameraState === 'scanning' && (
                <button
                  type="button"
                  onClick={stopScanning}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 text-xs font-bold rounded-md transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          )}          {/* TAB 3: PDF FILE UPLOADER FOR AUTH / TAMPER CHECK */}
          {activeTab === 'pdf' && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full py-8 px-4 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center ${
                  dragActive
                    ? 'border-primary dark:border-blue-500 bg-slate-50/50 dark:bg-slate-950/40'
                    : 'border-slate-350 dark:border-slate-800 hover:border-primary dark:hover:border-primary bg-slate-50/20 dark:bg-slate-950/10'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files && e.target.files[0] && handlePdfChange(e.target.files[0])}
                />
                <FileUp className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-250">
                  {pdfFile ? pdfFile.name : 'Drag & Drop Certificate PDF here'}
                </h4>
                <button
                  type="button"
                  className="mt-3 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold shadow-sm"
                >
                  Browse
                </button>
              </div>

              {pdfFile && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg text-xs text-slate-500 border border-slate-200 dark:border-slate-800 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-slate-600 dark:text-slate-400 font-bold">SHA-256 HASH:</span>
                    {pdfHash && (
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(pdfHash); }}
                        className="text-[10px] px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded font-semibold text-slate-500 dark:text-slate-400 cursor-pointer transition-colors"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                  <span className="font-mono font-semibold text-slate-500 break-all block text-[10px] sm:text-xs select-all">
                    {pdfHash || 'Generating...'}
                  </span>
                </div>
              )}
            </div>
          )}

        </div> {/* Close Tab content bodies */}
      </div> {/* Close Main Verification Dashboard Container */}
    </div> {/* Close Right Column */}
  </div> {/* Close Grid Container */}

      {/* VERIFICATION FEEDBACK PORTAL BANNER RESULTS */}
      {verifying && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm text-center font-mono my-6 transition-colors">
          <div className="flex justify-center space-x-2">
            <span className="bg-primary h-2 w-2 rounded-full animate-bounce"></span>
            <span className="bg-primary-light h-2 w-2 rounded-full animate-bounce [animation-delay:0.15s]"></span>
            <span className="bg-primary h-2 w-2 rounded-full animate-bounce [animation-delay:0.3s]"></span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Reading ledger states...</p>
        </div>
      )}

      {result && (
        <div className="animate-fade-in transition-all">
          
          {result.status === 'Valid' && result.certificate && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500 dark:border-emerald-600/50 rounded-2xl overflow-hidden shadow-sm mb-6 transition-colors">
              <div className="bg-emerald-500 dark:bg-emerald-600 text-white px-5 py-4.5 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
                <span>Verified: Record Authenticity Confirmed</span>
              </div>
              
              {/* Certificate read-only credentials */}
              <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-emerald-100 dark:border-slate-800 transition-colors">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Scholar Legal Name</span>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white font-sans block">{result.certificate.full_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Enrollment ID</span>
                    <span className="text-base font-bold text-slate-700 dark:text-slate-300 font-mono block">{result.certificate.student_id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Academic Program</span>
                    <span className="text-base font-medium text-slate-800 dark:text-slate-200 block">{result.certificate.department}</span>
                  </div>
                </div>

                <div className="space-y-4 md:pl-6 md:border-l border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Cumulative CGPA</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white block">{result.certificate.cgpa.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Batch Year</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white block">{result.certificate.graduation_year}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Registration Timestamp</span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-mono block">
                      {new Date(result.certificate.issue_date).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Certificate Serial ID</span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-mono block break-all">{result.certificate.certificate_id}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RED BANNER: CERTIFICATE REVOKED */}
          {result.status === 'Revoked' && result.certificate && (
            <div className="bg-red-600 text-white rounded-xl overflow-hidden shadow-md mb-6 transition-colors font-sans">
              <div className="p-4 sm:p-5 flex items-center space-x-3 bg-red-700/90 font-mono">
                <XCircle className="h-6 w-6 text-white shrink-0" />
                <div className="flex-1">
                  <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider font-mono">
                    🔴 CERTIFICATE STATUS: REVOKED
                  </h3>
                  <p className="text-red-100 text-xs mt-0.5 leading-relaxed">
                    This degree was officially revoked on{' '}
                    <strong>{result.revocation_date ? new Date(result.revocation_date).toLocaleDateString() : 'N/A'}</strong>.
                  </p>
                </div>
              </div>

              {/* Revocation Specific parameters */}
              <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-6 sm:p-8 border border-red-200 dark:border-slate-800 transition-colors">
                <div className="mb-6 bg-red-50 dark:bg-red-955 border-l-4 border-red-500 p-4 rounded-r-lg">
                  <h4 className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-widest font-mono mb-1">
                    Revocation Reason:
                  </h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
                    "{result.revocation_reason}"
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Graduate Full Name</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white block">{result.certificate.full_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Enrollment ID</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono block">{result.certificate.student_id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Certificate Serial ID</span>
                    <span className="text-xs font-mono text-red-600 dark:text-red-400 block">{result.certificate.certificate_id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest block">Academic Program</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 block">{result.certificate.department}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RED BANNER: CERTIFICATE NOT FOUND */}
          {result.status === 'Invalid' && (
            <div className="bg-red-600 text-white rounded-xl overflow-hidden shadow-lg p-5 flex items-start space-x-3.5">
              <AlertTriangle className="h-6 w-6 text-white shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider font-mono">
                  🔴 INVALID CERTIFICATE — RECORD NOT FOUND
                </h3>
                <p className="text-red-100 text-xs sm:text-sm mt-1 leading-relaxed">
                  {result.message}
                </p>
                <div className="mt-4 bg-red-700 p-3 rounded-lg text-xs leading-normal leading-relaxed text-red-50">
                  <p className="font-bold">Possible causes for this error message:</p>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 font-sans">
                    <li>The entered ID contains a spelling mismatch.</li>
                    <li>The certificate PDF file has been modified or edited.</li>
                    <li>This credential has not yet been registered by the university.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
