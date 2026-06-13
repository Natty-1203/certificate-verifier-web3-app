import { User, Certificate, AuditLog, VerificationResult, DashboardStats, Role } from '../types';

export interface IApiClient {
  login(username: string, password_raw: string): Promise<{ token: string; user: User }>;
  logout(): Promise<void>;
  
  verifyCertificateById(certificateId: string): Promise<VerificationResult>;
  verifyCertificateByHash(hash: string): Promise<VerificationResult>;
  
  issueCertificate(data: {
    student_id: string;
    full_name: string;
    department: string;
    cgpa: number;
    graduation_year: string;
    pdf_file_name?: string;
    pdf_file_hash?: string;
    file?: File;
  }, issuerUsername: string): Promise<Certificate>;
  
  revokeCertificate(certificateId: string, reason: string, adminUsername: string): Promise<void>;
  
  searchCertificates(filters: {
    full_name_query?: string;
    student_id_query?: string;
    department?: string;
    graduation_year?: string;
    status?: 'Active' | 'Revoked' | 'All';
  }): Promise<Certificate[]>;
  
  getAuditLogs(): Promise<AuditLog[]>;
  getDashboardStats(role: Role, username: string): Promise<DashboardStats>;
  
  getUsers(): Promise<User[]>;
  createUser(username: string, role: Role, institutionId: string, password?: string): Promise<User>;
  toggleUserDeactivate(userId: string): Promise<User[]>;

  changePassword(currentPassword: string, newPassword: string): Promise<void>;

  getPublicStats(): Promise<{ totalIssued: number; totalRevoked: number }>;

  register(data: { username: string; password: string; email: string; student_id: string; full_name?: string }): Promise<void>;

  linkStudentId(student_id: string): Promise<void>;

  batchIssueCsv(file: File): Promise<{ message: string; results: { success: any[]; errors: any[] } }>;

  publicVerify(data: { certificateId?: string; studentId?: string; hash?: string }): Promise<any>;
}

export async function computeFileSHA256(file: File): Promise<string> {
  try {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Web Crypto API is not available. Ensure you are using HTTPS or localhost.");
    }
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error("Error computing SHA-256:", error);
    throw error;
  }
}

class RealApiClient implements IApiClient {
  async login(username: string, password_raw: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: password_raw })
    });
    
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Authentication with backend server failed');
    }
    
    const data = await response.json();
    return { token: data.token, user: data.user };
  }

  async logout() {
    localStorage.removeItem('aastu_blockchain_cur_token');
  }

  async verifyCertificateById(certificateId: string): Promise<VerificationResult> {
    const cleanId = encodeURIComponent(certificateId.trim());
    const response = await fetch(`/api/certificates/verify/${cleanId}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      return {
        status: 'Invalid',
        message: errorPayload.message || `The certificate ${certificateId} could not be validated on the blockchain.`
      };
    }
    
    const res = await response.json();
    const details = res.certificateDetails || {};
    
    const mappedCert: Certificate = {
      certificate_id: details.id || certificateId,
      student_id: details.studentId,
      full_name: details.studentName,
      department: details.department,
      cgpa: Number(details.cgpa),
      graduation_year: details.graduationYear,
      issue_date: details.issueDate,
      status: res.status === 'Revoked' ? 'Revoked' : 'Active',
      ipfs_cid: details.ipfsAddress,
      sha256_hash: details.hash,
    };

    return {
      status: res.status || 'Valid',
      certificate: mappedCert,
      revocation_date: res.revocationDate || undefined,
      revocation_reason: res.revocationReason || undefined,
      message: res.status ? `${res.status} — verified on-chain` : 'Successfully verified on-chain ledger records.'
    };
  }

  async verifyCertificateByHash(hash: string): Promise<VerificationResult> {
    return this.verifyCertificateById(hash);
  }

  async issueCertificate(data: {
    student_id: string;
    full_name: string;
    department: string;
    cgpa: number;
    graduation_year: string;
    pdf_file_name?: string;
    pdf_file_hash?: string;
    file?: File;
  }, issuerUsername: string): Promise<Certificate> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    
    const formData = new FormData();
    formData.append('student_id', data.student_id);
    formData.append('full_name', data.full_name);
    formData.append('department', data.department);
    formData.append('cgpa', String(data.cgpa));
    formData.append('graduation_year', data.graduation_year);
    
    const calculatedId = `AASTU-${data.graduation_year}-${data.student_id.replace(/[^0-9]/g, '').slice(-4) || '0001'}`;
    formData.append('certificate_id', calculatedId);
    
    if (!data.file) {
      throw new Error('Certificate PDF file is required.');
    }
    formData.append('file', data.file);

    const response = await fetch('/api/certificates/issue', {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: formData
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failure deploying cert registration transaction to backend');
    }

    const res = await response.json();
    
    return {
      certificate_id: res.id || calculatedId,
      student_id: data.student_id,
      full_name: data.full_name,
      department: data.department,
      cgpa: data.cgpa,
      graduation_year: data.graduation_year,
      issue_date: res.issue_date || new Date().toISOString(),
      status: 'Active',
      ipfs_cid: res.ipfsAddress || 'N/A',
      sha256_hash: res.hash || 'N/A'
    };
  }

  async revokeCertificate(certificateId: string, reason: string, adminUsername: string): Promise<void> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const response = await fetch('/api/certificates/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ certificateId, reason })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Administrative revocation request declined by backend');
    }
  }

  async searchCertificates(filters: any): Promise<Certificate[]> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const searchParams = new URLSearchParams(filters);
    const res = await fetch(`/api/certificates/search?${searchParams.toString()}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) return [];
    return res.json();
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const res = await fetch('/api/audit-logs', {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) return [];
    return res.json();
  }

  async getDashboardStats(role: Role, username: string): Promise<DashboardStats> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const res = await fetch(`/api/dashboard/stats?role=${role}&username=${username}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      throw new Error('Failed to fetch dashboard statistics from backend');
    }
    return res.json();
  }

  async getUsers(): Promise<User[]> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const res = await fetch('/api/users', {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) return [];
    return res.json();
  }

  async createUser(username: string, role: Role, institutionId: string, password?: string): Promise<User> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const body: any = { username, role, institutionId };
    if (password) body.password = password;
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new Error('Could not create new user on backend ledger');
    }
    return res.json();
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Password change failed.');
    }
  }

  async toggleUserDeactivate(userId: string): Promise<User[]> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const res = await fetch(`/api/users/${userId}/deactivate`, {
      method: 'PATCH',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) throw new Error('Could not toggle user status');
    return res.json();
  }

  async getPublicStats(): Promise<{ totalIssued: number; totalRevoked: number }> {
    const res = await fetch('/api/public/stats');
    if (!res.ok) return { totalIssued: 0, totalRevoked: 0 };
    return res.json();
  }

  async register(data: { username: string; password: string; email: string; student_id: string; full_name?: string }): Promise<void> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Registration failed.');
    }
  }

  async linkStudentId(student_id: string): Promise<void> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const res = await fetch('/api/auth/link-student-id', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ student_id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to link student ID.');
    }
  }

  async batchIssueCsv(file: File): Promise<{ message: string; results: { success: any[]; errors: any[] } }> {
    const token = localStorage.getItem('aastu_blockchain_cur_token');
    const formData = new FormData();
    formData.append('csv', file);
    const res = await fetch('/api/certificates/batch-issue', {
      method: 'POST',
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Batch issuance failed.');
    }
    return res.json();
  }

  async publicVerify(data: { certificateId?: string; studentId?: string; hash?: string }): Promise<any> {
    const res = await fetch('/api/public/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }
}

export const api: IApiClient = new RealApiClient();
