import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Certificate, User } from '../types';
import { Download, Share2, Award, Clipboard, Check, QrCode, FileText } from 'lucide-react';

interface StudentDashboardProps {
  currentUser: User;
}

export default function StudentDashboard({ currentUser }: StudentDashboardProps) {
  const [cert, setCert] = useState<Certificate | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qrBlobUrl, setQrBlobUrl] = useState<string>('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');

  useEffect(() => {
    const fetchStudentCert = async () => {
      try {
        const studentIdToSearch = currentUser.student_id || currentUser.username;
        let res = await api.searchCertificates({ student_id_query: studentIdToSearch });
        if (res.length === 0 && !currentUser.student_id) {
          res = await api.searchCertificates({ full_name_query: currentUser.username });
        }
        if (res.length > 0) {
          setCert(res[0]);
        }
      } catch (err) {
        console.error('Error fetching student certificate', err);
      }
    };
    fetchStudentCert();
  }, [currentUser]);

  useEffect(() => {
    if (!cert) return;
    fetch(`/api/certificates/${cert.certificate_id}/qr`)
      .then(r => r.blob())
      .then(blob => setQrBlobUrl(URL.createObjectURL(blob)))
      .catch(() => {});
  }, [cert]);

  const handleCopyLink = () => {
    if (!cert) return;
    const localVerifyURL = `${window.location.origin}/verify/${cert.certificate_id}`;
    navigator.clipboard.writeText(localVerifyURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!cert) return;
    setDownloading(true);
    try {
      const response = await fetch(`/api/recovery/${cert.certificate_id}`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cert.certificate_id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Could not download certificate PDF. Please contact the registrar.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Welcome Banner */}
      <div className="bg-slate-950 dark:bg-slate-900 text-white rounded-xl p-6 shadow-lg border border-slate-800/80 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Welcome back, Graduate!</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Access your secure diploma, download verification tags, or share the QR code.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={handleDownloadPDF}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Save PDF</span>
          </button>
          
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer border border-slate-700"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {cert ? (
        <div className="space-y-8">
          
          {/* Certificate visual frame */}
          <div className="bg-stone-50 rounded-2xl border-4 sm:border-[12px] border-slate-800 p-4 sm:p-12 relative shadow-2xl overflow-hidden font-serif text-slate-900">
            
            {/* Elegant backgrounds pattern */}
            <div className="absolute inset-0 border border-amber-600/30 m-1 pointer-events-none"></div>
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Award className="h-44 w-44" />
            </div>

            {/* University Title */}
            <div className="text-center space-y-2 pb-6 border-b border-stone-200">
              <h3 className="text-base sm:text-2xl md:text-3xl tracking-wide uppercase font-extrabold text-[#112255] font-sans">
                Addis Ababa Science & Technology University
              </h3>
              <p className="text-[10px] sm:text-xs tracking-widest text-amber-700 uppercase font-mono font-bold">
                DEPARTMENT OF ELECTRICAL AND COMPUTER ENGINEERING
              </p>
            </div>

            <div className="py-10 text-center space-y-6">
              <span className="text-[10px] sm:text-xs font-sans text-slate-500 italic uppercase tracking-wider block">
                This academic degree certifies that
              </span>
              
              <h4 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 underline decoration-amber-500 decoration-2 font-serif">
                {cert.full_name}
              </h4>

              <p className="text-xs sm:text-sm md:text-base text-slate-700 leading-relaxed font-sans max-w-xl mx-auto">
                upon successful compliance of all curricular program constraints is officially accredited the degree of
                <strong className="block text-slate-900 font-extrabold text-sm sm:text-lg md:text-xl font-serif mt-2">
                  Bachelor of Science in {cert.department}
                </strong>
                with a Cumulative Quality Grade Point Average of <strong className="font-mono font-bold">{cert.cgpa.toFixed(2)}</strong>.
              </p>

              <p className="text-[10px] sm:text-xs text-slate-500 font-sans tracking-tight">
                Issued this <strong className="font-mono">{new Date(cert.issue_date).toLocaleDateString()}</strong>.
              </p>
            </div>

            {/* Signature and verification QR Code fields */}
            <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row justify-between items-center gap-6">
              
              {/* Registrar Signature simulation */}
              <div className="text-center font-sans space-y-1">
                <div className="h-10 text-xl font-serif font-extrabold text-slate-800 italic tracking-wider flex items-end justify-center">
                  Esubalew Mulat
                </div>
                <div className="w-44 border-t border-slate-300 mx-auto"></div>
                <span className="text-[9px] text-slate-400 block font-mono uppercase tracking-wider">Dean / Academic Registrar Auth</span>
              </div>

              {/* Secure QR code preview */}
              <div className="flex items-center space-x-4 bg-stone-100 p-2.5 rounded-lg border border-stone-200/50">
                <img
                  src={qrBlobUrl || ''}
                  alt="Verified QR code"
                  className="h-20 w-20 rounded bg-white p-1 shadow-sm object-contain"
                />
                <div className="text-left font-mono text-[9px] text-stone-500 space-y-0.5">
                  <span className="text-[#1e3a8a] font-bold block">Verification QR</span>
                  <span>ID: <strong className="text-slate-700 select-all">{cert.certificate_id}</strong></span>
                  <span>ID: <strong className="text-slate-700 select-all">{cert.student_id}</strong></span>
                  <span className="block text-[8px] text-emerald-600 font-semibold uppercase font-sans">🟢 Certificate Valid</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-12 border border-slate-100 dark:border-slate-800 text-center shadow-md transition-colors">
          <Award className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3 animate-pulse" />
          <h4 className="font-bold text-slate-850 dark:text-slate-200">No certificates found</h4>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 mb-4">
            {currentUser.student_id
              ? 'No certificates match your registered student ID.'
              : 'Link your student ID to view your certificates.'}
          </p>
          {!currentUser.student_id && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Link Student ID
            </button>
          )}
        </div>
      )}

      {/* Link Student ID Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-55 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 shadow-2xl max-w-sm w-full overflow-hidden transition-colors">
            <div className="bg-blue-600 text-white p-5">
              <h4 className="font-extrabold text-xs uppercase tracking-wider font-mono">Link Student ID</h4>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-500 dark:text-slate-400">Enter your student ID to link it with your account:</p>
              {linkError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 text-[11px] font-medium rounded border border-red-100 dark:border-red-900/40">{linkError}</div>
              )}
              {linkSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-[11px] font-medium rounded border border-emerald-100 dark:border-emerald-900/40">{linkSuccess}</div>
              )}
              <input
                type="text"
                required
                placeholder="e.g. ETS0951/15"
                className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={linkStudentId}
                onChange={(e) => { setLinkStudentId(e.target.value); setLinkError(''); setLinkSuccess(''); }}
              />
              <div className="flex space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowLinkModal(false); setLinkStudentId(''); setLinkError(''); setLinkSuccess(''); }}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!linkStudentId.trim()) { setLinkError('Student ID is required.'); return; }
                    try {
                      await api.linkStudentId(linkStudentId.trim());
                      setLinkSuccess('Student ID linked! Refreshing...');
                      setTimeout(() => window.location.reload(), 1500);
                    } catch (err: any) {
                      setLinkError(err.message || 'Failed to link student ID.');
                    }
                  }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase rounded-lg cursor-pointer"
                >
                  Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
