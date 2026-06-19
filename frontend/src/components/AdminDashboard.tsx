import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Certificate, AuditLog, DashboardStats, Role, Ticket, TicketMessage } from '../types';
import { DEPARTMENTS, getGraduationYears } from '../constants';
import { 
  Users, 
  Award, 
  Trash2, 
  AlertTriangle, 
  Activity, 
  PlusCircle, 
  Search, 
  Ban, 
  Check, 
  X, 
  UserX,
  UserCheck,
  ShieldCheck,
  Menu,
  FileSpreadsheet,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Upload,
  MessageSquare,
  UserCog,
  Send
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
}

export default function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'users' | 'certificates' | 'audit' | 'students' | 'tickets'>('stats');
  
  // User Management
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('Issuer');
  const [newUserInst, setNewUserInst] = useState('AASTU');
  const [userErrors, setUserErrors] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Certificate Search & Revocation in Admin
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchStatus, setSearchStatus] = useState<'All' | 'Active' | 'Revoked'>('All');
  const [searchDept, setSearchDept] = useState('All');
  const [searchYear, setSearchYear] = useState('');
  const [submittingRevoke, setSubmittingRevoke] = useState(false);

  // Revocation Modal State
  const [selectedCertForRevoke, setSelectedCertForRevoke] = useState<Certificate | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeError, setRevokeError] = useState('');

  // Student roster import
  const [studentCsvFile, setStudentCsvFile] = useState<File | null>(null);
  const [importingStudents, setImportingStudents] = useState(false);
  const [studentImportResult, setStudentImportResult] = useState<{ message: string; results: { imported: number; skipped: number; errors: any[] } } | null>(null);
  const [studentImportError, setStudentImportError] = useState('');

  // Audit activities
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Ticket management
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [selectedTicketAdmin, setSelectedTicketAdmin] = useState<Ticket | null>(null);
  const [ticketMsgsAdmin, setTicketMsgsAdmin] = useState<TicketMessage[]>([]);
  const [adminReply, setAdminReply] = useState('');
  const [adminTicketError, setAdminTicketError] = useState('');
  const [assignIssuerId, setAssignIssuerId] = useState('');
  const [assigningTicketId, setAssigningTicketId] = useState<string | null>(null);

  // Page index state
  const [certPage, setCertPage] = useState(1);
  const pageSize = 5; // Max rows

  const loadTickets = async () => {
    try { const t = await api.getTickets(); setAllTickets(t); } catch { /* ignore */ }
  };

  const loadTicketMsgsAdmin = async (ticketId: string) => {
    try { const msgs = await api.getTicketMessages(ticketId); setTicketMsgsAdmin(msgs); } catch { setTicketMsgsAdmin([]); }
  };

  const handleSelectTicketAdmin = async (t: Ticket) => {
    setSelectedTicketAdmin(t);
    setAssignIssuerId(t.assigned_to || '');
    await loadTicketMsgsAdmin(t.id);
    setAdminReply('');
    setAdminTicketError('');
  };

  const handleAdminTicketReply = async () => {
    if (!selectedTicketAdmin || !adminReply.trim()) return;
    try {
      await api.replyTicket(selectedTicketAdmin.id, adminReply.trim());
      setAdminReply('');
      await loadTicketMsgsAdmin(selectedTicketAdmin.id);
      await loadTickets();
    } catch (err: any) {
      setAdminTicketError(err.message || 'Failed to reply.');
    }
  };

  const handleAdminTicketStatus = async (ticketId: string, status: string) => {
    try {
      await api.updateTicketStatus(ticketId, status);
      await loadTickets();
      if (selectedTicketAdmin?.id === ticketId) {
        setSelectedTicketAdmin(prev => prev ? { ...prev, status: status as any } : null);
      }
    } catch (err: any) {
      setAdminTicketError(err.message || 'Failed to update status.');
    }
  };

  const handleAssignTicket = async (ticketId: string) => {
    if (!assignIssuerId.trim()) { setAdminTicketError('Select an issuer.'); return; }
    setAssigningTicketId(ticketId);
    try {
      await api.assignTicket(ticketId, assignIssuerId.trim());
      await loadTickets();
      if (selectedTicketAdmin?.id === ticketId) setSelectedTicketAdmin(prev => prev ? { ...prev, assigned_to: assignIssuerId.trim() } : null);
    } catch (err: any) {
      setAdminTicketError(err.message || 'Failed to assign.');
    } finally {
      setAssigningTicketId(null);
    }
  };

  // Load baseline statistics and elements
  const loadData = async () => {
    try {
      const dbStats = await api.getDashboardStats(currentUser.role, currentUser.username);
      setStats(dbStats);

      const dbUsers = await api.getUsers();
      setUsers(dbUsers);

      const dbLogs = await api.getAuditLogs();
      setLogs(dbLogs);

      const dbCerts = await api.searchCertificates({});
      setCerts(dbCerts);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    loadTickets();
    // Auto refresh every 60 seconds (FR-63 Compliance)
    const timer = setInterval(() => {
      loadData();
      loadTickets();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Creation Action
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserErrors('');
    setUserSuccess('');

    if (!newUsername.trim()) {
      setUserErrors('Username parameter cannot be left empty.');
      return;
    }

    try {
      await api.createUser(newUsername.trim(), newUserRole, newUserInst, newUserPassword.trim() || undefined);
      setUserSuccess(`Successfully registered active account for "${newUsername.trim()}"!`);
      setNewUsername('');
      setNewUserPassword('');
      loadData();
    } catch (err: any) {
      setUserErrors(err.message || 'Creation failed.');
    }
  };

  // Toggle user state
  const handleToggleDeactivate = async (userId: string) => {
    const origUserObj = users.find(u => u.id === userId);
    if (origUserObj && origUserObj.username === currentUser.username) {
      alert('Security lock: You cannot deactivate your own administrative session!');
      return;
    }

    try {
      const updated = await api.toggleUserDeactivate(userId);
      setUsers(updated);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Searhing Action
  const handleQuerySearch = async () => {
    try {
      const results = await api.searchCertificates({
        full_name_query: searchText,
        student_id_query: searchText,
        department: searchDept,
        graduation_year: searchYear,
        status: searchStatus
      });
      setCerts(results);
      setCertPage(1);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    handleQuerySearch();
  }, [searchText, searchDept, searchStatus]);

  // Revocation Modal execution
  const triggerRevocation = (cert: Certificate) => {
    setSelectedCertForRevoke(cert);
    setRevokeReason('');
    setRevokeError('');
  };

  const handleExecuteRevocation = async () => {
    if (!selectedCertForRevoke) return;
    if (!revokeReason.trim()) {
      setRevokeError('A formal revocation reason description is strictly required (FR-35).');
      return;
    }

    setSubmittingRevoke(true);
    setRevokeError('');
    try {
      await api.revokeCertificate(
        selectedCertForRevoke.certificate_id,
        revokeReason.trim(),
        currentUser.username
      );
      setSelectedCertForRevoke(null);
      loadData();
      handleQuerySearch();
    } catch (err: any) {
      setRevokeError(err.message || 'Error executing revocation chaincode workflow.');
    } finally {
      setSubmittingRevoke(false);
    }
  };

  // Pagination calculation
  const totalCertPages = Math.ceil(certs.length / pageSize) || 1;
  const currCertRows = certs.slice((certPage - 1) * pageSize, certPage * pageSize);

  const gradYears = getGraduationYears();

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Title block */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-xl">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Admin Console</h2>
          
        </div>
        
        {/* Sub Navigation Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-xl space-x-1 font-sans text-xs font-bold overflow-x-auto shrink-0 select-none">
          <button
            onClick={() => setActiveSubTab('stats')}
            className={`px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'stats' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Stats
          </button>
          <button
            onClick={() => setActiveSubTab('certificates')}
            className={`px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'certificates' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Degrees
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'users' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'audit' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Logs
          </button>
          <button
            onClick={() => setActiveSubTab('students')}
            className={`px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'students' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Students
          </button>
          <button
            onClick={() => setActiveSubTab('tickets')}
            className={`px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'tickets' ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Requests
          </button>
        </div>
      </div>

      {/* SUB-PANEL 1: LEDGER STATISTICS AND SUMMARY STATS */}
      {activeSubTab === 'stats' && stats && (
        <div className="space-y-8">
          
          {/* Bento Grid Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-slate-950 text-white rounded-xl p-5 border border-slate-800 shadow-md">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest font-semibold block">Total Registered Graduates</span>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-black tracking-tight">{stats.totalIssued}</span>
                <Award className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-mono">Issued Credentials</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm transition-colors">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest font-semibold block">Revoked Certificates</span>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400 tracking-tight">{stats.totalRevoked}</span>
                <Ban className="h-5 w-5 text-red-500" />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">Officially annulled certificates</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm transition-colors">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest font-semibold block">Verification Attempts (Today)</span>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{stats.verificationAttemptsToday}</span>
                <Clock className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">All-time count: {stats.verificationAttemptsAllTime}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm transition-colors">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest font-semibold block">Registered Users</span>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{stats.totalRegisteredUsers}</span>
                <Users className="h-5 w-5 text-indigo-500" />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">Admins, Registrars & Students</p>
            </div>
          </div>

          {/* Quick Recent Activity Stream */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-6 transition-colors">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-4 border-b border-slate-100 dark:border-slate-800">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>System Activity Monitor (Latest 10 Logs)</span>
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs mt-3">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[10px] font-bold">
                    <th className="pb-2">Action ID</th>
                    <th className="pb-2">Certificate ID</th>
                    <th className="pb-2">Executed Action</th>
                    <th className="pb-2">Actor</th>
                    <th className="pb-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.slice(0, 10).map((log, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                      <td className="py-2.5 text-blue-600 dark:text-blue-400 font-semibold">{log.id}</td>
                      <td className="py-2.5 font-sans font-bold text-slate-700 dark:text-slate-300">{log.certificate_id}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.action === 'Issue' ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300' :
                          log.action === 'Revoke' ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500 dark:text-slate-400 font-sans font-medium">{log.actor}</td>
                      <td className="py-2.5 text-slate-400 dark:text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400 font-mono">No events logged on the ledger yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* SUB-PANEL 2: INTEGRATED CERTIFICATE SEARCH & ACCREDITATION REVOCATIONS */}
      {activeSubTab === 'certificates' && (
        <div className="space-y-6">
          
          {/* Filters Bar block */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 grid grid-cols-1 md:grid-cols-5 gap-4 items-end transition-colors">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Search Keywords</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Student name, enrollment ID..."
                  className="w-full text-xs py-2 pl-3 pr-8 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <Search className="absolute right-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Filter Academic Department</label>
              <select
                className="w-full text-xs py-2 px-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchDept}
                onChange={(e) => setSearchDept(e.target.value)}
              >
                <option value="All">All Departments</option>
                {DEPARTMENTS.map((dept, idx) => (
                  <option key={idx} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Graduation Year</label>
              <select
                className="w-full text-xs py-2 px-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
              >
                <option value="">All Years</option>
                {gradYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Ledger Status</label>
              <select
                className="w-full text-xs py-2 px-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchStatus}
                onChange={(e) => setSearchStatus(e.target.value as any)}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Valid / Active Only</option>
                <option value="Revoked">Revoked Degrees Only</option>
              </select>
            </div>

            <button
              onClick={handleQuerySearch}
              className="py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-all cursor-pointer"
            >
              Search
            </button>
          </div>

          {/* Table displaying matching certificates */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-5 transition-colors">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-3 border-b border-slate-100 dark:border-slate-800">
              <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Registry Database System</span>
            </h3>
            <div className="overflow-x-auto min-h-[160px]">
              <table className="w-full text-left text-xs font-sans mt-3">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 font-mono border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[9px] font-bold">
                    <th className="pb-3 pr-2">Ledger Serial ID</th>
                    <th className="pb-3">Graduate Scholar</th>
                    <th className="pb-3">Enrollment ID</th>
                    <th className="pb-3">Aca. Department</th>
                    <th className="pb-3">CGPA</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currCertRows.map((cert) => (
                    <tr key={cert.certificate_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                      <td className="py-3 font-mono text-xs font-bold text-slate-500">{cert.certificate_id}</td>
                      <td className="py-3 font-extrabold text-slate-900 dark:text-slate-200">{cert.full_name}</td>
                      <td className="py-3 font-mono text-xs text-slate-600 dark:text-slate-400 font-semibold">{cert.student_id}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400 font-medium">{cert.department}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300 font-mono font-bold">{cert.cgpa.toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          cert.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/40'
                        }`}>
                          {cert.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {cert.status === 'Active' ? (
                          <button
                            id={`btn-revoke-${cert.certificate_id}`}
                            onClick={() => triggerRevocation(cert)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-100 rounded-lg text-xs font-bold cursor-pointer transition-all uppercase tracking-widest text-[10px]"
                          >
                            <Ban className="h-3 w-3 shrink-0" />
                            <span>Revoke</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-mono italic text-[10px]">Revoked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {certs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 font-mono">
                        No certificates matching filters currently listed in the registry databases.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls block (FR-50 Compliance) */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 text-slate-500 dark:text-slate-400 text-xs font-mono">
              <span>Displaying <strong>{currCertRows.length}</strong> of <strong>{certs.length}</strong> records</span>
              <div className="flex space-x-1">
                <button
                  onClick={() => setCertPage(p => Math.max(1, p - 1))}
                  disabled={certPage === 1}
                  className="p-1 px-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                </button>
                <button
                  onClick={() => setCertPage(p => Math.min(totalCertPages, p + 1))}
                  disabled={certPage === totalCertPages}
                  className="p-1 px-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SUB-PANEL 3: DELEGATED USERS MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Create User delegation Form */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-6 shadow-sm h-fit transition-colors">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-3 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Privilege Account Delegation</span>
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4 text-xs">
              {userErrors && (
                <div className="p-3 bg-red-50 dark:bg-red-950/35 text-red-800 dark:text-red-300 text-xs font-medium rounded-lg border border-red-100 dark:border-red-900/40 flex items-center space-x-1.5">
                  <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span>{userErrors}</span>
                </div>
              )}
              {userSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/35 text-emerald-800 dark:text-emerald-300 text-xs font-medium rounded-lg border border-emerald-100 dark:border-emerald-900/40 flex items-center space-x-1.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{userSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest font-bold mb-1">Username / ID</label>
                <input
                  id="input-new-user-name"
                  type="text"
                  required
                  placeholder="e.g. registrar_auditor"
                  className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest font-bold mb-1">Password</label>
                <input
                  id="input-new-user-password"
                  type="password"
                  placeholder="Leave empty for default"
                  className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest font-bold mb-1">Assign Role</label>
                <select
                  className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as Role)}
                >
                  <option value="Issuer">Issuer / Registrar (FR-61)</option>
                  <option value="Admin">System Administrator (Full)</option>
                  <option value="Student">Student Viewer Only (FR-62)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest font-bold mb-1">Institution ID</label>
                <input
                  type="text"
                  disabled
                  className="w-full text-xs py-2 px-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 rounded-lg font-mono"
                  value={newUserInst}
                  onChange={(e) => setNewUserInst(e.target.value)}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-3 rounded-lg text-[10px] leading-relaxed transition-colors">
                <strong>Password Note:</strong> Leave blank to auto-generate (<em>username</em>@AASTU2024). User can change after first login.
              </div>

              <button
                id="btn-create-account"
                type="submit"
                className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white font-semibold py-2 rounded-lg text-xs tracking-wider transition-colors cursor-pointer"
              >
                Add User
              </button>
            </form>
          </div>

          {/* User Status Administration list */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-6 shadow-sm lg:col-span-2 transition-colors">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-3 border-b border-slate-100 dark:border-slate-800">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Privilege Management List</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans mt-3">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 font-mono border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[9px] font-bold">
                    <th className="pb-3">Credential Name</th>
                    <th className="pb-3">Affiliation Institution</th>
                    <th className="pb-3">Role Authority</th>
                    <th className="pb-3">Security Status</th>
                    <th className="pb-3 text-right">Action Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">{item.username}</td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 font-mono uppercase">{item.institution_id}</td>
                      <td className="py-3 font-medium text-slate-700 dark:text-slate-300">{item.role}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.is_active ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-400'
                        }`}>
                          {item.is_active ? 'Active' : 'Locked'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleToggleDeactivate(item.id)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1.5 border rounded text-[10px] uppercase font-bold transition-all cursor-pointer ${
                            item.is_active 
                              ? 'bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border-red-100 dark:border-red-950/40 dark:bg-red-950/15' 
                              : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border-emerald-100 dark:border-emerald-950/40 dark:bg-emerald-950/15'
                          }`}
                        >
                          {item.is_active ? (
                            <>
                              <UserX className="h-3 w-3 inline shrink-0" />
                              <span>Block</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3 inline shrink-0" />
                              <span>Unblock</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* SUB-PANEL 4: SYSTEM AUDIT LOGGER */}
      {activeSubTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-6 shadow-sm transition-colors">
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-3 border-b border-slate-100 dark:border-slate-800">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span>Audit Logs</span>
          </h3>
          
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[9px] font-bold">
                  <th className="pb-3">Action ID</th>
                  <th className="pb-3">Certificate ID</th>
                  <th className="pb-3">Action Type</th>
                  <th className="pb-3">Executing User</th>
                  <th className="pb-3">Log Details</th>
                  <th className="pb-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                    <td className="py-3 font-semibold text-blue-600 dark:text-blue-400 font-mono text-xs">{log.id}</td>
                    <td className="py-3 text-slate-700 dark:text-slate-350 font-sans font-bold">{log.certificate_id}</td>
                    <td className="py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        log.action === 'Issue' ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300' :
                        log.action === 'Revoke' ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300' :
                        'bg-slate-100 dark:bg-slate-850 text-slate-850 dark:text-slate-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300 font-sans">{log.actor}</td>
                    <td className="py-3 text-slate-500 dark:text-slate-400 font-sans leading-normal pr-4 max-w-sm">{log.details}</td>
                    <td className="py-3 text-slate-400 dark:text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-PANEL 5: STUDENT ROSTER IMPORT */}
      {activeSubTab === 'students' && (
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-6 shadow-sm transition-colors">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-3 border-b border-slate-100 dark:border-slate-800 mb-5">
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Import Student Roster</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">CSV Format Requirements</h4>
                <p className="text-slate-500 dark:text-slate-400 mb-2">Upload a CSV file exported from the university student information system with the following columns:</p>
                <code className="block bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  student_id,full_name,email,department,graduation_year
                </code>
                <p className="text-slate-400 dark:text-slate-500 mt-2">
                  Existing records are updated. Missing fields will be rejected. All columns are required.
                </p>
              </div>

              {studentImportError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs font-semibold rounded-lg border border-red-100 dark:border-red-900/40 flex items-center space-x-1.5">
                  <X className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{studentImportError}</span>
                </div>
              )}

              {studentImportResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                  {studentImportResult.message}
                  {studentImportResult.results.errors.length > 0 && (
                    <div className="mt-2 bg-red-50 dark:bg-red-950/20 p-2 rounded max-h-24 overflow-y-auto">
                      {studentImportResult.results.errors.map((e: any, i: number) => (
                        <div key={i} className="text-[11px] font-mono text-red-700 dark:text-red-400 py-0.5">Row {e.row}: {e.message}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="px-4 py-2 bg-slate-900 border border-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer">
                    Choose CSV File
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => { setStudentCsvFile(e.target.files?.[0] || null); setStudentImportResult(null); setStudentImportError(''); }}
                    />
                  </label>
                  <span className="text-slate-500 dark:text-slate-400">
                    {studentCsvFile ? studentCsvFile.name : 'No file selected'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!studentCsvFile || importingStudents}
                  onClick={async () => {
                    if (!studentCsvFile) return;
                    setImportingStudents(true);
                    setStudentImportError('');
                    setStudentImportResult(null);
                    try {
                      const result = await api.importStudentsCsv(studentCsvFile);
                      setStudentImportResult(result);
                      setStudentCsvFile(null);
                    } catch (err: any) {
                      setStudentImportError(err.message || 'Import failed.');
                    } finally {
                      setImportingStudents(false);
                    }
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold uppercase rounded-lg cursor-pointer inline-flex items-center justify-center space-x-1"
                >
                  {importingStudents ? <span>Importing...</span> : <span>Upload & Import</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PANEL 6: TICKET MANAGEMENT */}
      {activeSubTab === 'tickets' && (
        <div className="space-y-6">
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2 text-base">
            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span>Support Requests</span>
          </h3>

          {adminTicketError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs font-semibold rounded-lg border border-red-100 dark:border-red-900/40">{adminTicketError}</div>
          )}

          {selectedTicketAdmin ? (
            /* Ticket Detail / Thread View */
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <button onClick={() => { setSelectedTicketAdmin(null); setTicketMsgsAdmin([]); }} className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline cursor-pointer">&larr; Back to list</button>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1">{selectedTicketAdmin.subject}</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    selectedTicketAdmin.status === 'Open' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100' :
                    selectedTicketAdmin.status === 'InReview' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100' :
                    selectedTicketAdmin.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100' :
                    selectedTicketAdmin.status === 'Rejected' ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-100' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>{selectedTicketAdmin.status}</span>
                  <span className="text-slate-400 text-[10px] font-mono">Student: {selectedTicketAdmin.student_name} ({selectedTicketAdmin.student_id})</span>
                </div>
              </div>

              {/* Status / Assignment Actions */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 items-center">
                {selectedTicketAdmin.status === 'Open' && (
                  <button onClick={() => handleAdminTicketStatus(selectedTicketAdmin.id, 'InReview')} className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded cursor-pointer">Mark In Review</button>
                )}
                {selectedTicketAdmin.status === 'InReview' && (
                  <>
                    <button onClick={() => handleAdminTicketStatus(selectedTicketAdmin.id, 'Approved')} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded cursor-pointer">Approve</button>
                    <button onClick={() => handleAdminTicketStatus(selectedTicketAdmin.id, 'Rejected')} className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded cursor-pointer">Reject</button>
                  </>
                )}

                <div className="ml-auto flex items-center space-x-2">
                  <select
                    className="text-[10px] py-1 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                    value={assignIssuerId}
                    onChange={e => setAssignIssuerId(e.target.value)}
                  >
                    <option value="">Assign to issuer...</option>
                    {users.filter(u => u.role === 'Issuer' && u.is_active).map(u => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssignTicket(selectedTicketAdmin.id)}
                    disabled={assigningTicketId === selectedTicketAdmin.id || !assignIssuerId}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-[10px] font-bold rounded cursor-pointer flex items-center"
                  >
                    <UserCog className="h-3 w-3 mr-1" />Assign
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {ticketMsgsAdmin.map(msg => (
                  <div key={msg.id} className={`p-3 rounded-lg border text-xs ${
                    msg.sender_role === 'Student' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30' : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 ml-6'
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{msg.sender_name} <span className="text-slate-400 font-normal">({msg.sender_role})</span></span>
                      <span className="text-slate-400 text-[10px]">{new Date(msg.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))}
              </div>

              {/* Reply */}
              {selectedTicketAdmin.status !== 'Resolved' && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex space-x-2">
                  <textarea rows={2} placeholder="Type reply..." className="flex-1 text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500" value={adminReply} onChange={e => setAdminReply(e.target.value)} />
                  <button onClick={handleAdminTicketReply} disabled={!adminReply.trim()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs rounded-lg flex items-center cursor-pointer"><Send className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          ) : (
            /* Ticket List */
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="text-slate-400 dark:text-slate-500 font-mono border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[9px] font-bold">
                      <th className="p-3">Subject</th>
                      <th className="p-3">Student</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Assigned To</th>
                      <th className="p-3">Created</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allTickets.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{t.subject}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{t.student_name}</td>
                        <td className="p-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            t.status === 'Open' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100' :
                            t.status === 'InReview' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100' :
                            t.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100' :
                            t.status === 'Rejected' ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-100' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>{t.status}</span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{t.assigned_to ? users.find(u => u.id === t.assigned_to)?.username || t.assigned_to : '—'}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => handleSelectTicketAdmin(t)} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded cursor-pointer">View</button>
                        </td>
                      </tr>
                    ))}
                    {allTickets.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400 font-mono">No requests found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== REVOCATION MODAL FOR ADMINS ===================== */}
      {selectedCertForRevoke && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-55 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 shadow-2xl max-w-md w-full overflow-hidden transition-colors">
            
            <div className="bg-red-600 text-white p-5 flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-white" />
              <h4 className="font-extrabold text-xs uppercase tracking-wider font-mono">
                Confirm Degree Revocation
              </h4>
            </div>

            <div className="p-6 space-y-4 text-xs font-sans text-slate-800 dark:text-slate-350">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-300 rounded-lg text-xs leading-relaxed border border-red-150 dark:border-red-900/30">
                <strong>WARNING:</strong> This action is permanent and cannot be undone.
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono block uppercase">Certificate Code</span>
                <span className="text-base font-bold text-slate-855 dark:text-slate-200 font-mono block">{selectedCertForRevoke.certificate_id}</span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono block uppercase">Graduate Scholar</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">{selectedCertForRevoke.full_name} ({selectedCertForRevoke.student_id})</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase mb-1">
                  Reason for Revocation
                </label>
                <textarea
                  id="textarea-revoke-reason"
                  required
                  rows={3}
                  placeholder="Provide explicit reason..."
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                  value={revokeReason}
                  onChange={(e) => {
                    setRevokeReason(e.target.value);
                    setRevokeError('');
                  }}
                />
              </div>

              {revokeError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 text-[11px] font-medium rounded border border-red-100 dark:border-red-900/40">
                  {revokeError}
                </div>
              )}

              <div className="flex space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCertForRevoke(null)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-revoke"
                  type="button"
                  disabled={submittingRevoke}
                  onClick={handleExecuteRevocation}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-extrabold uppercase tracking-wider rounded-lg border border-red-700 cursor-pointer shadow-sm transition-colors flex justify-center items-center"
                >
                  {submittingRevoke ? (
                    <span>Revoking...</span>
                  ) : (
                    <span>Confirm</span>
                  )}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
