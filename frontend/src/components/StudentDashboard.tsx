import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Certificate, User, Ticket, TicketMessage } from '../types';
import { Download, Share2, Award, Check, MessageSquare, Send, Plus, ChevronDown } from 'lucide-react';

interface StudentDashboardProps {
  currentUser: User;
}

export default function StudentDashboard({ currentUser }: StudentDashboardProps) {
  const [cert, setCert] = useState<Certificate | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qrBlobUrl, setQrBlobUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'certificate' | 'support'>('certificate');

  // Ticket state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [ticketSuccess, setTicketSuccess] = useState('');

  const loadTickets = async () => {
    try {
      const t = await api.getTickets();
      setTickets(t);
    } catch { /* ignore */ }
  };

  const loadTicketMessages = async (ticketId: string) => {
    try {
      const msgs = await api.getTicketMessages(ticketId);
      setTicketMessages(msgs);
    } catch { setTicketMessages([]); }
  };

  const handleSelectTicket = async (t: Ticket) => {
    setSelectedTicket(t);
    await loadTicketMessages(t.id);
    setReplyMessage('');
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError('');
    setTicketSuccess('');
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      setTicketError('Subject and message are required.');
      return;
    }
    try {
      await api.createTicket(currentUser.student_id || '', newTicketSubject.trim(), newTicketMessage.trim());
      setTicketSuccess('Request created successfully.');
      setNewTicketSubject('');
      setNewTicketMessage('');
      setShowNewTicket(false);
      await loadTickets();
    } catch (err: any) {
      setTicketError(err.message || 'Failed to create request.');
    }
  };

  const handleTicketReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    try {
      await api.replyTicket(selectedTicket.id, replyMessage.trim());
      setReplyMessage('');
      await loadTicketMessages(selectedTicket.id);
      await loadTickets();
    } catch (err: any) {
      setTicketError(err.message || 'Failed to send reply.');
    }
  };

  useEffect(() => {
    const fetchStudentCert = async () => {
      try {
        const res = await api.getMyCertificate();
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

      {/* Sub Navigation Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-xl space-x-1 font-sans text-xs font-bold mb-6 select-none">
        <button
          onClick={() => setActiveTab('certificate')}
          className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'certificate' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Award className="h-3.5 w-3.5 inline mr-1" />Certificate
        </button>
        <button
          onClick={() => setActiveTab('support')}
          className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'support' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
            <MessageSquare className="h-3.5 w-3.5 inline mr-1" />Support Request
        </button>
      </div>

      {activeTab === 'certificate' && (
      <>
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
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            No certificates match your student ID. Contact the registrar if you believe this is an error.
          </p>
        </div>
      )}
      </>
      )}

      {activeTab === 'support' && (
      <div className="space-y-6">
        {/* Request List Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2 text-base">
            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span>My Support Requests</span>
          </h3>
          <button
            onClick={() => { setShowNewTicket(!showNewTicket); setTicketError(''); setTicketSuccess(''); }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /><span>New Request</span>
          </button>
        </div>

        {ticketError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs font-semibold rounded-lg border border-red-100 dark:border-red-900/40">{ticketError}</div>
        )}
        {ticketSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-100 dark:border-emerald-900/40">{ticketSuccess}</div>
        )}

        {/* New Request Form */}
        {showNewTicket && (
          <form onSubmit={handleCreateTicket} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">Subject</label>
              <input
                type="text" required
                placeholder="e.g. Request for certificate re-issuance"
                className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={newTicketSubject}
                onChange={e => setNewTicketSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">Message</label>
              <textarea
                required rows={3}
                placeholder="Describe your issue..."
                className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={newTicketMessage}
                onChange={e => setNewTicketMessage(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setShowNewTicket(false)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer">Submit</button>
            </div>
          </form>
        )}

        {/* Ticket List / Message Thread View */}
        {selectedTicket ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Thread Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <button onClick={() => { setSelectedTicket(null); setTicketMessages([]); }} className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline cursor-pointer">&larr; Back to requests</button>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1">{selectedTicket.subject}</h4>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1 ${
                  selectedTicket.status === 'Open' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40' :
                  selectedTicket.status === 'InReview' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40' :
                  selectedTicket.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40' :
                  selectedTicket.status === 'Rejected' ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/40' :
                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>{selectedTicket.status}</span>
              </div>
            </div>
            {/* Messages */}
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {ticketMessages.map(msg => (
                <div key={msg.id} className={`p-3 rounded-lg border text-xs ${
                  msg.sender_role === 'Student' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 ml-6' : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 mr-6'
                }`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{msg.sender_name} <span className="text-slate-400 font-normal">({msg.sender_role})</span></span>
                    <span className="text-slate-400 text-[10px]">{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
              {ticketMessages.length === 0 && <p className="text-center text-slate-400 text-xs">No messages yet.</p>}
            </div>
            {/* Reply Box */}
            {selectedTicket.status !== 'Resolved' && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex space-x-2">
                <textarea
                  rows={2} placeholder="Type your reply..."
                  className="flex-1 text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={replyMessage}
                  onChange={e => setReplyMessage(e.target.value)}
                />
                <button onClick={handleTicketReply} disabled={!replyMessage.trim()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs rounded-lg flex items-center cursor-pointer">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Ticket List Table */
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 font-mono border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[9px] font-bold">
                    <th className="p-3">Subject</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tickets.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 cursor-pointer" onClick={() => handleSelectTicket(t)}>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{t.subject}</td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          t.status === 'Open' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40' :
                          t.status === 'InReview' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40' :
                          t.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40' :
                          t.status === 'Rejected' ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/40' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>{t.status}</span>
                      </td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">{new Date(t.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right"><ChevronDown className="h-3.5 w-3.5 inline text-slate-400" /></td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-400 font-mono">No support requests yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

    </div>
  );
}
