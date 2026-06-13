export type Role = 'Admin' | 'Issuer' | 'Student';

export interface User {
  id: string;
  username: string;
  role: Role;
  institution_id: string;
  is_active: boolean;
  failed_attempts: number;
  email?: string;
  student_id?: string;
}

export interface Certificate {
  certificate_id: string;
  student_id: string;
  full_name: string;
  department: string;
  cgpa: number;
  graduation_year: string;
  issue_date: string;
  status: 'Active' | 'Revoked';
  ipfs_cid?: string;
  qr_code_path?: string;
  revocation_date?: string;
  revocation_reason?: string;
  sha256_hash: string;
}

export interface VerificationResult {
  status: 'Valid' | 'Invalid' | 'Revoked';
  certificate?: Certificate;
  revocation_date?: string;
  revocation_reason?: string;
  message: string;
}

export interface AuditLog {
  id: string;
  certificate_id: string;
  actor: string;
  action: 'Issue' | 'Verify' | 'Revoke';
  timestamp: string;
  hash: string;
  details: string;
}

export interface DashboardStats {
  totalIssued: number;
  totalRevoked: number;
  verificationAttemptsToday: number;
  verificationAttemptsAllTime: number;
  totalRegisteredUsers: number;
}
