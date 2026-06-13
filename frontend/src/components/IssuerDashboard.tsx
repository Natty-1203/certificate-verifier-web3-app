import React, { useState, useEffect, useRef } from 'react';
import { api, computeFileSHA256 } from '../services/api';
import { Certificate, DashboardStats, User } from '../types';
import { DEPARTMENTS, getGraduationYears } from '../constants';
import { 
  FilePlus, 
  Search, 
  Award, 
  Calendar, 
  Download, 
  CheckCircle, 
  X, 
  TrendingUp, 
  BookOpen, 
  FileUp, 
  QrCode,
  CheckCircle2,
  FileSpreadsheet,
  Grid,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface IssuerDashboardProps {
  currentUser: User;
}

export default function IssuerDashboard({ currentUser }: IssuerDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'issue' | 'batch' | 'registry'>('stats');

  // Issue Certificate Form State
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('Electrical and Computer Engineering');
  const [cgpa, setCgpa] = useState('');
  const [gradYear, setGradYear] = useState(String(new Date().getFullYear()));

  // PDF File block in Form
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFileHash, setAttachedFileHash] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Validation and saving states
  const [formError, setFormError] = useState('');
  const [submittingInsert, setSubmittingInsert] = useState(false);
  
  // SUCCESS MODAL
  const [createdCert, setCreatedCert] = useState<Certificate | null>(null);

  // Registry Search panel
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchDept, setSearchDept] = useState('All');
  const [searchYear, setSearchYear] = useState('');
  const [registryPage, setRegistryPage] = useState(1);
  const pageSize = 5;

  // Batch issuance state
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchIssuing, setBatchIssuing] = useState(false);
  const [batchResult, setBatchResult] = useState<{ message: string; results: { success: any[]; errors: any[] } } | null>(null);

  const gradYears = getGraduationYears();

  // Auto-Save load/save matching sessionStorage NFR-33 constraint
  useEffect(() => {
    const savedName = sessionStorage.getItem('issue_fullName') || '';
    const savedId = sessionStorage.getItem('issue_studentId') || '';
    const savedDept = sessionStorage.getItem('issue_department') || 'Electrical and Computer Engineering';
    const savedCgpa = sessionStorage.getItem('issue_cgpa') || '';
    const savedYear = sessionStorage.getItem('issue_gradYear') || String(new Date().getFullYear());

    if (savedName) setFullName(savedName);
    if (savedId) setStudentId(savedId);
    if (savedDept) setDepartment(savedDept);
    if (savedCgpa) setCgpa(savedCgpa);
    if (savedYear) setGradYear(savedYear);
  }, []);

  const updateFormState = (field: string, val: string) => {
    sessionStorage.setItem(`issue_${field}`, val);
    if (field === 'fullName') setFullName(val);
    if (field === 'studentId') setStudentId(val);
    if (field === 'department') setDepartment(val);
    if (field === 'cgpa') setCgpa(val);
    if (field === 'gradYear') setGradYear(val);
  };

  const clearFormSession = () => {
    sessionStorage.removeItem('issue_fullName');
    sessionStorage.removeItem('issue_studentId');
    sessionStorage.removeItem('issue_department');
    sessionStorage.removeItem('issue_cgpa');
    sessionStorage.removeItem('issue_gradYear');
    setFullName('');
    setStudentId('');
    setCgpa('');
    setAttachedFile(null);
    setAttachedFileHash('');
  };

  const loadData = async () => {
    try {
      const dbStats = await api.getDashboardStats(currentUser.role, currentUser.username);
      setStats(dbStats);

      const dbCerts = await api.searchCertificates({});
      setCerts(dbCerts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // PDF processing with client-side SHA-256 calculation
  const handlePdfUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Violation check: Core system accepts certificate files in PDF format only (FR-13).');
      return;
    }
    setAttachedFile(file);
    setLoadingFile(true);
    setFormError('');
    try {
      const hash = await computeFileSHA256(file);
      setAttachedFileHash(hash);
    } catch (error) {
      setFormError('Failed to compute cryptography integrity checksum.');
    } finally {
      setLoadingFile(false);
    }
  };

  // Issuance Submission
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim() || !studentId.trim() || !cgpa.trim() || !gradYear.trim()) {
      setFormError('Validation error: All credential parameters must be completed.');
      return;
    }

    const numericCgpa = parseFloat(cgpa);
    if (isNaN(numericCgpa) || numericCgpa < 2.0 || numericCgpa > 4.0) {
      setFormError('Validation: Please input a mathematically valid CGPA between 2.00 and 4.00.');
      return;
    }

    if (!attachedFile || !attachedFileHash) {
      setFormError('Credential file error: Academic certificate PDF must be uploaded to compute SHA-256 ledger fingerprints.');
      return;
    }

    setSubmittingInsert(true);
    try {
      const response = await api.issueCertificate({
        full_name: fullName.trim(),
        student_id: studentId.trim(),
        department,
        cgpa: numericCgpa,
        graduation_year: gradYear,
        pdf_file_name: attachedFile.name,
        pdf_file_hash: attachedFileHash,
        file: attachedFile
      }, currentUser.username);

      setCreatedCert(response);
      clearFormSession();
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error occurred registering block transaction on Hyperledger.');
    } finally {
      setSubmittingInsert(false);
    }
  };

  // Searching action
  const handleQuerySearch = async () => {
    try {
      const results = await api.searchCertificates({
        full_name_query: searchText,
        student_id_query: searchText,
        department: searchDept,
        graduation_year: searchYear
      });
      setCerts(results);
      setRegistryPage(1);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    handleQuerySearch();
  }, [searchText, searchDept, searchYear]);

  const handleDownloadQR = async (certId: string, name: string) => {
    try {
      const res = await fetch(`/api/certificates/${certId}/qr`);
      if (!res.ok) throw new Error('Failed to fetch QR');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR_${certId}_${name.replace(/\s+/g, '_')}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not download QR code.');
    }
  };

  // Pagination calculation
  const totalRegistryPages = Math.ceil(certs.length / pageSize) || 1;
  const currRegistryRows = certs.slice((registryPage - 1) * pageSize, registryPage * pageSize);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Registrar Console</h2>
          
        </div>

        {/* Action bar */}
        <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-xl space-x-1 mt-4 md:mt-0 font-sans text-xs sm:text-sm font-semibold overflow-x-auto select-none">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'stats' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Stats
          </button>
          <button
            onClick={() => setActiveTab('issue')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'issue' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Issue
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'batch' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Batch
          </button>
          <button
            onClick={() => setActiveTab('registry')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'registry' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Registry
          </button>
        </div>
      </div>

      {/* SUB-PANEL 1: ISSUER STATS OVERVIEW */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-950 text-white rounded-xl p-5 border border-slate-800 shadow-md">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest font-semibold block">Total Degrees Issued</span>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-black tracking-tight">{stats.totalIssued}</span>
                <Award className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-mono">Blockchain validated</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm transition-colors">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest font-semibold block">Revoked Records</span>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.totalRevoked}</span>
                <span className="inline-flex px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/45 text-red-700 dark:text-red-400 text-[10px] font-mono font-bold uppercase">Locked</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">Revoked or suspended</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm transition-colors">
              <div className="h-full flex flex-col justify-between">
                <div>
                  <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest font-semibold block">Shortcut panel</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">Ready to record new academic transactions?</p>
                </div>
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={() => setActiveTab('issue')}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors text-center cursor-pointer"
                  >
                    Issue
                  </button>
                  <button
                    onClick={() => setActiveTab('registry')}
                    className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold text-xs rounded-lg transition-colors text-center cursor-pointer"
                  >
                    Registry
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Core Issuance history lists */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-6 transition-colors">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-3 border-b border-slate-110 dark:border-slate-800">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Recent Issuances</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans mt-3">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 font-mono border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[9px] font-bold">
                    <th className="pb-3">Certificate ID</th>
                    <th className="pb-3">Student Name</th>
                    <th className="pb-3">Enrollment ID</th>
                    <th className="pb-3">Department</th>
                    <th className="pb-3">CGPA</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {certs.slice(0, 5).map((item) => (
                    <tr key={item.certificate_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                      <td className="py-3 font-mono font-bold text-slate-500">{item.certificate_id}</td>
                      <td className="py-3 font-extrabold text-slate-850 dark:text-slate-200">{item.full_name}</td>
                      <td className="py-3 font-mono font-semibold text-slate-500 dark:text-slate-400">{item.student_id}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{item.department}</td>
                      <td className="py-3 text-slate-900 dark:text-slate-300 font-mono font-bold">{item.cgpa.toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 md:px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          item.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40' : 'bg-red-50 dark:bg-red-950/45 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/40'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PANEL 2: ISSUE CERTIFICATE DIGITAL DEGREE FORM */}
      {activeTab === 'issue' && (
        <div className="max-w-3xl mx-auto">
          
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-6 shadow-sm transition-colors">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-3 border-b border-slate-100 dark:border-slate-800 mb-5">
              <FilePlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Accredit New Graduate Student</span>
            </h3>

            <form onSubmit={handleIssueSubmit} className="space-y-4 text-xs">
              
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs font-semibold rounded-lg border border-red-100 dark:border-red-900/40 flex items-center space-x-1.5">
                  <X className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-mono font-bold uppercase mb-1">Student Full Name</label>
                  <input
                    id="input-issue-fullname"
                    type="text"
                    required
                    placeholder="e.g. Dawit Yohannes"
                    className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={fullName}
                    onChange={(e) => updateFormState('fullName', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-mono font-bold uppercase mb-1">Student Enrollment ID</label>
                  <input
                    id="input-issue-studentid"
                    type="text"
                    required
                    placeholder="e.g. ETS0951/15"
                    className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={studentId}
                    onChange={(e) => updateFormState('studentId', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-slate-500 dark:text-slate-400 font-mono font-bold uppercase mb-1">Academic Department</label>
                  <select
                    className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={department}
                    onChange={(e) => updateFormState('department', e.target.value)}
                  >
                    {DEPARTMENTS.map((dept, idx) => (
                      <option key={idx} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-mono font-bold uppercase mb-1">Graduation Batch</label>
                  <select
                    className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={gradYear}
                    onChange={(e) => updateFormState('gradYear', e.target.value)}
                  >
                    {gradYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-mono font-bold uppercase mb-1">CGPA Metric</label>
                <input
                  id="input-issue-cgpa"
                  type="text"
                  required
                  placeholder="e.g. 3.84"
                  className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={cgpa}
                  onChange={(e) => updateFormState('cgpa', e.target.value)}
                />
              </div>

              {/* Secure PDF upload (compiling hashing code) */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20">
                <span className="block text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide mb-2">
                  Attach Academic Certificate PDF File
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 text-white rounded-lg text-xs font-bold font-sans tracking-wide hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Upload PDF
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => e.target.files && e.target.files[0] && handlePdfUpload(e.target.files[0])}
                  />
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate flex-1 leading-normal">
                    {attachedFile ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4 shrink-0 inline text-emerald-500" />
                        <span className="truncate">{attachedFile.name} ({attachedFileHash ? "SHA256 Ready" : "Computing..."})</span>
                      </span>
                    ) : (
                      <span>Select a certificate PDF file...</span>
                    )}
                  </div>
                </div>

                {attachedFileHash && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg text-[10px] font-mono mt-3 text-slate-400 dark:text-slate-500 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-500 dark:text-slate-400">SHA-256 CHECKSUM:</span>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(attachedFileHash); }}
                        className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded font-semibold text-slate-600 dark:text-slate-400 cursor-pointer transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <span className="break-all select-all">{attachedFileHash}</span>
                  </div>
                )}
              </div>

              <div className="flex space-x-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={clearFormSession}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg cursor-pointer"
                >
                  Clear
                </button>
                <button
                  id="btn-issue"
                  type="submit"
                  disabled={submittingInsert || loadingFile}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold uppercase rounded-lg cursor-pointer inline-flex items-center justify-center space-x-1"
                >
                  {submittingInsert ? (
                    <span>Registering...</span>
                  ) : (
                    <span>Submit</span>
                  )}
                </button>
              </div>

            </form>
          </div>

        </div>
      )}

      {/* SUB-PANEL 3: BATCH ISSUANCE VIA CSV */}
      {activeTab === 'batch' && (
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-6 shadow-sm transition-colors">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-3 border-b border-slate-100 dark:border-slate-800 mb-5">
              <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Batch Issue Certificates</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">CSV Format Requirements</h4>
                <p className="text-slate-500 dark:text-slate-400 mb-2">Upload a CSV file with the following columns:</p>
                <code className="block bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  student_id,full_name,department,cgpa,graduation_year
                </code>
                <p className="text-slate-400 dark:text-slate-500 mt-2">Each student will receive a blockchain-issued certificate. Emails are sent automatically if students have registered.</p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => { setBatchFile(e.target.files?.[0] || null); setBatchResult(null); }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Choose CSV File
                  </button>
                  <span className="text-slate-500 dark:text-slate-400">
                    {batchFile ? batchFile.name : 'No file selected'}
                  </span>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs font-semibold rounded-lg border border-red-100 dark:border-red-900/40 flex items-center space-x-1.5">
                  <X className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!batchFile || batchIssuing}
                  onClick={async () => {
                    if (!batchFile) return;
                    setBatchIssuing(true);
                    setFormError('');
                    setBatchResult(null);
                    try {
                      const result = await api.batchIssueCsv(batchFile);
                      setBatchResult(result);
                    } catch (err: any) {
                      setFormError(err.message || 'Batch issuance failed.');
                    } finally {
                      setBatchIssuing(false);
                      loadData();
                    }
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold uppercase rounded-lg cursor-pointer inline-flex items-center justify-center space-x-1"
                >
                  {batchIssuing ? <span>Processing...</span> : <span>Upload & Issue</span>}
                </button>
              </div>

              {batchResult && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="font-bold text-slate-700 dark:text-slate-300">{batchResult.message}</p>

                  {batchResult.results.success.length > 0 && (
                    <div>
                      <h4 className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">Successful ({batchResult.results.success.length})</h4>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-lg max-h-32 overflow-y-auto">
                        {batchResult.results.success.map((s: any, i: number) => (
                          <div key={i} className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 py-0.5">
                            Row {s.row}: {s.certificate_id} — {s.full_name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {batchResult.results.errors.length > 0 && (
                    <div>
                      <h4 className="font-bold text-red-600 dark:text-red-400 mb-1">Errors ({batchResult.results.errors.length})</h4>
                      <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded-lg max-h-32 overflow-y-auto">
                        {batchResult.results.errors.map((e: any, i: number) => (
                          <div key={i} className="text-[11px] font-mono text-red-800 dark:text-red-300 py-0.5">
                            Row {e.row}: {e.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-PANEL 4: CERTIFICATES REGISTRY FILE */}
      {activeTab === 'registry' && (
        <div className="space-y-6">
          
          {/* Filters Bar block */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-end transition-colors">
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
              <label className="block text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Filter Department</label>
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
              <label className="block text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Filter Graduation Year</label>
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
          </div>

          {/* Table display */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-5 transition-colors">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-2 text-base pb-3 border-b border-slate-100 dark:border-slate-800">
              <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Accredited Registry</span>
            </h3>
            
            <div className="overflow-x-auto min-h-[160px]">
              <table className="w-full text-left text-xs font-sans mt-3">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 font-mono border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[9px] font-bold">
                    <th className="pb-3">Certificate ID</th>
                    <th className="pb-3">Graduate Scholar</th>
                    <th className="pb-3">Enrollment ID</th>
                    <th className="pb-3">Aca. Department</th>
                    <th className="pb-3">CGPA</th>
                    <th className="pb-3">On-Chain Status</th>
                    <th className="pb-3 text-right">Download QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currRegistryRows.map((cert) => (
                    <tr key={cert.certificate_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                      <td className="py-3 font-mono text-slate-500 font-bold">{cert.certificate_id}</td>
                      <td className="py-3 font-extrabold text-slate-900 dark:text-slate-200">{cert.full_name}</td>
                      <td className="py-3 font-mono text-slate-600 dark:text-slate-400 font-semibold">{cert.student_id}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400 font-medium">{cert.department}</td>
                      <td className="py-3 text-slate-900 dark:text-slate-300 font-mono font-bold">{cert.cgpa.toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          cert.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40' : 'bg-red-50 dark:bg-red-950/45 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/40'
                        }`}>
                          {cert.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          id={`btn-download-qr-${cert.certificate_id}`}
                          onClick={() => handleDownloadQR(cert.certificate_id, cert.full_name)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-900 text-slate-700 hover:text-white dark:text-slate-350 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
                        >
                          <Download className="h-3 w-3 inline shrink-0" />
                          <span>Download QR</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {certs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 font-mono">
                        No certified academic records located.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination block */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 text-slate-500 dark:text-slate-400 text-xs font-mono">
              <span>Displaying <strong>{currRegistryRows.length}</strong> of <strong>{certs.length}</strong> records</span>
              <div className="flex space-x-1">
                <button
                  onClick={() => setRegistryPage(p => Math.max(1, p - 1))}
                  disabled={registryPage === 1}
                  className="p-1 px-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                </button>
                <button
                  onClick={() => setRegistryPage(p => Math.min(totalRegistryPages, p + 1))}
                  disabled={registryPage === totalRegistryPages}
                  className="p-1 px-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ===================== SUCCESS DIALOG WITH ACCREDITED QR AND ID VALUE ===================== */}
      {createdCert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-55 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full overflow-hidden text-center transition-colors">
            
            <div className="bg-emerald-600 text-white p-6">
              <CheckCircle2 className="h-10 w-10 text-white mx-auto mb-2" />
              <h4 className="font-extrabold text-sm uppercase tracking-widest font-mono">
                Diploma Issued!
              </h4>
              <p className="text-xs text-emerald-100 mt-1 leading-normal">
                Academic degree record registered successfully.
              </p>
            </div>

            <div className="p-6 space-y-4 text-slate-800 dark:text-slate-350 text-xs text-center">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase">CERTIFICATE ID</span>
                <span className="block text-lg font-bold text-slate-900 dark:text-slate-200 font-mono mt-0.5">{createdCert.certificate_id}</span>
              </div>

              {/* Display QR code preview from backend */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 flex justify-center inline-block mx-auto max-w-xs transition-colors">
                <img
                  src={`/api/certificates/${createdCert.certificate_id}/qr`}
                  alt="Verification QR code"
                  className="h-44 w-44 rounded-lg object-contain bg-white p-1.5 shadow-sm"
                />
              </div>

              <div className="flex space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleDownloadQR(createdCert.certificate_id, createdCert.full_name)}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer flex justify-center items-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Download QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedCert(null)}
                  className="py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
