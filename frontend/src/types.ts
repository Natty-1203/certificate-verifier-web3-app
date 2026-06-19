export type Role = 'Admin' | 'Issuer' | 'Student';

export interface Ticket {
  id: string;
  certificate_id?: string;
  student_id: string;
  student_name: string;
  subject: string;
  status: 'Open' | 'InReview' | 'Approved' | 'Rejected' | 'Resolved';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

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
  issuer_id?: string;
  issuer_msp?: string;
  revoked_by?: string;
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
